"use client";

import { ArrowRight, Search, X } from "lucide-react";
import Form from "next/form";
import { useRef, useState } from "react";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";

/**
 * Product search box. Submits ?q= to the Shop page (GET, works without JS).
 * A clear button appears once something is typed; the submit arrow lights
 * up at the same time.
 */
export function SearchForm({
  locale,
  t,
  autoFocus,
  onSubmit,
  className,
}: {
  locale: Locale;
  t: Messages["search"];
  autoFocus?: boolean;
  /** Runs before navigation (e.g. to close a panel). */
  onSubmit?: () => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const hasQuery = query.trim().length > 0;

  return (
    <Form
      action={localizedHref(locale, routes.products)}
      onSubmit={onSubmit}
      role="search"
      aria-label={t.label}
      className={cn(
        "group relative flex items-center gap-3 border-b border-foreground/25 transition-colors focus-within:border-foreground",
        className,
      )}
    >
      <label htmlFor="site-search" className="sr-only">
        {t.label}
      </label>
      <Search
        aria-hidden
        strokeWidth={1.25}
        className="pointer-events-none size-6 shrink-0 text-muted-foreground transition-colors group-focus-within:text-foreground"
      />
      <input
        ref={inputRef}
        id="site-search"
        type="search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t.placeholder}
        autoComplete="off"
        enterKeyHint="search"
        autoFocus={autoFocus}
        className="h-16 min-w-0 flex-1 bg-transparent font-display text-2xl outline-none placeholder:text-muted-foreground/60 sm:h-20 sm:text-3xl [&::-webkit-search-cancel-button]:hidden"
      />
      {hasQuery && (
        <button
          type="button"
          aria-label={t.clear}
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          className="inline-flex size-9 shrink-0 animate-[fade-in_150ms_ease-out] items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <X aria-hidden strokeWidth={1.5} className="size-4" />
        </button>
      )}
      <button
        type="submit"
        aria-label={t.submit}
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center border transition-all duration-200",
          hasQuery
            ? "border-foreground bg-foreground text-background hover:opacity-85"
            : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
        )}
      >
        <ArrowRight aria-hidden strokeWidth={1.5} className="size-5 rtl:-scale-x-100" />
      </button>
    </Form>
  );
}
