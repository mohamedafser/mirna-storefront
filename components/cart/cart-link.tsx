"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import {
  headerActionClassName,
  headerLabelClassName,
} from "@/components/navigation/header-actions";
import { localizedHref, routes } from "@/config/navigation";
import { useI18n } from "@/lib/i18n/client";
import { plural } from "@/lib/i18n/messages";
import { toIntlLocale } from "@/lib/format";
import { cn } from "@/lib/utils/cn";
import { useCart } from "./cart-provider";

/**
 * Header cart link with the item count: "Cart (2)" on desktop, a bag icon
 * with a badge on mobile. The count appears once the cart has been read, so
 * the static header never shows a wrong number.
 */
export function CartLink() {
  const { locale, messages } = useI18n();
  const { ready, count } = useCart();
  const shown = ready ? count : 0;
  const number = new Intl.NumberFormat(toIntlLocale(locale)).format(Math.min(shown, 99));

  return (
    <Link
      href={localizedHref(locale, routes.cart)}
      aria-label={ready ? plural(locale, count, messages.cart.cartCount) : messages.nav.cart}
      className={cn(headerActionClassName, "relative")}
    >
      <ShoppingBag aria-hidden strokeWidth={1.5} className="size-5 lg:hidden" />
      {shown > 0 && (
        <span
          aria-hidden
          className="absolute end-1 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[0.625rem] leading-4 font-semibold text-background tabular-nums lg:hidden"
        >
          {number}
        </span>
      )}
      <span aria-hidden className={headerLabelClassName}>
        {messages.nav.cart}
        {shown > 0 && ` (${number})`}
      </span>
    </Link>
  );
}
