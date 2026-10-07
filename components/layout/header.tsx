import Link from "next/link";
import { AccountLink, CartLink } from "@/components/navigation/header-actions";
import { HeaderState, SITE_HEADER_ID } from "@/components/navigation/header-state";
import { LocaleMenu } from "@/components/navigation/locale-menu";
import { NavLinks } from "@/components/navigation/nav-links";
import { SearchToggle } from "@/components/navigation/search-toggle";
import { ThemeMenu } from "@/components/navigation/theme-menu";
import { localizedHref, routes } from "@/config/navigation";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { Brand } from "./brand";
import { MobileNav } from "./mobile-nav";

/**
 * Storefront header (Server Component; interactive pieces are client islands).
 * Three columns with the wordmark centred:
 *   lg+  : nav · MIRNA · account · search · cart · language · theme
 *   < lg : menu · MIRNA · search · cart
 * Transparent over a full-bleed hero, solid elsewhere and after scrolling
 * (.site-header in globals.css).
 */
export async function Header() {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);

  return (
    <header
      id={SITE_HEADER_ID}
      className="site-header sticky top-0 z-40 border-b pt-safe"
      // The hero's inline script adds data-overlay before React hydrates.
      suppressHydrationWarning
    >
      <HeaderState />
      <div className="relative mx-auto grid h-[var(--header-h)] max-w-[100rem] grid-cols-[1fr_auto_1fr] items-center gap-4 px-2 sm:px-4 lg:px-12">
        <div className="flex items-center">
          <MobileNav />
          <nav aria-label={messages.nav.primary} className="hidden lg:block">
            <NavLinks />
          </nav>
        </div>

        <Link
          href={localizedHref(locale, routes.home)}
          aria-label={messages.nav.homeLink}
          className="flex h-11 items-center px-1"
        >
          <Brand name={messages.site.name} />
        </Link>

        <div className="flex items-center justify-end gap-0 lg:gap-6">
          <div className="hidden lg:block">
            <AccountLink locale={locale} t={messages.nav} />
          </div>
          <SearchToggle />
          <CartLink locale={locale} t={messages.nav} />
          <div className="hidden items-center gap-3 lg:flex">
            <LocaleMenu />
            <ThemeMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
