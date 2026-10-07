"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useCallback, useState, useTransition, type ReactNode } from "react";
import { DEFAULT_SORT, PARAM, type CatalogueState } from "@/lib/catalogue/params";
import { cn } from "@/lib/utils/cn";

interface CatalogueNavigationValue {
  pending: boolean;
  /** Pushes a new catalogue URL (a history entry, so Back undoes it). */
  navigate: (href: string) => void;
}

const CatalogueNavigationContext = createContext<CatalogueNavigationValue | null>(null);

/**
 * Shared transition for search, sort and filter changes. The URL stays the
 * only state: controls push a new URL, the Server Component re-renders with
 * the new searchParams, and `pending` dims the current results meanwhile.
 * Scroll position is kept so the controls stay where the user left them.
 */
export function CatalogueNavigation({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = useCallback(
    (href: string) => startTransition(() => router.push(href, { scroll: false })),
    [router],
  );
  return (
    <CatalogueNavigationContext value={{ pending, navigate }}>
      {children}
    </CatalogueNavigationContext>
  );
}

export function useCatalogueNavigation(): CatalogueNavigationValue {
  const value = use(CatalogueNavigationContext);
  if (!value) throw new Error("useCatalogueNavigation must be used within <CatalogueNavigation>");
  return value;
}

/** Wraps the results; busy (dimmed, announced) while new results load. */
export function CatalogueResults({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const { pending } = useCatalogueNavigation();
  return (
    <div
      aria-busy={pending}
      className={cn("transition-opacity duration-200", pending && "opacity-50", className)}
    >
      <p role="status" className="sr-only">
        {pending ? label : ""}
      </p>
      {children}
    </div>
  );
}

/**
 * Hidden fields carrying the rest of the catalogue state, so the GET forms
 * also work before JavaScript loads (the page resets to 1 by omission).
 */
export function StateFields({
  state,
  omit,
}: {
  state: CatalogueState;
  omit: ReadonlyArray<keyof CatalogueState>;
}) {
  const fields: [string, string | null][] = [
    [PARAM.q, omit.includes("q") ? null : state.q || null],
    [PARAM.category, omit.includes("category") ? null : state.category],
    [PARAM.minPrice, omit.includes("minPrice") ? null : state.minPrice],
    [PARAM.maxPrice, omit.includes("maxPrice") ? null : state.maxPrice],
    [PARAM.sort, omit.includes("sort") || state.sort === DEFAULT_SORT ? null : state.sort],
  ];
  return fields.map(([name, value]) =>
    value ? <input key={name} type="hidden" name={name} value={value} /> : null,
  );
}

/**
 * Local field value that follows the URL: editable immediately, and reset
 * whenever the URL value changes (Back/Forward, clear buttons). Adjusting
 * state during render keeps the element mounted, so focus is never lost.
 */
export function useUrlSyncedValue<T>(urlValue: T): [T, (value: T) => void] {
  const [value, setValue] = useState(urlValue);
  const [synced, setSynced] = useState(urlValue);
  if (synced !== urlValue) {
    setSynced(urlValue);
    setValue(urlValue);
  }
  return [value, setValue];
}
