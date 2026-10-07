import { notFound } from "next/navigation";

/**
 * Catch-all for unknown /<lang>/… URLs so they get the localized 404 inside
 * the storefront layout. Real routes (static or dynamic) always take
 * precedence over a catch-all.
 */

// This route only ever throws notFound(), so there is no page to validate
// for instant navigation (avoids a dev-only "could not validate" error).
export const instant = false;

export default function UnknownPage(): never {
  notFound();
}
