"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils/cn";
import { Button } from "./button";

/**
 * Centered modal built on <dialog>: focus trap, Escape, inert background,
 * focus return and top-layer stacking come from the browser (same approach as
 * Sheet).
 * Full-width bottom sheet on phones, centered card from sm up.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  /** false while a request is in flight: Escape / backdrop / ✕ do nothing. */
  dismissible?: boolean;
}) {
  const { messages } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        // Escape: keep it open while busy; otherwise close through React state.
        event.preventDefault();
        if (dismissible) onOpenChange(false);
      }}
      onClose={() => onOpenChange(false)}
      onClick={(event) => {
        if (dismissible && event.target === event.currentTarget) onOpenChange(false);
      }}
      className={cn(
        "m-auto mb-0 max-h-[92dvh] w-full max-w-none overflow-y-auto border bg-card p-0 text-card-foreground shadow-card sm:mb-auto sm:max-w-lg",
        "backdrop:bg-black/40 backdrop:backdrop-blur-[2px] open:animate-[fade-in_160ms_ease-out]",
        className,
      )}
    >
      {open && (
        <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="caps text-sm font-medium">
                {title}
              </h2>
              {description && (
                <div id={descriptionId} className="mt-1.5 text-sm text-muted-foreground">
                  {description}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={messages.common.close}
              disabled={!dismissible}
              onClick={() => onOpenChange(false)}
            >
              <X aria-hidden />
            </Button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
