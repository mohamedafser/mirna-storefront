"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { localizedHref, mainNav } from "@/config/navigation";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils/cn";

/** Underline that fades in while a slow navigation is pending. */
function PendingHint() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-x-0 -bottom-0.5 h-px bg-current transition-opacity",
        pending ? "animate-pulse opacity-60" : "opacity-0",
      )}
    />
  );
}

interface NavLinksProps {
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
}

/**
 * Primary storefront links (Home, Shop, Categories, About, Contact) with
 * aria-current on the active page. Horizontal in the desktop header,
 * vertical in the mobile drawer.
 *
 * The current URL is read behind <Suspense>: routes whose path is only known
 * at request time (404s, /categories/[slug]) prerender the links without
 * an active state, which streams in a moment later.
 */
export function NavLinks(props: NavLinksProps) {
  return (
    <Suspense fallback={<NavLinksView {...props} pathname={null} />}>
      <CurrentNavLinks {...props} />
    </Suspense>
  );
}

function CurrentNavLinks(props: NavLinksProps) {
  return <NavLinksView {...props} pathname={usePathname()} />;
}

function NavLinksView({
  orientation = "horizontal",
  onNavigate,
  pathname,
}: NavLinksProps & { pathname: string | null }) {
  const { locale, messages } = useI18n();
  const horizontal = orientation === "horizontal";

  return (
    <ul className={cn(horizontal ? "flex items-center gap-7 xl:gap-9" : "grid divide-y border-y")}>
      {mainNav.map(({ key, href }) => {
        const target = localizedHref(locale, href);
        const active =
          pathname !== null &&
          (href === "/"
            ? pathname === target
            : pathname === target || pathname.startsWith(`${target}/`));
        return (
          <li key={key}>
            <Link
              href={target}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "caps font-medium transition-opacity hover:opacity-70",
                horizontal
                  ? "relative inline-flex h-11 items-center text-xs"
                  : "flex min-h-14 items-center justify-between px-6 text-xs",
              )}
            >
              <span className="relative py-1">
                {messages.nav[key]}
                {/* Active page: thin underline (desktop) */}
                {horizontal && active && (
                  <span aria-hidden className="absolute inset-x-0 -bottom-0.5 h-px bg-current" />
                )}
                <PendingHint />
              </span>
              {!horizontal && active && (
                <span aria-hidden className="size-1.5 rounded-full bg-current" />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
