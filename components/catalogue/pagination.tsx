import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { catalogueHref, type CatalogueState } from "@/lib/catalogue/params";
import { format, type Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";

/** First, last, and the pages around the current one; null marks a gap. */
function pageWindow(page: number, pageCount: number): (number | null)[] {
  const pages = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);
  return pages.flatMap((p, i) => (i > 0 && p - pages[i - 1] > 1 ? [null, p] : [p]));
}

const itemClassName =
  "inline-flex h-11 min-w-11 items-center justify-center px-3 text-xs transition-colors";

/**
 * Server-rendered pagination: plain links that keep every other URL
 * parameter, so it works without JavaScript and with back/forward.
 */
export function Pagination({
  path,
  state,
  page,
  pageCount,
  t,
}: {
  /** Localised catalogue path the links point to. */
  path: string;
  state: CatalogueState;
  page: number;
  pageCount: number;
  t: Messages["catalogue"];
}) {
  if (pageCount <= 1) return null;
  const href = (target: number) => catalogueHref(path, state, { page: target });

  return (
    <nav aria-label={t.pagination} className="mt-16 flex flex-col items-center gap-4">
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          {page > 1 ? (
            <Link
              href={href(page - 1)}
              rel="prev"
              aria-label={t.previousPage}
              className={cn(itemClassName, "caps gap-2 hover:bg-accent")}
            >
              <ChevronLeft aria-hidden className="size-4 rtl:-scale-x-100" />
              <span className="hidden sm:inline">{t.previous}</span>
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className={cn(itemClassName, "caps gap-2 text-muted-foreground opacity-50")}
            >
              <ChevronLeft aria-hidden className="size-4 rtl:-scale-x-100" />
              <span className="hidden sm:inline">{t.previous}</span>
            </span>
          )}
        </li>
        {pageWindow(page, pageCount).map((target, index) =>
          target === null ? (
            <li key={`gap-${index}`} aria-hidden className={cn(itemClassName, "px-1")}>
              …
            </li>
          ) : (
            <li key={target}>
              <Link
                href={href(target)}
                aria-label={format(t.goToPage, { page: target })}
                aria-current={target === page ? "page" : undefined}
                className={cn(
                  itemClassName,
                  target === page
                    ? "bg-foreground font-medium text-background"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {target}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < pageCount ? (
            <Link
              href={href(page + 1)}
              rel="next"
              aria-label={t.nextPage}
              className={cn(itemClassName, "caps gap-2 hover:bg-accent")}
            >
              <span className="hidden sm:inline">{t.next}</span>
              <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className={cn(itemClassName, "caps gap-2 text-muted-foreground opacity-50")}
            >
              <span className="hidden sm:inline">{t.next}</span>
              <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
            </span>
          )}
        </li>
      </ul>
      <p className="text-xs text-muted-foreground">
        {format(t.pageOf, { page, total: pageCount })}
      </p>
    </nav>
  );
}
