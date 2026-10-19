"use client";

import { Check, Globe } from "lucide-react";
import { usePathname } from "next/navigation";
import { Dropdown } from "@/components/ui/dropdown";
import { localeConfig, locales } from "@/config/i18n";
import { toIntlLocale } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { switchLocaleHref } from "@/lib/i18n/switch-locale";
import { cn } from "@/lib/utils/cn";
import { headerActionClassName } from "./header-actions";

/**
 * Header button (globe + EN / ع) that opens a language popover. Options are
 * plain <a> links (full navigation) because switching locale swaps the root
 * layout's lang/dir; proxy.ts persists the choice in the NEXT_LOCALE cookie.
 */
export function LocaleMenu() {
  const { locale: current, messages } = useI18n();

  return (
    <Dropdown
      label={messages.locale.label}
      triggerClassName={cn(headerActionClassName, "caps gap-1.5 text-[0.6875rem] font-medium")}
      trigger={
        <>
          <Globe aria-hidden strokeWidth={1.5} className="size-4" />
          <span aria-hidden>{localeConfig[current].shortName}</span>
        </>
      }
      panelClassName="w-64"
    >
      {() => <LocaleOptions />}
    </Dropdown>
  );
}

// Rendered only while the menu is open (client-side), so reading the URL here
// never blocks prerendering.
function LocaleOptions() {
  const { locale: current, messages } = useI18n();
  const pathname = usePathname();
  // Each language's name in the current interface language ("Arabic" / "الإنجليزية").
  const names = new Intl.DisplayNames(toIntlLocale(current), { type: "language" });

  return (
    <div>
      <p className="caps border-b px-3 pt-1.5 pb-3 text-[0.625rem] font-medium text-muted-foreground">
        {messages.locale.label}
      </p>
      <ul aria-label={messages.locale.label} className="grid gap-0.5 pt-1.5">
        {locales.map((locale) => {
          const active = locale === current;
          const translated = names.of(locale);
          return (
            <li key={locale}>
              <a
                href={switchLocaleHref(pathname, locale)}
                hrefLang={locale}
                lang={locale}
                aria-current={active ? "true" : undefined}
                className="group/option flex items-center gap-3 px-3 py-2.5 transition-colors outline-none hover:bg-accent focus-visible:bg-accent"
              >
                {/* Round badge with the short code; filled for the current language. */}
                <span
                  aria-hidden
                  className={cn(
                    "caps grid size-9 shrink-0 place-items-center rounded-full border text-[0.625rem] font-semibold transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "group-hover/option:border-foreground",
                  )}
                >
                  {localeConfig[locale].shortName}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm", active && "font-medium")}>
                    {localeConfig[locale].nativeName}
                  </span>
                  {translated && translated !== localeConfig[locale].nativeName && (
                    <span lang={current} className="block text-xs text-muted-foreground">
                      {translated}
                    </span>
                  )}
                </span>
                {active && <Check aria-hidden className="size-4 shrink-0 text-primary" />}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
