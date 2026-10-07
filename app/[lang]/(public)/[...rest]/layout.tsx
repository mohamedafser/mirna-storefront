import { Suspense } from "react";
import { NotFoundContent } from "@/components/page/not-found-content";

/**
 * Next.js renders a catch-all page at request time (its path is unknown at
 * build time), so its notFound() arrives after the static shell has been
 * sent. Using the 404 content as this boundary's fallback puts it in the
 * server HTML; the not-found boundary then swaps in the identical UI.
 * The response status is still 404 with a noindex tag.
 */
export default function UnknownPageLayout({ children }: LayoutProps<"/[lang]/[...rest]">) {
  return <Suspense fallback={<NotFoundContent />}>{children}</Suspense>;
}
