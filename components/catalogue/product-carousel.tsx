"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils/cn";
import type { ProductCardData } from "@/types/domain";
import { ProductCard } from "./product-card";
import { StaggerList } from "./stagger-list";

/**
 * A titled row of product cards that scrolls sideways, boutique style: a
 * centred title, native scrolling with snap points (swipe, trackpad,
 * Shift+wheel, Tab through the cards) and round floating arrows that fade
 * out at either end. Phones show one centred card with its neighbours
 * peeking in; tablets about 2.3, desktop exactly 4 with the arrows just
 * outside the row. Cards rise in as they come into view (StaggerList).
 * Works in RTL: "next" always moves towards the inline end.
 */
export function ProductCarousel({
  products,
  title,
  action,
  heading = "ornament",
  className,
}: {
  products: ProductCardData[];
  title: string;
  /**
   * "ornament": small caps title with a short rule under it (page sections).
   * "plain": larger, widely spaced title on its own, for a bordered closing
   * section such as Recently viewed.
   */
  heading?: "ornament" | "plain";
  /** Extra control under the title (e.g. "Clear"). */
  action?: ReactNode;
  className?: string;
}) {
  const { locale, messages } = useI18n();
  const t = messages.catalogue;
  const id = useId();
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    // scrollLeft is 0 → negative in RTL, so use its magnitude.
    const offset = Math.abs(el.scrollLeft);
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ start: offset <= 4, end: offset >= max - 4 });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, products.length]);

  function scroll(direction: 1 | -1) {
    const el = track.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    const card = el.firstElementChild?.getBoundingClientRect().width || el.clientWidth;
    // A whole "page" of cards on desktop, one card on phones.
    const step = Math.max(card, Math.floor(el.clientWidth / card) * card);
    el.scrollBy({ left: direction * (rtl ? -1 : 1) * step, behavior: "smooth" });
  }

  const scrollable = !(edges.start && edges.end);
  const arrow = cn(
    "absolute top-[40%] z-10 inline-flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full sm:size-[2.8125rem]",
    "bg-card text-foreground shadow-[0_2px_10px_rgb(54_54_54/0.15)] transition-[opacity,scale,color] duration-300",
    "hover:scale-110 hover:text-muted-foreground",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    // At either end the arrow fades away instead of sitting there disabled.
    "disabled:pointer-events-none disabled:opacity-0",
    "[&_svg]:size-4 rtl:[&_svg]:-scale-x-100",
  );

  return (
    <section
      aria-labelledby={`${id}-title`}
      aria-roledescription={t.carousel}
      className={className}
    >
      <header
        className={cn("text-center", heading === "plain" ? "mb-[1.875rem]" : "mb-8 sm:mb-10")}
      >
        <h2
          id={`${id}-title`}
          className={
            heading === "plain"
              ? "text-[0.9375rem] font-medium tracking-[0.2em] uppercase sm:text-base"
              : "caps text-xs font-medium sm:text-[0.8125rem]"
          }
        >
          {title}
        </h2>
        {heading === "ornament" && (
          <span aria-hidden className="mx-auto mt-4 block h-px w-4 bg-current" />
        )}
        {action && <div className={heading === "plain" ? "mt-2" : "mt-4"}>{action}</div>}
      </header>

      <div className="relative">
        {/* Bleeds to the screen edge below desktop so neighbouring cards peek in. */}
        <StaggerList
          ref={track}
          id={`${id}-track`}
          onScroll={measure}
          className={cn(
            // overflow-x: auto would force overflow-y: auto too (CSS spec), so the
            // cards' 30px rise-in and hover zoom made the row scroll vertically.
            // Clip it; the padding keeps focus rings and the rise inside the box.
            "-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain pt-1 pb-3",
            // Phones: one centred card (62%), the neighbours peeking in either side.
            "px-[19%] *:snap-center",
            "sm:-mx-8 sm:scroll-px-8 sm:gap-6 sm:px-8 sm:*:snap-start lg:mx-0 lg:scroll-px-0 lg:gap-10 lg:px-0",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          {products.map((product) => (
            <li
              key={product.id}
              className="min-w-0 shrink-0 basis-[62%] sm:basis-[42%] md:basis-[30%] lg:basis-[calc((100%-7.5rem)/4)]"
            >
              <ProductCard product={product} locale={locale} t={t} headingLevel="h3" />
            </li>
          ))}
        </StaggerList>

        {scrollable && (
          <>
            <button
              type="button"
              className={cn(arrow, "start-2 lg:-start-11")}
              aria-label={t.scrollPrevious}
              aria-controls={`${id}-track`}
              disabled={edges.start}
              onClick={() => scroll(-1)}
            >
              <ChevronLeft aria-hidden strokeWidth={1.25} />
            </button>
            <button
              type="button"
              className={cn(arrow, "end-2 lg:-end-11")}
              aria-label={t.scrollNext}
              aria-controls={`${id}-track`}
              disabled={edges.end}
              onClick={() => scroll(1)}
            >
              <ChevronRight aria-hidden strokeWidth={1.25} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
