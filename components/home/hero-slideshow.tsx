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
        // Story-style progress: a counter and one thin bar per slide; the current
        // bar fills over the slide's duration (restarted on every change).
        <div className="absolute end-5 bottom-6 z-10 flex items-center gap-4 sm:end-8 sm:bottom-8 lg:end-12 lg:bottom-10">
          <p aria-hidden className="text-[0.6875rem] font-medium tracking-[0.15em] tabular-nums">
            {pad(current + 1)}
            <span className="mx-1.5 opacity-60">/</span>
            <span className="opacity-60">{pad(count)}</span>
          </p>
          <div className="flex">
            {slides.map((src, index) => (
              <button
                key={src}
                type="button"
                aria-label={slideLabel.replace("{n}", String(index + 1))}
                aria-current={index === current ? "true" : undefined}
                onClick={() => setCurrent(index)}
                className="group/bar flex h-6 cursor-pointer items-center px-1"
              >
                <span
                  aria-hidden
                  className="relative block h-0.5 w-7 overflow-hidden bg-white/35 transition-colors group-hover/bar:bg-white/60 sm:w-10"
                >
                  {index === current && (
                    <span
                      key={current}
                      className="absolute inset-0 origin-[left_center] animate-hero-progress bg-white rtl:origin-[right_center]"
                    />
                  )}
                  {index < current && <span className="absolute inset-0 bg-white/80" />}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Even slides zoom in while shown (1 → 1.08), odd slides zoom out (1.08 → 1). */
function zoomFor(index: number, showing: boolean): number {
  const zoomIn = index % 2 === 0;
  return zoomIn === showing ? ZOOM_SCALE : 1;
}
