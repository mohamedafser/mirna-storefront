"use client";

import { useEffect, useRef, type ComponentProps, type Ref } from "react";

/** Milliseconds between items revealed together, and how many steps at most. */
const STEP_MS = 200;
const MAX_STEPS = 4;

/**
 * A <ul> whose items rise and fade in, one after another, as they scroll into
 * view (like a boutique lookbook). Items that enter the screen together form
 * one batch, staggered by STEP_MS; each item plays once. Items added later
 * (next page, new results) are picked up too. The hidden start state lives in
 * globals.css ([data-stagger]) and only applies with JavaScript on and
 * without reduced motion, so content is never stuck invisible.
 */
export function StaggerList({
  children,
  ref: outerRef,
  ...props
}: ComponentProps<"ul"> & { ref?: Ref<HTMLUListElement> }) {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = ref.current;
    if (!list) return;

    const intersection = new IntersectionObserver(
      (entries) => {
        let step = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const item = entry.target as HTMLElement;
          item.style.setProperty("--stagger-delay", `${Math.min(step, MAX_STEPS) * STEP_MS}ms`);
          item.dataset.revealed = "";
          intersection.unobserve(item);
          step += 1;
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    const observe = () => {
      for (const item of list.children) {
        if (!(item as HTMLElement).hasAttribute("data-revealed")) intersection.observe(item);
      }
    };
    observe();
    const mutation = new MutationObserver(observe);
    mutation.observe(list, { childList: true });
    return () => {
      intersection.disconnect();
      mutation.disconnect();
    };
  }, []);

  return (
    <ul
      {...props}
      data-stagger=""
      ref={(node) => {
        ref.current = node;
        if (typeof outerRef === "function") return outerRef(node);
        if (outerRef) outerRef.current = node;
      }}
    >
      {children}
    </ul>
  );
}
