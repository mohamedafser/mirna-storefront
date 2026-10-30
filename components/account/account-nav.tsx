"use client";

import { Heart, LayoutGrid, MapPin, Package, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useCart } from "@/components/cart/cart-provider";
import { localizedHref, routes } from "@/config/navigation";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils/cn";

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

/**
 * The account area's menu: a sidebar from lg, a scrollable row of tabs
 * above the page on smaller screens. Hidden for guests (only the wishlist
 * is open to them), once the cart knows nobody is signed in.
 */
export function AccountNav() {
  return (
    // usePathname needs its own boundary so the layout can still prerender.
    <Suspense fallback={<NavLinks active={null} />}>
      <ActiveNav />
    </Suspense>
  );
}

function ActiveNav() {
  return <NavLinks active={usePathname()} />;
}

function NavLinks({ active }: { active: string | null }) {
  const { locale, messages } = useI18n();
  const cart = useCart();
  if (cart.ready && !cart.signedIn) return null;

  const t = messages.account;
  const items: NavItem[] = [
    { path: routes.account, label: t.overview, icon: LayoutGrid },
    { path: routes.orders, label: messages.orders.manageTitle, icon: Package },
    { path: routes.wishlist, label: messages.wishlist.title, icon: Heart },
    { path: routes.addresses, label: messages.addresses.title, icon: MapPin },
    { path: routes.profile, label: t.profileTitle, icon: UserRound },
  ];
  // Overview only on /account itself; a section also covers its sub-pages.
  const isCurrent = (path: string) => {
    if (!active) return false;
    const href = localizedHref(locale, path);
    return path === routes.account
      ? active === href
      : active === href || active.startsWith(`${href}/`);
  };

  return (
    <nav
      aria-label={t.menu}
      className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:w-52 lg:shrink-0"
    >
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:grid lg:gap-1 lg:overflow-visible lg:p-0">
        {items.map(({ path, label, icon: Icon }) => {
          const current = isCurrent(path);
          return (
            <li key={path} className="shrink-0">
              <Link
                href={localizedHref(locale, path)}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 border px-4 text-sm whitespace-nowrap transition-colors",
                  "lg:border-0 lg:border-s-2 lg:ps-4",
                  current
                    ? "border-foreground bg-card font-medium lg:border-foreground"
                    : "border-border text-muted-foreground hover:text-foreground lg:border-transparent",
                )}
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
