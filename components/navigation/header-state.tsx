"use client";

import { useEffect } from "react";

/** Id of the <header> that HeaderState and SearchToggle update. */
export const SITE_HEADER_ID = "site-header";

/**
 * Marks the header as scrolled (data-scrolled) once the page leaves the top,
 * which turns the transparent hero header solid (see .site-header in
 * globals.css). Renders nothing.
 */
export function HeaderState() {
  useEffect(() => {
    const header = document.getElementById(SITE_HEADER_ID);
    if (!header) return;
    const update = () => header.toggleAttribute("data-scrolled", window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return null;
}

/**
 * Inline script for the hero: makes the header transparent while the HTML is
 * still parsing, so a full page load never flashes the solid header.
 */
export const headerOverlayScript = `document.getElementById("${SITE_HEADER_ID}")?.setAttribute("data-overlay","")`;

/**
 * Rendered by a full-bleed hero: marks the header [data-overlay] while the
 * hero is visible and clears it when the hero unmounts or its page is hidden
 * (React runs effect cleanups for pages Next.js keeps in the background).
 */
export function HeaderOverlay() {
  useEffect(() => {
    const header = document.getElementById(SITE_HEADER_ID);
    header?.setAttribute("data-overlay", "");
    return () => header?.removeAttribute("data-overlay");
  }, []);
  return null;
}
