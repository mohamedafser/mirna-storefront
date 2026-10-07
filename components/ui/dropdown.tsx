"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Disclosure-style dropdown panel (button + popup). Accessible pattern for a
 * panel that mixes links, buttons and form controls:
 * - trigger is a real <button> with aria-expanded / aria-controls
 * - Escape closes and returns focus to the trigger
 * - clicking outside closes it; items call close() when chosen
 * - focus moves into the panel when it opens; Tab order is natural
 * Anchored to the inline-end edge, so it opens toward the start in RTL too.
 */
export function Dropdown({
  label,
  trigger,
  children,
  triggerClassName,
  panelClassName,
}: {
  /** Accessible name for the trigger button. */
  label: string;
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  triggerClassName?: string;
  panelClassName?: string;
}) {
  const [open, setOpenState] = useState(false);
  // Mirrors `open` synchronously so document listeners never see stale state.
  const openRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const setOpen = useCallback((value: boolean) => {
    openRef.current = value;
    setOpenState(value);
  }, []);

  useLayoutEffect(() => {
    openRef.current = open;
  }, [open]);

  // Document listeners live for the component's lifetime (not per open), so
  // an outside click is handled no matter how soon it follows opening.
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (openRef.current && !rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (openRef.current && event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [setOpen]);

  // Move focus into the panel when it opens: an item marked data-autofocus
  // (e.g. the selected option), else the first focusable item.
  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    (
      panel?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel?.querySelector<HTMLElement>("a[href], button:not([disabled]), input:not([disabled])")
    )?.focus();
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          className={cn(
            "absolute end-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] origin-top border bg-popover p-1.5 text-popover-foreground shadow-card",
            panelClassName,
          )}
        >
          {children(() => setOpenState(false))}
        </div>
      )}
    </div>
  );
}

/** Row inside a Dropdown panel (use with Link, <a> or <button>). */
export const dropdownItemClassName =
  "flex w-full items-center gap-3 px-3 py-2.5 text-start text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";
