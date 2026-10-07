"use client";

import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Container } from "@/components/ui/container";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils/cn";
import { SITE_HEADER_ID } from "./header-state";
import { SearchForm } from "./search-form";

/**
 * Header "Search" control: a text link on desktop, an icon on mobile. It
 * reveals a full-width search panel under the header (and makes a transparent
 * header solid while open). Escape closes it and returns focus; submitting
 * a search closes it too.
 */
export function SearchToggle({ className }: { className?: string }) {
  const { locale, messages } = useI18n();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.getElementById(SITE_HEADER_ID)?.toggleAttribute("data-solid", open);
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? messages.search.close : messages.search.open}
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex h-11 min-w-11 items-center justify-center transition-opacity hover:opacity-70 lg:min-w-0",
          className,
        )}
      >
        <span aria-hidden className="lg:hidden">
          {open ? (
            <X strokeWidth={1.5} className="size-5" />
          ) : (
            <Search strokeWidth={1.5} className="size-5" />
          )}
        </span>
        <span aria-hidden className="caps hidden text-[0.6875rem] font-medium lg:inline">
          {messages.search.submit}
        </span>
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b bg-background py-6 text-foreground shadow-card"
      >
        {open && (
          <Container size="narrow">
            <SearchForm
              locale={locale}
              t={messages.search}
              autoFocus
              onSubmit={() => setOpen(false)}
            />
          </Container>
        )}
      </div>
    </>
  );
}
