"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { localeConfig, locales } from "@/config/i18n";
import { useI18n } from "@/lib/i18n/client";
import { switchLocaleHref } from "@/lib/i18n/switch-locale";
import { cn } from "@/lib/utils/cn";

interface LocaleSwitcherProps {
  className?: string;
  /** Stretch to the container with equal segments (drawers). */
  fullWidth?: boolean;
  /** "inverse": on the burgundy header colours (footer). */
  tone?: "default" | "inverse";
}

/**
 * Links to the current page in each locale. Plain <a> (full navigation)
 * because switching locale swaps the root layout's lang/dir.
 * proxy.ts persists the choice in the NEXT_LOCALE cookie.
 * Inline pill-shaped segmented control (drawer, footer): each language with
 * its short code, the current one on a filled highlight; the header uses
 * LocaleMenu.
 *
 * The current URL is read behind <Suspense> so routes whose path is only
 * known at request time (404s, /categories/[slug]) can still prerender.
 */
export function LocaleSwitcher(props: LocaleSwitcherProps) {
  return (
    <Suspense fallback={<LocaleSwitcherView {...props} pathname={null} />}>
      <CurrentLocaleSwitcher {...props} />
    </Suspense>
  );
}

function CurrentLocaleSwitcher(props: LocaleSwitcherProps) {
  return <LocaleSwitcherView {...props} pathname={usePathname()} />;
}

function LocaleSwitcherView({
  className,
  fullWidth = false,
  tone = "default",
  pathname,
}: LocaleSwitcherProps & { pathname: string | null }) {
  const inverse = tone === "inverse";
  const { locale: current, messages } = useI18n();
  const index = Math.max(locales.indexOf(current), 0);

  return (
    <nav
      aria-label={messages.locale.label}
      className={cn(
        "relative grid items-center rounded-full border p-1",
        inverse && "border-header-border",
        fullWidth ? "w-full" : "w-fit",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${locales.length}, minmax(0, 1fr))` }}
    >
      {/* Highlight behind the current language (one segment wide; mirrored in RTL). */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1 start-1 rounded-full transition-transform duration-300 ease-out",
          inverse ? "bg-header-foreground" : "bg-foreground",
        )}
        style={{
          width: `calc((100% - 0.5rem) / ${locales.length})`,
          // The page direction is the current locale's: RTL moves the other way.
          translate: `${index * 100 * (localeConfig[current].dir === "rtl" ? -1 : 1)}% 0`,
        }}
      />
      {locales.map((locale) => {
        const active = locale === current;
        return (
          <a
            key={locale}
            href={switchLocaleHref(pathname, locale)}
            hrefLang={locale}
            lang={locale}
            aria-current={active ? "true" : undefined}
            className={cn(
              "relative flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm whitespace-nowrap transition-colors",
              active
                ? inverse
                  ? "font-medium text-header"
                  : "font-medium text-background"
                : inverse
                  ? "text-header-foreground/70 hover:text-header-foreground"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span aria-hidden className="caps text-[0.5625rem] font-semibold opacity-60">
              {localeConfig[locale].shortName}
            </span>
            {localeConfig[locale].nativeName}
          </a>
        );
      })}
    </nav>
  );
}
