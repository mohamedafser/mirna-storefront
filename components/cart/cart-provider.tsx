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
import {
  addToCart,
  removeFromCart,
  setCartQuantity,
  syncCart,
  type CartError,
  type CartResult,
} from "@/lib/cart/actions";
import { clampQuantity, countItems, MAX_CART_LINES, type CartLine } from "@/lib/cart/rules";
import {
  CART_STORAGE_KEY,
  hasSessionCookie,
  readGuestCart,
  writeGuestCart,
} from "@/lib/cart/storage";

interface CartContextValue {
  /** false until the cart has been read (avoids a "0" flash in the header). */
  ready: boolean;
  /** Where the cart lives: the customer's account (true) or this browser. */
  signedIn: boolean;
  lines: CartLine[];
  count: number;
  /** Each returns null on success, or a key into messages.cart.errors. */
  add: (productId: string, quantity: number) => Promise<CartError | null>;
  setQuantity: (productId: string, quantity: number) => Promise<CartError | null>;
  remove: (productId: string) => Promise<CartError | null>;
  clear: () => Promise<CartError | null>;
  /** Re-reads the cart from its source (e.g. after an order cleared it on the server). */
  reload: () => void;
  /** Applies the cart page's server view (stored lines, or guest lines minus removed products). */
  applyView: (view: { signedIn: boolean; lines: CartLine[] }) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Cart state for the storefront (header count, product page, cart page).
 *
 * Guests: lines in localStorage, shared across tabs. Customers: lines in
 * Supabase via Server Actions. On sign-in (detected from the session cookie
 * when the page changes) the guest cart is merged into the customer's cart
 * once, then cleared from this browser; on sign-out the cart switches back to
 * the (empty) browser cart.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]);
  const sessionHint = useRef<boolean | null>(null);
  const syncing = useRef(false);

  const loadGuestCart = useCallback(() => {
    setSignedIn(false);
    setLines(readGuestCart());
    setReady(true);
  }, []);

  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      const result = await syncCart(readGuestCart());
      if (result.lines === null) {
        loadGuestCart(); // not (or no longer) a signed-in customer
      } else {
        // Merged into the account: the browser copy is no longer needed.
        if (result.ok) writeGuestCart([]);
        setSignedIn(true);
        setLines(result.lines);
        setReady(true);
      }
    } catch {
      // Offline or the action failed: fall back to this browser's cart.
      loadGuestCart();
    } finally {
      syncing.current = false;
    }
  }, [loadGuestCart]);

  // Initial load, and after every navigation if the sign-in state changed
  // (sign-in and sign-out are Server Actions that redirect).
  const checkSession = useCallback(() => {
    const hint = hasSessionCookie();
    if (hint === sessionHint.current) return;
    sessionHint.current = hint;
    if (hint) void sync();
    else loadGuestCart();
  }, [sync, loadGuestCart]);

  // Guest cart changed in another tab.
  useEffect(() => {
    if (signedIn) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === CART_STORAGE_KEY || event.key === null) setLines(readGuestCart());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [signedIn]);

  const updateGuest = useCallback((change: (current: CartLine[]) => CartLine[]) => {
    const next = change(readGuestCart());
    writeGuestCart(next);
    setLines(next);
  }, []);

  /** Applies a customer action's result; `lines: null` means the session ended. */
  const applyResult = useCallback(
    (result: CartResult): CartError | null => {
      if (result.lines === null) {
        sessionHint.current = null;
        void sync();
      } else {
        setSignedIn(true);
        setLines(result.lines);
      }
      return result.ok ? null : result.error;
    },
    [sync],
  );

  const run = useCallback(
    async (action: () => Promise<CartResult>, guest?: () => CartError | null) => {
      try {
        const result = await action();
        if (!result.ok || result.lines !== null || !guest) return applyResult(result);
        return guest();
      } catch {
        return "unexpected" as const;
      }
    },
    [applyResult],
  );

  const value = useMemo<CartContextValue>(() => {
    const guestOnly = (change: (current: CartLine[]) => CartLine[]) => () => {
      updateGuest(change);
      return null;
    };
    return {
      ready,
      signedIn,
      lines,
      count: countItems(lines),
      // Always validated on the server (active + available) before it is stored.
      add: (productId, quantity) =>
        run(
          () => addToCart(productId, quantity),
          () => {
            const current = readGuestCart();
            const existing = current.find((line) => line.productId === productId);
            if (!existing && current.length >= MAX_CART_LINES) return "cartFull";
            updateGuest(() =>
              existing
                ? current.map((line) =>
                    line === existing
                      ? { ...line, quantity: clampQuantity(line.quantity + quantity) }
                      : line,
                  )
                : [...current, { productId, quantity: clampQuantity(quantity) }],
            );
            return null;
          },
        ),
      setQuantity: (productId, quantity) =>
        signedIn
          ? run(() => setCartQuantity(productId, quantity))
          : Promise.resolve(
              guestOnly((current) =>
                current.map((line) =>
                  line.productId === productId
                    ? { ...line, quantity: clampQuantity(quantity) }
                    : line,
                ),
              )(),
            ),
      remove: (productId) =>
        signedIn
          ? run(() => removeFromCart(productId))
          : Promise.resolve(
              guestOnly((current) => current.filter((line) => line.productId !== productId))(),
            ),
      clear: () =>
        signedIn ? run(() => removeFromCart(null)) : Promise.resolve(guestOnly(() => [])()),
      reload: () => {
        sessionHint.current = null;
        checkSession();
      },
      applyView: (view) => {
        if (view.signedIn) {
          setSignedIn(true);
          setLines(view.lines);
        } else {
          updateGuest(() => view.lines);
          setSignedIn(false);
        }
      },
    };
  }, [ready, signedIn, lines, run, updateGuest, checkSession]);

  return (
    <CartContext value={value}>
      {/* usePathname needs its own boundary so the layout can still prerender. */}
      <Suspense fallback={null}>
        <NavigationWatcher onNavigate={checkSession} />
      </Suspense>
      {children}
    </CartContext>
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

export function useCart(): CartContextValue {
  const value = use(CartContext);
  if (!value) throw new Error("useCart must be used within <CartProvider>");
  return value;
}
