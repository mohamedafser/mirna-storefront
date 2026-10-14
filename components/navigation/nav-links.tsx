"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { localizedHref, routes } from "@/config/navigation";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils/cn";
import type { NavCategory } from "@/types/domain";

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
  /** Top-level categories with their subcategories (getNavCategories()). */
  items: NavCategory[];
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
}

/**
 * Primary storefront links: one per top-level category (Women, Kids, …), with
 * aria-current on the active one. Horizontal in the desktop header, where
 * hovering or focusing a category opens a dropdown of "All products" plus its
 * subcategories; vertical in the mobile drawer, with subcategories indented.
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
  items,
  orientation = "horizontal",
  onNavigate,
  pathname,
}: NavLinksProps & { pathname: string | null }) {
  const { locale, messages } = useI18n();
  const horizontal = orientation === "horizontal";
  // The dropdown a link was just chosen from: kept closed (despite hover and
  // focus) until the pointer leaves that menu item.
  const [dismissed, setDismissed] = useState<string | null>(null);
  const href = (slug: string) => localizedHref(locale, routes.category(slug));
  const isCurrent = (slug: string) => pathname === href(slug);

  return (
    <ul className={cn(horizontal ? "flex items-center gap-7 xl:gap-9" : "grid divide-y border-y")}>
      {items.map((item) => {
        const target = href(item.slug);
        // Active on the category itself or any of its subcategories.
        const active = isCurrent(item.slug) || item.children.some((child) => isCurrent(child.slug));
        const panelId = `nav-panel-${item.slug}`;

        if (!horizontal) {
          return (
            <li key={item.slug}>
              <Link
                href={target}
                onClick={onNavigate}
                aria-current={isCurrent(item.slug) ? "page" : undefined}
                className="caps flex min-h-14 items-center justify-between px-6 text-xs font-medium transition-opacity hover:opacity-70"
              >
                <span className="relative py-1">
                  {item.name}
                  <PendingHint />
                </span>
                {active && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
              </Link>
              {item.children.length > 0 && (
                <ul className="-mt-2 pb-3">
                  {item.children.map((child) => (
                    <li key={child.slug}>
                      <Link
                        href={href(child.slug)}
                        onClick={onNavigate}
                        aria-current={isCurrent(child.slug) ? "page" : undefined}
                        className={cn(
                          "flex min-h-10 items-center ps-10 pe-6 text-sm transition-colors hover:text-foreground",
                          isCurrent(child.slug)
                            ? "font-medium text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        }

        return (
          <li
            key={item.slug}
            className="group/nav relative"
            onPointerLeave={() => setDismissed((slug) => (slug === item.slug ? null : slug))}
          >
            <Link
              href={target}
              onClick={onNavigate}
              aria-current={isCurrent(item.slug) ? "page" : undefined}
              aria-controls={panelId}
              className="caps relative inline-flex h-11 items-center text-xs font-medium"
            >
              <span className="relative py-1">
                {item.name}
                {/* Thin underline: always on the active section, grows in on hover. */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-0 -bottom-0.5 h-px origin-left rtl:origin-right bg-current transition-transform duration-300 ease-out",
                    active ? "scale-x-100" : "scale-x-0 group-hover/nav:scale-x-100",
                  )}
                />
                <PendingHint />
              </span>
            </Link>
            {/* Always shown on hover ("All products", then subcategories). The
                padding bridges the gap to the header's bottom edge, so the
                pointer can travel from the link into the panel without closing it. */}
            <div
              id={panelId}
              hidden={dismissed === item.slug}
              className="invisible absolute start-0 top-full z-50 pt-[calc((var(--header-h)-2.75rem)/2)] opacity-0 transition-[opacity,visibility] duration-150 group-focus-within/nav:visible group-focus-within/nav:opacity-100 group-hover/nav:visible group-hover/nav:opacity-100"
            >
              <ul className="min-w-64 border border-t-2 border-t-foreground bg-popover px-2 py-3 text-popover-foreground shadow-card translate-y-1 transition-transform duration-200 ease-out group-hover/nav:translate-y-0 group-focus-within/nav:translate-y-0">
                {[{ name: messages.nav.allProducts, slug: item.slug }, ...item.children].map(
                  (child, index) => (
                    <li key={index === 0 ? "all" : child.slug}>
                      <Link
                        href={href(child.slug)}
                        onClick={(event) => {
                          // Close the dropdown once a choice is made.
                          setDismissed(item.slug);
                          event.currentTarget.blur();
                          onNavigate?.();
                        }}
                        aria-current={isCurrent(child.slug) ? "page" : undefined}
                        className={cn(
                          "caps flex min-h-10 items-center px-4 text-[0.6875rem] whitespace-nowrap transition-colors hover:bg-accent",
                          isCurrent(child.slug) && "font-semibold",
                        )}
                      >
                        {child.name}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
