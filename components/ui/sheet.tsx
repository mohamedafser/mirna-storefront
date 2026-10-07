"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Side sheet built on a modal <dialog>: focus trap, Escape to close, an inert
 * background and focus return to the opener come from the browser. It slides
 * in from the inline-start or inline-end edge (mirrored in RTL) and respects
 * safe areas. Clicking the backdrop closes it.
 */
export function Sheet({
  open,
  onOpenChange,
  label,
  side = "start",
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  side?: "start" | "end";
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      data-side={side}
      // Escape or dialog.close() → keep React state in sync.
      onClose={() => onOpenChange(false)}
      onClick={(event) => event.target === event.currentTarget && onOpenChange(false)}
      className={cn(
        "drawer my-0 h-dvh max-h-dvh w-80 max-w-[88vw] bg-card p-0 text-card-foreground shadow-card",
        side === "start" ? "ms-0 me-auto border-e" : "ms-auto me-0 border-s",
        "backdrop:bg-black/40 backdrop:backdrop-blur-[2px]",
        className,
      )}
    >
      <div className="flex h-full flex-col pt-safe pb-safe">{children}</div>
    </dialog>
  );
}
