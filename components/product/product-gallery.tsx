"use client";

import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import Image from "next/image";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";
import type { ProductDetail } from "@/types/domain";

const SWIPE_THRESHOLD = 40;

/**
 * Hover magnifier (desktop, mouse): a lens over the image and a zoom pane
 * beside it showing the lens area ZOOM× larger. The pane is PANE_WIDTH of the
 * image's width (so it fits over the narrower info column) and the same
 * height; the lens is the pane's size divided by ZOOM, so both match.
 */
const ZOOM = 2.5;
const PANE_WIDTH = 0.85;
const LENS = { width: PANE_WIDTH / ZOOM, height: 1 / ZOOM };
const MAGNIFIER_QUERY = "(min-width: 64rem) and (hover: hover) and (pointer: fine)";

/**
 * Product image gallery (no carousel library):
 *   lg+  : thumbnail column at the inline start | large selected image
 *   < lg : large image (swipe or arrow buttons) + scrollable thumbnail row
 * Thumbnails are buttons with a visible selected state; arrow keys move
 * between them (mirrored in RTL). The large image shows a pulse until it has
 * loaded. On desktop, hovering with a mouse shows a lens and a magnified view
 * of that area beside the image (a sharper copy loads on first hover). With
 * no images it renders the storefront placeholder.
 */
export function ProductGallery({
  name,
  images,
}: {
  name: string;
  images: ProductDetail["images"];
}) {
  const { dir, messages } = useI18n();
  const t = messages.product;
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  // Magnifier visible (mouse over the image on desktop).
  const [magnifying, setMagnifying] = useState(false);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const swipeStart = useRef<number | null>(null);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center bg-brand-soft text-muted-foreground">
        <ImageOff aria-hidden strokeWidth={1} className="size-10" />
        <span className="sr-only">{messages.catalogue.noImage}</span>
      </div>
    );
  }

  const total = images.length;
  const current = images[index];
  const altFor = (i: number) =>
    images[i].alt ?? (i === 0 ? name : format(t.imageAlt, { name, index: i + 1 }));
  const select = (next: number, focus = false) => {
    const wrapped = (next + total) % total;
    setIndex(wrapped);
    if (focus) thumbs.current[wrapped]?.focus();
  };

  // Visual direction: "forward" is to the right in LTR and to the left in RTL.
  const step = (key: string) =>
    key === "ArrowDown" || key === (dir === "rtl" ? "ArrowLeft" : "ArrowRight")
      ? 1
      : key === "ArrowUp" || key === (dir === "rtl" ? "ArrowRight" : "ArrowLeft")
        ? -1
        : 0;

  function onThumbKeyDown(event: KeyboardEvent) {
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      select(event.key === "Home" ? 0 : total - 1, true);
      return;
    }
    const delta = step(event.key);
    if (delta !== 0) {
      event.preventDefault();
      select(index + delta, true);
    }
  }

  function onPointerUp(event: PointerEvent) {
    if (swipeStart.current === null) return;
    const dx = event.clientX - swipeStart.current;
    swipeStart.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    // Swiping toward the reading start reveals the next image.
    const forward = dir === "rtl" ? dx > 0 : dx < 0;
    select(index + (forward ? 1 : -1));
  }

  // Centres the lens on the cursor (kept inside the image) and moves the
  // magnified view to match. Writes CSS variables on the wrapper, so following
  // the mouse never re-renders the gallery.
  function onMagnifierMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    const lensWidth = box.width * LENS.width;
    const lensHeight = box.height * LENS.height;
    const x = Math.min(
      Math.max(event.clientX - box.left - lensWidth / 2, 0),
      box.width - lensWidth,
    );
    const y = Math.min(
      Math.max(event.clientY - box.top - lensHeight / 2, 0),
      box.height - lensHeight,
    );
    const wrapper = event.currentTarget.parentElement;
    wrapper?.style.setProperty("--lens-x", `${x}px`);
    wrapper?.style.setProperty("--lens-y", `${y}px`);
  }

  const arrowClassName =
    "absolute top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center bg-background/85 text-foreground backdrop-blur-sm transition-opacity hover:bg-background focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100";

  return (
    <section
      aria-label={t.gallery}
      // The thumbnail column exists only with 2+ images; otherwise the large
      // image would fall into the narrow first column.
      className={cn("grid gap-3 lg:gap-4", total > 1 && "lg:grid-cols-[4.5rem_minmax(0,1fr)]")}
    >
      <div className="relative lg:order-2">
        <div
          className="group relative aspect-[4/5] touch-pan-y overflow-hidden bg-brand-soft lg:pointer-fine:cursor-crosshair"
          onPointerDown={(event) => {
            if (event.pointerType !== "mouse") swipeStart.current = event.clientX;
          }}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (swipeStart.current = null)}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse" && window.matchMedia(MAGNIFIER_QUERY).matches) {
              onMagnifierMove(event);
              setMagnifying(true);
            }
          }}
          onPointerMove={onMagnifierMove}
          onPointerLeave={() => setMagnifying(false)}
        >
          {!loaded[current.id] && (
            <div aria-hidden className="absolute inset-0 animate-pulse bg-muted" />
          )}
          <Image
            key={current.id}
            src={current.url}
            alt={altFor(index)}
            fill
            priority={index === 0}
            sizes="(min-width: 1024px) 45vw, 100vw"
            onLoad={() => setLoaded((state) => ({ ...state, [current.id]: true }))}
            className={cn(
              "object-cover transition-opacity duration-300",
              loaded[current.id] ? "opacity-100" : "opacity-0",
            )}
          />
          {magnifying && (
            // Lens: the area shown in the zoom pane (physical px from the cursor).
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 left-0 border border-white/80 bg-white/15 shadow-[0_0_0_1px_rgb(0_0_0/0.15)]"
              style={{
                width: `${LENS.width * 100}%`,
                height: `${LENS.height * 100}%`,
                transform: "translate(var(--lens-x), var(--lens-y))",
              }}
            />
          )}
          {total > 1 && (
            <>
              <button
                type="button"
                aria-label={t.previousImage}
                onClick={() => select(index - 1)}
                className={cn(arrowClassName, "start-3")}
              >
                <ChevronLeft aria-hidden className="size-5 rtl:-scale-x-100" />
              </button>
              <button
                type="button"
                aria-label={t.nextImage}
                onClick={() => select(index + 1)}
                className={cn(arrowClassName, "end-3")}
              >
                <ChevronRight aria-hidden className="size-5 rtl:-scale-x-100" />
              </button>
              <p
                aria-live="polite"
                className="absolute end-3 bottom-3 bg-background/85 px-2 py-1 text-xs text-foreground tabular-nums"
              >
                {format(t.imageCount, { index: index + 1, total })}
              </p>
            </>
          )}
        </div>

        {magnifying && (
          // Zoom pane over the info column (inline end, so it mirrors in RTL).
          // The image inside is ZOOM× the main image and shifted by the lens
          // position; it is decorative (the main image has the alt text).
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 z-30 h-full overflow-hidden border bg-card shadow-elevated start-[calc(100%+1.5rem)]"
            style={{ width: `${PANE_WIDTH * 100}%` }}
          >
            <div
              className="absolute top-0 left-0"
              style={{
                width: `${(ZOOM / PANE_WIDTH) * 100}%`,
                height: `${ZOOM * 100}%`,
                transform: `translate(calc(var(--lens-x) * -${ZOOM}), calc(var(--lens-y) * -${ZOOM}))`,
              }}
            >
              <Image
                key={`${current.id}-zoom`}
                src={current.url}
                alt=""
                fill
                sizes="120vw"
                className="object-cover"
              />
            </div>
          </div>
        )}
      </div>

      {total > 1 && (
        <ul
          className="flex gap-2 overflow-x-auto pb-1 lg:order-1 lg:flex-col lg:overflow-visible lg:pb-0"
          onKeyDown={onThumbKeyDown}
        >
          {images.map((image, i) => (
            <li key={image.id} className="shrink-0">
              <button
                ref={(element) => {
                  thumbs.current[i] = element;
                }}
                type="button"
                aria-label={format(t.showImage, { index: i + 1, total })}
                aria-current={i === index ? "true" : undefined}
                onClick={() => select(i)}
                className={cn(
                  "relative block aspect-[4/5] w-16 overflow-hidden border-2 bg-brand-soft transition-[border-color,opacity] lg:w-full",
                  i === index
                    ? "border-foreground"
                    : "border-transparent opacity-70 hover:opacity-100",
                )}
              >
                <Image src={image.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
