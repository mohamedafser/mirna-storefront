"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { hasActiveFilters } from "@/lib/catalogue/params";
import { useI18n } from "@/lib/i18n/client";
import { CatalogueFilters, type CatalogueFiltersProps } from "./catalogue-filters";

// Must match the `lg` breakpoint where the filter sidebar appears.
const DESKTOP_QUERY = "(min-width: 64rem)";

/**
 * "Filter" button + drawer for phones and tablets (the sidebar replaces it
 * from lg up). Built on Sheet (<dialog>): focus trap, Escape, focus return
 * and an inert background. It slides in from the inline-end edge, mirrored
 * in RTL, and closes when a filter is applied.
 */
export function FilterDrawer(props: Omit<CatalogueFiltersProps, "onNavigate">) {
  const { messages } = useI18n();
  const t = messages.catalogue;
  const [open, setOpen] = useState(false);
  const active = hasActiveFilters(props.state) || props.activeCategory !== null;

  // Close on Back/Forward, and if the viewport grows to desktop so a hidden
  // modal can't leave the page inert.
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
      <Button
        variant="outline"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="h-11 border-border"
      >
        <SlidersHorizontal aria-hidden />
        {t.showFilters}
        {active && (
          <>
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            <span className="sr-only">({t.activeFilters})</span>
          </>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen} label={t.filters} side="end">
        <div className="flex h-[var(--header-h)] shrink-0 items-center justify-between border-b ps-6 pe-2">
          <p className="caps text-xs font-medium">{t.filters}</p>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.closeFilters}
            onClick={() => setOpen(false)}
          >
            <X aria-hidden strokeWidth={1.5} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {open && <CatalogueFilters {...props} onNavigate={() => setOpen(false)} />}
        </div>
      </Sheet>
    </div>
  );
}
