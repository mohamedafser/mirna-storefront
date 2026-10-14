"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

const INTERVAL_MS = 6000;
/** Slow "Ken Burns" drift, a little longer than a slide is shown. */
const ZOOM_MS = INTERVAL_MS + 1000;
const ZOOM_SCALE = 1.08;

/**
 * Hero background: the uploaded images stacked and cross-faded every few
 * seconds, each slowly zooming while it shows (even slides zoom in, odd ones
 * zoom out). The zoom is a long transform transition, so a slide fading out
 * keeps drifting instead of jumping back. One image shows still apart from
 * its zoom. Auto-advance pauses while the tab is hidden; reduced motion turns
 * off auto-advance and (globals.css) the zoom. The dots switch slides by hand.
 */
export function HeroSlideshow({
  slides,
  slideLabel,
}: {
  slides: string[];
  /** "Show slide {n}" */
  slideLabel: string;
}) {
  const [current, setCurrent] = useState(0);
  // Zoom starts after the first paint, so the first slide animates too.
  const [moving, setMoving] = useState(false);
  const count = slides.length;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMoving(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setCurrent((index) => (index + 1) % count);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [count, current]);

  return (
    <>
      {slides.map((src, index) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          priority={index === 0}
          sizes="100vw"
          className={cn("-z-20 object-cover", index === current ? "opacity-100" : "opacity-0")}
          style={{
            // Opacity cross-fades in 1s; the zoom drifts for the whole slide.
            transition: `opacity 1000ms ease-in-out, transform ${ZOOM_MS}ms cubic-bezier(0.25, 0.1, 0.25, 1)`,
            transform: `scale(${zoomFor(index, moving && index === current)})`,
          }}
        />
      ))}
      {count > 1 && (
        <div className="absolute inset-x-0 bottom-5 flex justify-center gap-2 sm:bottom-8">
          {slides.map((src, index) => (
            <button
              key={src}
              type="button"
              aria-label={slideLabel.replace("{n}", String(index + 1))}
              aria-current={index === current ? "true" : undefined}
              onClick={() => setCurrent(index)}
              className="grid size-6 place-items-center"
            >
              <span
                aria-hidden
                className={cn(
                  "block h-0.5 w-6 bg-white transition-opacity",
                  index === current ? "opacity-100" : "opacity-40 hover:opacity-70",
                )}
              />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** Even slides zoom in while shown (1 → 1.08), odd slides zoom out (1.08 → 1). */
function zoomFor(index: number, showing: boolean): number {
  const zoomIn = index % 2 === 0;
  return zoomIn === showing ? ZOOM_SCALE : 1;
}
