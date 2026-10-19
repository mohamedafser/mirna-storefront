"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { headerActionClassName } from "@/components/navigation/header-actions";
import { localizedHref, routes } from "@/config/navigation";
import { toIntlLocale } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { plural } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";
import { useWishlist } from "./wishlist-provider";

/**
 * Header wishlist link: a heart with the number of saved products, once the
 * wishlist has been read (so the static header never shows a wrong number).
 */
export function WishlistLink() {
  const { locale, messages } = useI18n();
  const { ready, ids } = useWishlist();
  const count = ready ? ids.length : 0;
  const number = new Intl.NumberFormat(toIntlLocale(locale)).format(Math.min(count, 99));

  return (
    <Link
      href={localizedHref(locale, routes.wishlist)}
      aria-label={
        ready ? plural(locale, count, messages.wishlist.linkCount) : messages.nav.wishlist
      }
      className={cn(headerActionClassName, "relative lg:min-w-11")}
    >
      <Heart aria-hidden strokeWidth={1.5} className="size-5" />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute end-1 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-header-foreground px-1 text-[0.625rem] leading-4 font-semibold text-header tabular-nums"
        >
          {number}
        </span>
      )}
    </Link>
  );
}
