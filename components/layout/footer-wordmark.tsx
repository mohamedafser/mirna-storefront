"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * The brand name set very large across the footer's full width, sitting on
 * its bottom edge (decorative: hidden from screen readers, the logo above
 * names the site). The letters are outlined; hovering the wordmark fills
 * their inside from the bottom up, letter after letter. When it scrolls
 * into view the letters rise out of the edge one after another.
 *
 * All styling lives in globals.css (.wordmark-letter, [data-wordmark]); the
 * hidden start state only applies with JavaScript on and without reduced
 * motion, so the wordmark is never stuck invisible. Letters are spread edge to edge (justify-between)
 * so the word always spans the width, whatever the font's metrics.
 */
export function FooterWordmark({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        element.dataset.revealed = "";
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const letters = [...text.toUpperCase()];
  return (
    <div
      ref={ref}
      aria-hidden
      data-wordmark=""
      // Latin wordmark: the same left-to-right order in Arabic pages too.
      dir="ltr"
      className={cn(
        "flex select-none justify-between overflow-hidden font-display leading-[0.74] font-extralight",
        // Sized to the viewport so the word fills the width on any screen.
        "text-[24vw] lg:text-[21vw] 2xl:text-[19rem]",
        className,
      )}
    >
      {letters.map((letter, index) => (
        <span
          // Letters can repeat; their position is their identity.
          key={index}
          className="wordmark-letter inline-block"
          style={{ "--letter-index": index } as CSSProperties}
        >
          {letter}
        </span>
      ))}
    </div>
  );
}
