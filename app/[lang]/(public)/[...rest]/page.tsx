import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMessages } from "@/lib/i18n/server";

/**
 * Catch-all for unknown /<lang>/… URLs so they get the localized 404 inside
 * the storefront layout. Real routes (static or dynamic) always take
 * precedence over a catch-all.
 */

// This route only ever throws notFound(), so there is no page to validate
// for instant navigation (avoids a dev-only "could not validate" error).
export const instant = false;

// Next.js adds noindex itself. Without this it would have the home page's title.
export async function generateMetadata(): Promise<Metadata> {
  const { errors } = await getMessages();
  return { title: errors.notFoundTitle, description: errors.notFoundBody };
}

export default function UnknownPage(): never {
  notFound();
}
