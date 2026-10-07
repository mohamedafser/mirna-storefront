import { ShoppingBag, UserRound } from "lucide-react";
import Link from "next/link";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import type { Messages } from "@/lib/i18n/messages";

/** Header text link (desktop) / icon (mobile); inherits the header's colour. */
export const headerActionClassName =
  "inline-flex h-11 min-w-11 items-center justify-center transition-opacity hover:opacity-70 lg:min-w-0";

const labelClassName = "caps hidden text-[0.6875rem] font-medium lg:inline";

/**
 * Account entry point. Guest-only for now: it always links to the Account
 * page. Phase 8 (customer auth) passes the signed-in customer here and swaps
 * the label/target (e.g. a customer menu) without touching the header layout.
 */
export function AccountLink({ locale, t }: { locale: Locale; t: Messages["nav"] }) {
  return (
    <Link
      href={localizedHref(locale, routes.account)}
      aria-label={t.account}
      className={headerActionClassName}
    >
      <UserRound aria-hidden strokeWidth={1.5} className="size-5 lg:hidden" />
      <span aria-hidden className={labelClassName}>
        {t.account}
      </span>
    </Link>
  );
}

/**
 * Cart entry point. Placeholder until Phase 9 adds the cart; the item count
 * ("Cart (2)") will be appended to the label then.
 */
export function CartLink({ locale, t }: { locale: Locale; t: Messages["nav"] }) {
  return (
    <Link
      href={localizedHref(locale, routes.cart)}
      aria-label={t.cart}
      className={headerActionClassName}
    >
      <ShoppingBag aria-hidden strokeWidth={1.5} className="size-5 lg:hidden" />
      <span aria-hidden className={labelClassName}>
        {t.cart}
      </span>
    </Link>
  );
}
