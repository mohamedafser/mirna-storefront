"use client";

import { Check, CircleAlert, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { buttonClassName } from "@/components/ui/button";
import { localizedHref, routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";

type Status = "shared" | "copied" | "error" | null;

/** How long the "Link copied" / "Shared" note stays (errors stay longer). */
const NOTE_MS = 2500;
const ERROR_MS = 8000;

/** Copies with the Clipboard API, else the legacy execCommand path (older / non-secure contexts). */
async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Permission denied or unfocused document: try the legacy path.
    }
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  const ok = document.execCommand("copy");
  field.remove();
  if (!ok) throw new Error("copy failed");
}

/**
 * Share a product: the system share sheet (Web Share API) where the device
 * has one, otherwise the product link is copied. Always the canonical URL
 * (NEXT_PUBLIC_SITE_URL + /<locale>/products/<slug>), the product name and,
 * when there is one, its short description. The outcome shows in a small
 * note under the button and is announced (live region). If nothing can be
 * copied, the note shows the link in a field to copy by hand.
 *
 * - "card": a round icon button over the product card image.
 * - "detail": an outlined button with text, on the product page.
 */
export function ShareButton({
  slug,
  name,
  description,
  variant = "card",
  className,
}: {
  slug: string;
  name: string;
  description?: string | null;
  variant?: "card" | "detail";
  className?: string;
}) {
  const { locale, messages } = useI18n();
  const t = messages.share;
  const [status, setStatus] = useState<Status>(null);
  const timer = useRef<number | undefined>(undefined);
  const url = new URL(localizedHref(locale, routes.product(slug)), siteConfig.url).href;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function show(next: Status) {
    window.clearTimeout(timer.current);
    setStatus(next);
    timer.current = window.setTimeout(() => setStatus(null), next === "error" ? ERROR_MS : NOTE_MS);
  }

  async function share() {
    const data: ShareData = { title: name, url, ...(description ? { text: description } : {}) };
    if (
      typeof navigator.share === "function" &&
      (!navigator.canShare || navigator.canShare(data))
    ) {
      try {
        await navigator.share(data);
        show("shared");
        return;
      } catch (error) {
        // Closed the share sheet: nothing to report.
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Not allowed here (e.g. no user activation): fall back to copying.
      }
    }
    try {
      await copyText(url);
      show("copied");
    } catch {
      show("error");
    }
  }

  const label = format(t.label, { name });
  const note = status && (
    <span
      className={cn(
        "absolute end-0 top-full z-10 mt-2 flex w-max max-w-[min(18rem,80vw)] animate-cart-item-in flex-col gap-2 border px-3 py-2 text-start text-xs font-normal tracking-normal normal-case shadow-sm",
        status === "error"
          ? "border-error/40 bg-popover text-popover-foreground"
          : "border-transparent bg-foreground text-background",
      )}
    >
      <span className="flex items-center gap-1.5">
        {status === "error" ? (
          <CircleAlert aria-hidden className="size-3.5 shrink-0 text-error" />
        ) : (
          <Check aria-hidden className="size-3.5 shrink-0" />
        )}
        {status === "error" ? t.failed : status === "copied" ? t.copied : t.shared}
      </span>
      {status === "error" && (
        <input
          readOnly
          value={url}
          dir="ltr"
          aria-label={t.linkLabel}
          onFocus={(event) => event.currentTarget.select()}
          className="w-64 max-w-full border bg-background px-2 py-1.5 text-xs text-foreground"
        />
      )}
    </span>
  );

  return (
    <span className={cn("relative inline-flex", className)}>
      {variant === "detail" ? (
        <button
          type="button"
          onClick={share}
          aria-label={label}
          className={buttonClassName({ variant: "outline", size: "lg", className: "px-4 sm:px-6" })}
        >
          <Share2 aria-hidden />
          {/* Icon only on narrow phones (beside the wishlist button); named by aria-label. */}
          <span aria-hidden className="hidden sm:inline">
            {t.share}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={share}
          aria-label={label}
          title={t.share}
          className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur-sm transition-[opacity,transform] hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-95"
        >
          <Share2 aria-hidden strokeWidth={1.5} className="size-[1.125rem]" />
        </button>
      )}
      {note}
      {/* Announced separately so screen readers hear it even if the note is skipped. */}
      <span aria-live="polite" className="sr-only">
        {status === "error" ? t.failed : status === "copied" ? t.copied : status ? t.shared : ""}
      </span>
    </span>
  );
}
