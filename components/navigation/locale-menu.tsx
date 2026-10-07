"use client";

import { Check } from "lucide-react";
import { usePathname } from "next/navigation";
import { Dropdown, dropdownItemClassName } from "@/components/ui/dropdown";
import { localeConfig, locales } from "@/config/i18n";
import { useI18n } from "@/lib/i18n/client";
import { switchLocaleHref } from "@/lib/i18n/switch-locale";
import { cn } from "@/lib/utils/cn";
import { headerActionClassName } from "./header-actions";

/**
 * Header button (EN / ع) that opens a language popover. Options are
 * plain <a> links (full navigation) because switching locale swaps the root
 * layout's lang/dir; proxy.ts persists the choice in the NEXT_LOCALE cookie.
 */
export function LocaleMenu() {
  const { locale: current, messages } = useI18n();

  return (
    <Dropdown
      label={messages.locale.label}
      triggerClassName={cn(headerActionClassName, "caps text-[0.6875rem] font-medium")}
      trigger={<span aria-hidden>{localeConfig[current].shortName}</span>}
      panelClassName="w-48"
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
  return (
    <ul aria-label={messages.locale.label} className="grid gap-0.5">
      {locales.map((locale) => {
        const active = locale === current;
        return (
          <li key={locale}>
            <a
              href={switchLocaleHref(pathname, locale)}
              hrefLang={locale}
              lang={locale}
              aria-current={active ? "true" : undefined}
              className={cn(dropdownItemClassName, active && "font-medium")}
            >
              <span className="flex-1">{localeConfig[locale].nativeName}</span>
              {active && <Check aria-hidden className="text-primary!" />}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
