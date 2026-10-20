"use client";

import { ArrowRight, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Container } from "@/components/ui/container";
import { localizedHref, routes } from "@/config/navigation";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils/cn";
import type { NavCategory } from "@/types/domain";
import { headerActionClassName } from "./header-actions";
import { SITE_HEADER_ID } from "./header-state";
import { SearchForm } from "./search-form";

/** Category chips rise in one after another (globals.css: menu-item-in). */
function rise(step: number): CSSProperties {
  return { animation: `menu-item-in 450ms cubic-bezier(0.2,0.8,0.2,1) ${120 + step * 40}ms both` };
}

/**
 * Header search icon. It drops a search panel under the header (making a
 * transparent header solid while open) over a blurred backdrop: a large
 * search field, then the categories as shortcuts. Escape, the backdrop, the
 * icon, submitting or following a shortcut closes it; focus returns to the
 * icon on Escape. The page doesn't scroll behind the open panel.
 */
export function SearchToggle({
  categories = [],
  className,
}: {
  categories?: NavCategory[];
  className?: string;
}) {
  const { locale, messages } = useI18n();
  const t = messages.search;
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    document.getElementById(SITE_HEADER_ID)?.toggleAttribute("data-solid", open);
    if (!open) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      root.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? t.close : t.open}
        title={open ? t.close : t.open}
        onClick={() => setOpen(!open)}
        className={cn(headerActionClassName, "relative", className)}
      >
        <Search
          aria-hidden
          strokeWidth={1.5}
          className={cn(
            "size-5 transition-all duration-300",
            open ? "scale-50 rotate-90 opacity-0" : "scale-100 opacity-100",
          )}
        />
        <X
          aria-hidden
          strokeWidth={1.5}
          className={cn(
            "absolute size-5 transition-all duration-300",
            open ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-90 opacity-0",
          )}
        />
      </button>

      {open && (
        <div
          aria-hidden
          onClick={close}
          className="absolute inset-x-0 top-full h-dvh animate-[fade-in_250ms_ease-out] bg-black/35 backdrop-blur-sm"
        />
      )}
      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full max-h-[calc(100dvh-var(--header-h))] animate-[search-panel-in_350ms_cubic-bezier(0.2,0.8,0.2,1)] overflow-y-auto border-b bg-background pt-8 pb-10 text-foreground shadow-card sm:pt-12 sm:pb-14"
      >
        {open && (
          <Container size="narrow">
            <SearchForm locale={locale} t={t} autoFocus onSubmit={close} />

            <p className="mt-3 hidden text-xs text-muted-foreground lg:block">
              <kbd className="me-1.5 border px-1.5 py-0.5 font-sans text-[0.625rem] tracking-wide">
                Esc
              </kbd>
              {t.escHint}
            </p>

            {categories.length > 0 && (
              <div className="mt-10">
                <h2 className="caps text-[0.6875rem] font-medium text-muted-foreground">
                  {t.browse}
                </h2>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {categories.map((category, index) => (
                    <li key={category.slug} style={rise(index)}>
                      <Link
                        href={localizedHref(locale, routes.category(category.slug))}
                        onClick={close}
                        className="inline-flex h-10 items-center border px-4 text-sm transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
                      >
                        {category.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Link
              href={localizedHref(locale, routes.products)}
              onClick={close}
              style={rise(categories.length)}
              className="caps group mt-8 inline-flex items-center gap-2 text-[0.6875rem] font-medium underline-offset-4 hover:underline"
            >
              {t.allProducts}
              <ArrowRight
                aria-hidden
                strokeWidth={1.5}
                className="size-4 transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1"
              />
            </Link>
          </Container>
        )}
      </div>
    </>
  );
}
