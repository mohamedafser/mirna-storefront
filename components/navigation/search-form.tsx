import { Search } from "lucide-react";
import Form from "next/form";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";

/**
 * Product search box. Submits ?q= to the Shop page (GET, works without JS);
 * Phase 6 wires the query to the catalogue.
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
  /** Runs before navigation (client callers only, e.g. to close a panel). */
  onSubmit?: () => void;
  className?: string;
}) {
  return (
    <Form
      action={localizedHref(locale, routes.products)}
      onSubmit={onSubmit}
      role="search"
      aria-label={t.label}
      className={cn("relative flex items-center border-b border-foreground/70", className)}
    >
      <label htmlFor="site-search" className="sr-only">
        {t.label}
      </label>
      <Search aria-hidden strokeWidth={1.5} className="pointer-events-none size-5 shrink-0" />
      <input
        id="site-search"
        type="search"
        name="q"
        placeholder={t.placeholder}
        autoComplete="off"
        enterKeyHint="search"
        autoFocus={autoFocus}
        className="h-14 min-w-0 flex-1 bg-transparent px-4 text-base outline-none placeholder:text-muted-foreground sm:text-lg"
      />
      <button
        type="submit"
        className="caps inline-flex h-11 items-center px-2 text-xs font-medium hover:opacity-70"
      >
        {t.submit}
      </button>
    </Form>
  );
}
