"use client";

import { Check, ChevronDown } from "lucide-react";
import type { KeyboardEvent } from "react";
import { Dropdown, dropdownItemClassName } from "@/components/ui/dropdown";
import {
  catalogueHref,
  SORT_OPTIONS,
  type CatalogueState,
  type SortOption,
} from "@/lib/catalogue/params";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils/cn";
import { useCatalogueNavigation, useUrlSyncedValue } from "./catalogue-navigation";

/**
 * Custom "Sort by" dropdown built on the shared Dropdown (same pattern as the
 * language and theme menus): a labelled trigger button and a panel of
 * options. The selected option is marked with a check and aria-current and
 * gets focus when the panel opens. ↑/↓/Home/End move between options, Escape
 * or an outside click closes it, and choosing an option pushes ?sort= (page
 * resets to 1). The panel opens from the inline end, so it mirrors in RTL.
 */
export function SortSelect({ path, state }: { path: string; state: CatalogueState }) {
  const { messages } = useI18n();
  const t = messages.catalogue;
  const { navigate } = useCatalogueNavigation();
  // Shows the choice at once while the new results load; resyncs on Back/Forward.
  const [value, setValue] = useUrlSyncedValue(state.sort);

  function choose(sort: SortOption, close: () => void, item: HTMLElement) {
    // Return focus to the trigger: the chosen item unmounts with the panel.
    item.closest("[data-sort-select]")?.querySelector<HTMLElement>("[aria-expanded]")?.focus();
    close();
    if (sort === value) return;
    setValue(sort);
    navigate(catalogueHref(path, state, { sort }));
  }

  // Arrow-key navigation between the option buttons.
  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "ArrowDown"
        ? (current + 1) % items.length
        : event.key === "ArrowUp"
          ? (current - 1 + items.length) % items.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    items[next]?.focus();
  }

  return (
    <div data-sort-select className="flex items-center gap-3">
      <span aria-hidden className="caps shrink-0 text-[0.625rem] text-muted-foreground">
        {t.sortLabel}
      </span>
      <Dropdown
        label={`${t.sortLabel}: ${t.sortOptions[value]}`}
        triggerClassName="group inline-flex h-11 max-w-[13rem] items-center gap-3 border border-border bg-card ps-3 pe-2.5 text-sm text-foreground transition-colors hover:border-input aria-expanded:border-foreground sm:max-w-none"
        trigger={
          <>
            <span className="truncate">{t.sortOptions[value]}</span>
            <ChevronDown
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform group-aria-expanded:rotate-180"
            />
          </>
        }
        panelClassName="w-60"
      >
        {(close) => (
          <ul aria-label={t.sortLabel} className="grid gap-0.5" onKeyDown={onKeyDown}>
            {SORT_OPTIONS.map((option) => {
              const selected = option === value;
              return (
                <li key={option}>
                  <button
                    type="button"
                    aria-current={selected ? "true" : undefined}
                    data-autofocus={selected ? "" : undefined}
                    onClick={(event) => choose(option, close, event.currentTarget)}
                    className={cn(dropdownItemClassName, selected && "font-medium")}
                  >
                    <span className="flex-1">{t.sortOptions[option]}</span>
                    {selected && <Check aria-hidden className="text-primary!" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Dropdown>
    </div>
  );
}
