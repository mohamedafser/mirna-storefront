import { UserRound } from "lucide-react";
import Link from "next/link";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import type { Messages } from "@/lib/i18n/messages";

/** Header text link (desktop) / icon (mobile); inherits the header's colour. */
export const headerActionClassName =
  "inline-flex h-11 min-w-11 items-center justify-center transition-opacity hover:opacity-70 lg:min-w-0";

export const headerLabelClassName = "caps hidden text-[0.6875rem] font-medium lg:inline";

/**
 * Account entry point. Always links to /account; proxy.ts sends signed-out
 * visitors to /login from there, so the header stays static (no session read).
 */
export function AccountLink({ locale, t }: { locale: Locale; t: Messages["nav"] }) {
  return (
    <Link
      href={localizedHref(locale, routes.account)}
      aria-label={t.account}
      className={headerActionClassName}
    >
      <UserRound aria-hidden strokeWidth={1.5} className="size-5 lg:hidden" />
      <span aria-hidden className={headerLabelClassName}>
        {t.account}
      </span>
    </Link>
  );
}
