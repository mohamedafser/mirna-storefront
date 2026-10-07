"use client";

import { Search, X } from "lucide-react";
import { useId } from "react";
import { catalogueHref, normalizeSearch, type CatalogueState } from "@/lib/catalogue/params";
import { useI18n } from "@/lib/i18n/client";
import { StateFields, useCatalogueNavigation, useUrlSyncedValue } from "./catalogue-navigation";

/**
 * Catalogue search (product name and slug, matched in PostgreSQL). Submitting
 * pushes ?q= and resets to page 1, keeping the category, price and sort.
 * The field follows the URL value, so Back/Forward restores its text.
 */
export function SearchInput({ path, state }: { path: string; state: CatalogueState }) {
  const { messages } = useI18n();
  const t = messages.catalogue;
  const { navigate } = useCatalogueNavigation();
  const inputId = useId();
  const [value, setValue] = useUrlSyncedValue(state.q);

  return (
    <form
      role="search"
      action={path}
      onSubmit={(event) => {
        event.preventDefault();
        navigate(catalogueHref(path, state, { q: normalizeSearch(value) }));
      }}
      className="relative flex items-center border-b border-foreground/70"
    >
      <label htmlFor={inputId} className="sr-only">
        {t.searchLabel}
      </label>
      <Search aria-hidden strokeWidth={1.5} className="pointer-events-none size-5 shrink-0" />
      <input
        id={inputId}
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t.searchPlaceholder}
        autoComplete="off"
        enterKeyHint="search"
        maxLength={100}
        className="h-12 min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground sm:text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      <StateFields state={state} omit={["q"]} />
      {state.q && (
        <button
          type="button"
          aria-label={t.clearSearch}
          onClick={() => navigate(catalogueHref(path, state, { q: "" }))}
          className="inline-flex size-11 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
      <button
        type="submit"
        className="caps inline-flex h-11 items-center px-2 text-[0.6875rem] font-medium hover:opacity-70"
      >
        {t.searchSubmit}
      </button>
    </form>
  );
}
