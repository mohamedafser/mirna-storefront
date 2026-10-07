"use client";

import { Languages } from "lucide-react";
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
}

/**
 * Links to the current page in each locale. Plain <a> (full navigation)
 * because switching locale swaps the root layout's lang/dir.
 * proxy.ts persists the choice in the NEXT_LOCALE cookie.
 * Inline segmented control (drawer, footer); the header uses LocaleMenu.
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
  pathname,
}: LocaleSwitcherProps & { pathname: string | null }) {
  const { locale: current, messages } = useI18n();

  return (
    <nav
      aria-label={messages.locale.label}
      className={cn(
        "items-center gap-1 border p-1",
        fullWidth ? "flex w-full" : "inline-flex",
        className,
      )}
    >
      <Languages aria-hidden className="mx-1.5 size-4 shrink-0 text-muted-foreground" />
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
              "flex h-10 items-center justify-center px-3 text-sm transition-colors",
              fullWidth && "flex-1",
              active
                ? "bg-foreground font-medium text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {localeConfig[locale].nativeName}
          </a>
        );
      })}
    </nav>
  );
}
