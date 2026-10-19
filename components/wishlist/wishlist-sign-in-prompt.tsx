"use client";

import { Heart, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { buttonClassName } from "@/components/ui/button";
import { localizedHref, routes } from "@/config/navigation";
import { REDIRECT_PARAM } from "@/lib/auth/redirect";
import { useI18n } from "@/lib/i18n/client";

/** How long the prompt stays up unless it is closed first. */
const VISIBLE_MS = 9000;

/** /login, then back to the (merged) wishlist. */
export function wishlistSignInHref(locale: Parameters<typeof localizedHref>[0]): string {
  const back = encodeURIComponent(localizedHref(locale, routes.wishlist));
  return `${localizedHref(locale, routes.login)}?${REDIRECT_PARAM}=${back}`;
}

/**
 * Shown once per visit after a guest saves their first product: the item is
 * kept on this device only, and signing in keeps it in the account (the
 * guest wishlist is merged on sign-in). A polite live region, not a dialog,
 * so it never takes focus. Closes by itself, with ✕ or Escape.
 */
export function WishlistSignInPrompt({ onClose }: { onClose: () => void }) {
  const { locale, messages } = useI18n();
  const t = messages.wishlist;

  useEffect(() => {
    const timer = window.setTimeout(onClose, VISIBLE_MS);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 animate-cart-item-in border bg-popover p-5 text-popover-foreground shadow-lg sm:start-auto sm:end-6 sm:w-96"
    >
      <div className="flex items-start gap-3">
        <Heart aria-hidden strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 fill-current" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t.savedOnDeviceTitle}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.signInToKeep}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={wishlistSignInHref(locale)}
              onClick={onClose}
              className={buttonClassName({ size: "sm" })}
            >
              {t.signIn}
            </Link>
            <Link
              href={localizedHref(locale, routes.wishlist)}
              onClick={onClose}
              className={buttonClassName({ size: "sm", variant: "outline" })}
            >
              {t.view}
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.closePrompt}
          className="-me-2 -mt-2 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center hover:opacity-70"
        >
          <X aria-hidden strokeWidth={1.5} className="size-4" />
        </button>
      </div>
    </div>
  );
}
