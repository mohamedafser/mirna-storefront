"use client";

import { Menu, ShoppingBag, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { headerActionClassName } from "@/components/navigation/header-actions";
import { LocaleSwitcher } from "@/components/navigation/locale-switcher";
import { NavLinks } from "@/components/navigation/nav-links";
import { ThemeSwitcher } from "@/components/navigation/theme-switcher";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { localizedHref, routes } from "@/config/navigation";
import { useI18n } from "@/lib/i18n/client";
import { Brand } from "./brand";

// Must match the `lg` breakpoint where the desktop navigation appears.
const DESKTOP_QUERY = "(min-width: 64rem)";

const secondaryLinkClassName =
  "flex min-h-12 items-center gap-3 px-6 text-sm text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-[1.125rem]";

/** Menu button + navigation drawer for mobile and tablet (hidden from lg up). */
export function MobileNav() {
  const { locale, messages } = useI18n();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // Links close the drawer themselves (onNavigate). Also close on browser
  // back/forward, and if the viewport grows to desktop so a hidden modal
  // can't leave the page inert (e.g. rotating a tablet).
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

      <Sheet open={open} onOpenChange={setOpen} label={messages.nav.menu} side="start">
        <div className="flex h-[var(--header-h)] shrink-0 items-center justify-between ps-6 pe-2">
          <Brand name={messages.site.name} size="sm" />
          <Button variant="ghost" size="icon" aria-label={messages.nav.closeMenu} onClick={close}>
            <X aria-hidden strokeWidth={1.5} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <nav aria-label={messages.nav.primary}>
            <NavLinks orientation="vertical" onNavigate={close} />
          </nav>
          <ul className="grid gap-1 py-4">
            <li>
              <Link
                href={localizedHref(locale, routes.account)}
                onClick={close}
                className={secondaryLinkClassName}
              >
                <UserRound aria-hidden strokeWidth={1.5} />
                {messages.nav.account}
              </Link>
            </li>
            <li>
              <Link
                href={localizedHref(locale, routes.cart)}
                onClick={close}
                className={secondaryLinkClassName}
              >
                <ShoppingBag aria-hidden strokeWidth={1.5} />
                {messages.nav.cart}
              </Link>
            </li>
          </ul>
        </div>
        <div className="grid gap-5 border-t p-6">
          <div>
            <p className="caps mb-3 text-[0.6875rem] font-medium">{messages.locale.label}</p>
            <LocaleSwitcher fullWidth />
          </div>
          <ThemeSwitcher fullWidth />
        </div>
      </Sheet>
    </div>
  );
}
