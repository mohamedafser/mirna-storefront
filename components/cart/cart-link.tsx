"use client";

import { ShoppingBag } from "lucide-react";
import { headerActionClassName } from "@/components/navigation/header-actions";
import { useI18n } from "@/lib/i18n/client";
import { plural } from "@/lib/i18n/messages";
import { toIntlLocale } from "@/lib/format";
import { cn } from "@/lib/utils/cn";
import { CartDrawer } from "./cart-drawer";
import { useCart } from "./cart-provider";

/**
 * Header cart button: a bag icon with the item count, opening the cart
 * drawer. The count appears once the cart has been read, so the static
 * header never shows a wrong number. When an item is added the bag nudges and
 * the badge pops (re-keyed on every add so the animation replays).
 */
export function CartLink() {
  const { locale, messages } = useI18n();
  const { ready, count, drawerOpen, setDrawerOpen, lastAdded } = useCart();
  const shown = ready ? count : 0;
  const number = new Intl.NumberFormat(toIntlLocale(locale)).format(Math.min(shown, 99));
  const bump = lastAdded?.id ?? 0;

  return (
    <>
      <button
        type="button"
        aria-label={ready ? plural(locale, count, messages.cart.cartCount) : messages.nav.cart}
        aria-haspopup="dialog"
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen(true)}
        className={cn(headerActionClassName, "relative lg:min-w-11")}
      >
        <ShoppingBag
          key={`bag-${bump}`}
          aria-hidden
          strokeWidth={1.5}
          className={cn("size-5", bump > 0 && "animate-cart-nudge")}
        />
        {shown > 0 && (
          <span
            key={`badge-${bump}`}
            aria-hidden
            className={cn(
              "absolute end-1 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-header-foreground px-1 text-[0.625rem] leading-4 font-semibold text-header tabular-nums",
              bump > 0 && "animate-cart-pop",
            )}
          >
            {number}
          </span>
        )}
      </button>
      <CartDrawer />
    </>
  );
}
