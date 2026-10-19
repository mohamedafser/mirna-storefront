"use client";

import { ArrowRight, ChevronDown, Heart, Menu, ShoppingBag, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import { useCart } from "@/components/cart/cart-provider";
import { useCurrency } from "@/components/currency/currency-provider";
import { headerActionClassName } from "@/components/navigation/header-actions";
import { LocaleSwitcher } from "@/components/navigation/locale-switcher";
import { ThemeSwitcher } from "@/components/navigation/theme-switcher";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { localizedHref, routes } from "@/config/navigation";
import { currencyName, toIntlLocale } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";
import { useWishlist } from "@/components/wishlist/wishlist-provider";
import { Brand } from "./brand";
import type { NavCategory } from "@/types/domain";

// Must match the `lg` breakpoint where the desktop navigation appears.
const DESKTOP_QUERY = "(min-width: 64rem)";

/** Rows rise in one after another when the menu opens (globals.css: menu-item-in). */
function rise(step: number): CSSProperties {
  return { animation: `menu-item-in 500ms cubic-bezier(0.2,0.8,0.2,1) ${120 + step * 60}ms both` };
}

/**
 * Menu button + navigation drawer for mobile and tablet (hidden from lg up).
 * Top to bottom:
 *   - Account, Wishlist and Bag as three tiles (with live counts);
 *   - "Shop": All products, then each category as a large row that links to
 *     it, with a toggle that unfolds its subcategories (the current
 *     section starts unfolded), then Contact;
 *   - Preferences: language, currency (a native select, so the long list
 *     never crowds the menu) and theme.
 * The content mounts when the drawer opens, so it reads the current URL and
 * plays its entrance each time.
 */
export function MobileNav({ items }: { items: NavCategory[] }) {
  const { messages } = useI18n();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // Links close the drawer themselves. Also close on browser back/forward,
  // and if the viewport grows to desktop so a hidden modal can't leave the
  // page inert (e.g. rotating a tablet).
  useEffect(() => {
    if (!open) return;
    const media = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => media.matches && setOpen(false);
    const onPopState = () => setOpen(false);
    media.addEventListener("change", onChange);
    window.addEventListener("popstate", onPopState);
    return () => {
      media.removeEventListener("change", onChange);
      window.removeEventListener("popstate", onPopState);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label={messages.nav.openMenu}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={headerActionClassName}
      >
        <Menu aria-hidden strokeWidth={1.5} className="size-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen} label={messages.nav.menu} side="start" wide>
        <div className="flex h-[var(--header-h)] shrink-0 items-center justify-between border-b ps-6 pe-2">
          <Brand name={messages.site.name} size="sm" />
          <Button variant="ghost" size="icon" aria-label={messages.nav.closeMenu} onClick={close}>
            <X aria-hidden strokeWidth={1.5} />
          </Button>
        </div>
        {open && <MenuContent items={items} close={close} />}
      </Sheet>
    </div>
  );
}

function MenuContent({ items, close }: { items: NavCategory[]; close: () => void }) {
  const { locale, messages } = useI18n();
  const pathname = usePathname();
  const href = (slug: string) => localizedHref(locale, routes.category(slug));
  const inSection = (item: NavCategory) =>
    pathname === href(item.slug) || item.children.some((child) => pathname === href(child.slug));
  // The section the visitor is in starts unfolded.
  const [expanded, setExpanded] = useState<string | null>(
    () => items.find(inSection)?.slug ?? null,
  );

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <QuickLinks close={close} />

      <nav aria-label={messages.nav.primary} className="px-6 pt-4 pb-8">
        <p className="caps text-[0.625rem] font-medium text-muted-foreground" style={rise(1)}>
          {messages.nav.shop}
        </p>
        <ul className="mt-2">
          <li style={rise(2)}>
            <MenuRow
              href={localizedHref(locale, routes.products)}
              current={pathname === localizedHref(locale, routes.products)}
              onNavigate={close}
            >
              {messages.nav.allProducts}
            </MenuRow>
          </li>
          {items.map((item, index) => (
            <li key={item.slug} style={rise(3 + index)}>
              <CategoryRow
                item={item}
                href={href}
                pathname={pathname}
                active={inSection(item)}
                expanded={expanded === item.slug}
                onToggle={() => setExpanded((slug) => (slug === item.slug ? null : item.slug))}
                onNavigate={close}
              />
            </li>
          ))}
          <li style={rise(3 + items.length)}>
            <MenuRow
              href={localizedHref(locale, routes.contact)}
              current={pathname === localizedHref(locale, routes.contact)}
              onNavigate={close}
            >
              {messages.nav.contact}
            </MenuRow>
          </li>
        </ul>
      </nav>

      <Preferences step={4 + items.length} />
    </div>
  );
}

/** Account, Wishlist and Bag as three square tiles, with counts once known. */
function QuickLinks({ close }: { close: () => void }) {
  const { locale, messages } = useI18n();
  const cart = useCart();
  const wishlist = useWishlist();
  const number = new Intl.NumberFormat(toIntlLocale(locale));
  const tiles: { href: string; label: string; icon: ReactNode; count: number | null }[] = [
    {
      href: localizedHref(locale, routes.account),
      label: messages.nav.account,
      icon: <UserRound aria-hidden strokeWidth={1.5} />,
      count: null,
    },
    {
      href: localizedHref(locale, routes.wishlist),
      label: messages.nav.wishlist,
      icon: <Heart aria-hidden strokeWidth={1.5} />,
      count: wishlist.ready ? wishlist.ids.length : null,
    },
    {
      href: localizedHref(locale, routes.cart),
      label: messages.nav.cart,
      icon: <ShoppingBag aria-hidden strokeWidth={1.5} />,
      count: cart.ready ? cart.count : null,
    },
  ];

  return (
    <ul className="grid grid-cols-3 gap-2 px-6 pt-6" style={rise(0)}>
      {tiles.map((tile) => (
        <li key={tile.href}>
          <Link
            href={tile.href}
            onClick={close}
            className="relative flex aspect-square flex-col items-center justify-center gap-2.5 border bg-background/40 text-center transition-colors hover:border-foreground [&_svg]:size-5"
          >
            {tile.icon}
            <span className="caps text-[0.5625rem] font-medium">{tile.label}</span>
            {tile.count !== null && tile.count > 0 && (
              <span className="absolute end-2 top-2 flex min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[0.625rem] leading-5 font-semibold text-background tabular-nums">
                {number.format(Math.min(tile.count, 99))}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

const rowClassName =
  "flex min-h-16 items-center gap-3 font-display text-2xl leading-tight transition-opacity hover:opacity-70";

/** A large menu link with an arrow, for single destinations (All products, Contact). */
function MenuRow({
  href,
  current,
  onNavigate,
  children,
}: {
  href: string;
  current: boolean;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={cn(rowClassName, "group justify-between border-b")}
    >
      <span className={cn(current && "underline decoration-1 underline-offset-8")}>{children}</span>
      <ArrowRight
        aria-hidden
        strokeWidth={1.5}
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1"
      />
    </Link>
  );
}

/**
 * A top-level category: its name links to the category page; the chevron
 * unfolds "All {name}" and the subcategories underneath (height animates
 * via grid rows).
 */
function CategoryRow({
  item,
  href,
  pathname,
  active,
  expanded,
  onToggle,
  onNavigate,
}: {
  item: NavCategory;
  href: (slug: string) => string;
  pathname: string;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const { messages } = useI18n();
  const panelId = useId();
  const hasChildren = item.children.length > 0;
  const links = [
    { name: format(messages.catalogue.allIn, { name: item.name }), slug: item.slug },
    ...item.children,
  ];

  return (
    <div className="border-b">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={href(item.slug)}
          onClick={onNavigate}
          aria-current={pathname === href(item.slug) ? "page" : undefined}
          className={cn(rowClassName, "min-w-0 flex-1")}
        >
          <span className={cn("truncate", active && "underline decoration-1 underline-offset-8")}>
            {item.name}
          </span>
        </Link>
        {hasChildren && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-label={format(messages.nav.toggleCategory, { name: item.name })}
            onClick={onToggle}
            className="-me-3 grid size-12 shrink-0 cursor-pointer place-items-center rounded-full transition-colors hover:bg-accent"
          >
            <ChevronDown
              aria-hidden
              strokeWidth={1.5}
              className={cn("size-5 transition-transform duration-300", expanded && "rotate-180")}
            />
          </button>
        )}
      </div>
      {hasChildren && (
        <div
          id={panelId}
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <ul
            // Collapsed: out of the tab order and hidden from screen readers.
            inert={!expanded}
            className="min-h-0 overflow-hidden"
          >
            <li className="h-1" aria-hidden />
            {links.map((link, index) => {
              const current = pathname === href(link.slug);
              return (
                <li key={index === 0 ? "all" : link.slug}>
                  <Link
                    href={href(link.slug)}
                    onClick={onNavigate}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 border-s ps-4 text-sm transition-colors hover:border-foreground hover:text-foreground",
                      current
                        ? "border-foreground font-medium text-foreground"
                        : "text-muted-foreground",
                      index === 0 && "caps text-[0.6875rem] font-medium",
                    )}
                  >
                    {link.name}
                  </Link>
                </li>
              );
            })}
            <li className="h-4" aria-hidden />
          </ul>
        </div>
      )}
    </div>
  );
}

/** Language, currency and theme, at the foot of the menu on a soft panel. */
function Preferences({ step }: { step: number }) {
  const { locale, messages } = useI18n();
  const { currencies, currency, setCurrency } = useCurrency();
  const currencyId = useId();

  return (
    <section
      aria-label={messages.nav.preferences}
      className="grid gap-6 border-t bg-muted/40 px-6 pt-6 pb-8"
      style={rise(step)}
    >
      <p className="caps text-[0.625rem] font-medium text-muted-foreground">
        {messages.nav.preferences}
      </p>
      <div>
        <p className="mb-2 text-xs text-muted-foreground">{messages.locale.label}</p>
        <LocaleSwitcher fullWidth />
      </div>
      {currencies.length > 1 && (
        <div>
          <label htmlFor={currencyId} className="mb-2 block text-xs text-muted-foreground">
            {messages.currency.label}
          </label>
          <div className="relative">
            <select
              id={currencyId}
              value={currency?.code ?? ""}
              onChange={(event) => setCurrency(event.target.value)}
              className="h-12 w-full cursor-pointer appearance-none border bg-background ps-4 pe-10 text-sm"
            >
              {currencies.map((option) => (
                <option key={option.code} value={option.code}>
                  {`${option.symbol} · ${currencyName(option.code, locale)} (${option.code})`}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              strokeWidth={1.5}
              className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
          </div>
        </div>
      )}
      <div>
        {/* Visible label; the switcher's own legend stays for screen readers. */}
        <p aria-hidden className="mb-2 text-xs text-muted-foreground">
          {messages.theme.label}
        </p>
        <ThemeSwitcher fullWidth showLegend={false} />
      </div>
    </section>
  );
}
