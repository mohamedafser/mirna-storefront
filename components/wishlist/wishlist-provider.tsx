"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
  type ReactNode,
} from "react";
import { hasSessionCookie } from "@/lib/cart/storage";
import {
  addToWishlist,
  removeFromWishlist,
  syncWishlist,
  type WishlistError,
  type WishlistResult,
} from "@/lib/wishlist/actions";
import { MAX_WISHLIST_ITEMS } from "@/lib/wishlist/rules";
import {
  readGuestWishlist,
  WISHLIST_STORAGE_KEY,
  writeGuestWishlist,
} from "@/lib/wishlist/storage";
import { WishlistSignInPrompt } from "./wishlist-sign-in-prompt";

interface WishlistContextValue {
  /** false until the wishlist has been read (the hearts stay empty until then). */
  ready: boolean;
  /** Where the wishlist lives: the customer's account (true) or this browser. */
  signedIn: boolean;
  /** Saved product ids, newest first. */
  ids: string[];
  has: (productId: string) => boolean;
  /** Each returns null on success, or a key into messages.wishlist.errors. */
  add: (productId: string) => Promise<WishlistError | null>;
  remove: (productId: string) => Promise<WishlistError | null>;
  /** Applies the wishlist page's server view (stored ids, or guest ids minus removed products). */
  applyView: (view: { signedIn: boolean; ids: string[] }) => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

/** sessionStorage flag: the guest "sign in to keep it" prompt was shown this visit. */
const PROMPT_SHOWN_KEY = "mirna-wishlist-prompt-shown";

function promptAlreadyShown(): boolean {
  try {
    if (window.sessionStorage.getItem(PROMPT_SHOWN_KEY)) return true;
    window.sessionStorage.setItem(PROMPT_SHOWN_KEY, "1");
  } catch {
    // Blocked storage: show it (at most once per page view, see below).
  }
  return false;
}

/**
 * Wishlist state for the storefront (hearts on cards and product pages, the
 * header link and /account/wishlist).
 *
 * Guests: ids in localStorage, shared across tabs. Customers: ids in Supabase
 * via Server Actions. On sign-in (detected from the session cookie when the
 * page changes) the guest wishlist is merged into the account once, without
 * duplicates, then cleared from this browser; on sign-out it switches back to
 * the (empty) browser wishlist. Changes show immediately and are rolled back
 * if the server refuses them.
 */
export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  const [prompt, setPrompt] = useState(false);
  const promptShown = useRef(false);
  const sessionHint = useRef<boolean | null>(null);
  const syncing = useRef(false);

  const loadGuest = useCallback(() => {
    setSignedIn(false);
    setIds(readGuestWishlist());
    setReady(true);
  }, []);

  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      const result = await syncWishlist(readGuestWishlist());
      if (result.ids === null) {
        loadGuest(); // not (or no longer) a signed-in customer
      } else {
        // Merged into the account: the browser copy is no longer needed.
        if (result.ok) writeGuestWishlist([]);
        setSignedIn(true);
        setIds(result.ids);
        setReady(true);
      }
    } catch {
      // Offline or the action failed: fall back to this browser's wishlist.
      loadGuest();
    } finally {
      syncing.current = false;
    }
  }, [loadGuest]);

  // Initial load, and after every navigation if the sign-in state changed.
  const checkSession = useCallback(() => {
    const hint = hasSessionCookie();
    if (hint === sessionHint.current) return;
    sessionHint.current = hint;
    if (hint) void sync();
    else loadGuest();
  }, [sync, loadGuest]);

  // Guest wishlist changed in another tab.
  useEffect(() => {
    if (signedIn) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === WISHLIST_STORAGE_KEY || event.key === null) setIds(readGuestWishlist());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [signedIn]);

  /**
   * Shows `after` straight away, runs the action and rolls back to `before`
   * if it fails. A customer's result replaces
   * the ids; `ids: null` from a customer action means the session ended.
   */
  const run = useCallback(
    async (
      before: string[],
      after: string[],
      action: () => Promise<WishlistResult>,
      guest: () => void,
    ): Promise<WishlistError | null> => {
      setIds(after);
      try {
        const result = await action();
        if (!result.ok) {
          setIds(result.ids ?? before);
          return result.error;
        }
        if (result.ids !== null) {
          setSignedIn(true);
          setIds(result.ids);
        } else if (signedIn) {
          sessionHint.current = null;
          void sync();
        } else {
          guest();
        }
        return null;
      } catch {
        setIds(before);
        return "unexpected";
      }
    },
    [signedIn, sync],
  );

  const value = useMemo<WishlistContextValue>(() => {
    const saved = new Set(ids);
    return {
      ready,
      signedIn,
      ids,
      has: (productId) => saved.has(productId),
      // Always validated on the server (active product) before it is stored.
      add: async (productId) => {
        if (
          !signedIn &&
          !saved.has(productId) &&
          readGuestWishlist().length >= MAX_WISHLIST_ITEMS
        ) {
          return "full";
        }
        return run(
          ids,
          saved.has(productId) ? ids : [productId, ...ids],
          () => addToWishlist(productId),
          () => {
            const current = readGuestWishlist();
            const next = current.includes(productId) ? current : [productId, ...current];
            writeGuestWishlist(next);
            setIds(next);
            // Saved on this device only: offer to sign in, once per visit.
            if (!promptShown.current && !promptAlreadyShown()) setPrompt(true);
            promptShown.current = true;
          },
        );
      },
      remove: (productId) =>
        run(
          ids,
          ids.filter((id) => id !== productId),
          () => removeFromWishlist(productId),
          () => {
            const next = readGuestWishlist().filter((id) => id !== productId);
            writeGuestWishlist(next);
            setIds(next);
          },
        ),
      applyView: (view) => {
        if (!view.signedIn) writeGuestWishlist(view.ids);
        setSignedIn(view.signedIn);
        setIds(view.ids);
      },
    };
  }, [ready, signedIn, ids, run]);

  return (
    <WishlistContext value={value}>
      {/* usePathname needs its own boundary so the layout can still prerender. */}
      <Suspense fallback={null}>
        <NavigationWatcher onNavigate={checkSession} />
      </Suspense>
      {children}
      {prompt && !signedIn && <WishlistSignInPrompt onClose={() => setPrompt(false)} />}
    </WishlistContext>
  );
}

/** Calls `onNavigate` on mount and after every client navigation. */
function NavigationWatcher({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  useEffect(() => {
    onNavigate();
  }, [pathname, onNavigate]);
  return null;
}

export function useWishlist(): WishlistContextValue {
  const value = use(WishlistContext);
  if (!value) throw new Error("useWishlist must be used within <WishlistProvider>");
  return value;
}
