"use client";

import { Heart, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { buttonClassName } from "@/components/ui/button";
import type { WishlistError } from "@/lib/wishlist/actions";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";
import { useWishlist } from "./wishlist-provider";

type Status = { saved: boolean; error: WishlistError | null } | null;

/**
 * Save / unsave a product. A toggle button (aria-pressed) with a fixed name,
 * so screen readers announce "pressed" rather than a changing label; the
 * outcome is also announced in a live region.
 *
 * - "card": a round heart over the product card's image (outside the card's
 *   link, so it is its own keyboard stop).
 * - "detail": an outlined button with text, beside Add to cart.
 *
 * The heart fills straight away; the server checks the product is still
 * active and the change is undone with a message if it refuses.
 */
export function WishlistButton({
  productId,
  productName,
  variant = "card",
  className,
}: {
  productId: string;
  productName: string;
  variant?: "card" | "detail";
  className?: string;
}) {
  const { messages } = useI18n();
  const t = messages.wishlist;
  const wishlist = useWishlist();
  const [status, setStatus] = useState<Status>(null);
  const [pending, startTransition] = useTransition();
  const saved = wishlist.ready && wishlist.has(productId);
  const label = format(t.saveLabel, { name: productName });
  // The heart pops only when the customer has just saved it, not on load.
  const popped = saved && Boolean(status?.saved && !status.error);

  function toggle() {
    if (pending || !wishlist.ready) return;
    const adding = !saved;
    setStatus(null);
    startTransition(async () => {
      const error = await (adding ? wishlist.add(productId) : wishlist.remove(productId));
      setStatus({ saved: adding, error });
    });
  }

  const message = status
    ? status.error
      ? t.errors[status.error]
      : status.saved
        ? wishlist.signedIn
          ? t.added
          : t.addedOnDevice
        : t.removed
    : "";

  if (variant === "detail") {
    return (
      <div className={className}>
        <button
          type="button"
          aria-pressed={saved}
          aria-busy={pending}
          disabled={!wishlist.ready}
          onClick={toggle}
          className={buttonClassName({ variant: "outline", size: "lg", className: "w-full" })}
        >
          {pending ? (
            <LoaderCircle aria-hidden className="animate-spin" />
          ) : (
            <Heart
              key={String(saved)}
              aria-hidden
              strokeWidth={1.5}
              className={cn(saved && "fill-current", popped && "animate-cart-pop")}
            />
          )}
          {saved ? t.saved : t.save}
        </button>
        <p
          aria-live="polite"
          className={cn(
            "mt-3 text-sm empty:hidden",
            status?.error ? "text-error" : "text-muted-foreground",
          )}
        >
          {pending ? "" : message}
        </p>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-pressed={saved}
        aria-busy={pending}
        disabled={!wishlist.ready}
        title={saved ? t.saved : t.save}
        onClick={toggle}
        className={cn(
          "inline-flex size-11 cursor-pointer items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur-sm transition-[opacity,transform] hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-95 disabled:cursor-default disabled:opacity-60",
          className,
        )}
      >
        <Heart
          key={String(saved)}
          aria-hidden
          strokeWidth={1.5}
          className={cn("size-[1.125rem]", saved && "fill-current", popped && "animate-cart-pop")}
        />
      </button>
      <span aria-live="polite" className="sr-only">
        {pending ? "" : message}
      </span>
    </>
  );
}
