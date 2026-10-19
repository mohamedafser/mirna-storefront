import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Locale } from "@/config/i18n";
import { toIntlLocale } from "@/lib/format";
import { format, type Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";

/** First, last, and the pages around the current one; null marks a gap. */
function pageWindow(page: number, pageCount: number): (number | null)[] {
  const pages = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);
  return pages.flatMap((p, i) => (i > 0 && p - pages[i - 1] > 1 ? [null, p] : [p]));
}

/** Round arrow button; fills on hover. */
const arrowClassName =
  "grid size-12 place-items-center rounded-full border border-foreground/25 transition-colors duration-300";

/**
 * Server-rendered pagination: plain links that keep every other URL
 * parameter, so it works without JavaScript and with back/forward.
 *
 * Editorial style: round arrow buttons at either end and page numbers in the
 * display face, the current one underlined (the others draw their underline
 * on hover). Phones show "03 / 07" between the arrows instead of numbers.
 * With `total` and `pageSize` it is introduced by "Showing 13–24 of 40" and
 * a hairline that fills with how far through the results the page is.
 */
export function Pagination({
  href,
  page,
  pageCount,
  total,
  pageSize,
  locale,
  t,
}: {
  /** Link for a page number (keeps the list's other URL parameters). */
  href: (page: number) => string;
  page: number;
  pageCount: number;
  /** Result count and page size: show the "Showing x–y of z" summary. */
  total?: number;
  pageSize?: number;
  locale?: Locale;
  t: Pick<
    Messages["catalogue"],
    | "pagination"
    | "previous"
    | "next"
    | "previousPage"
    | "nextPage"
    | "goToPage"
    | "pageOf"
    | "showing"
  >;
}) {
  if (pageCount <= 1) return null;

  const number = new Intl.NumberFormat(locale ? toIntlLocale(locale) : undefined);
  const pad = (n: number) => number.format(n).padStart(2, number.format(0));
  const summary =
    total !== undefined && pageSize
      ? {
          from: (page - 1) * pageSize + 1,
          to: Math.min(page * pageSize, total),
        }
      : null;

  const arrow = (direction: "previous" | "next") => {
    const target = direction === "previous" ? page - 1 : page + 1;
    const enabled = target >= 1 && target <= pageCount;
    const Icon = direction === "previous" ? ArrowLeft : ArrowRight;
    const icon = <Icon aria-hidden strokeWidth={1.5} className="size-4 rtl:-scale-x-100" />;
    return enabled ? (
      <Link
        href={href(target)}
        rel={direction === "previous" ? "prev" : "next"}
        aria-label={direction === "previous" ? t.previousPage : t.nextPage}
        className={cn(
          arrowClassName,
          "group/arrow hover:border-foreground hover:bg-foreground hover:text-background",
        )}
      >
        <span
          className={cn(
            "transition-transform duration-300",
            direction === "previous"
              ? "group-hover/arrow:-translate-x-0.5 rtl:group-hover/arrow:translate-x-0.5"
              : "group-hover/arrow:translate-x-0.5 rtl:group-hover/arrow:-translate-x-0.5",
          )}
        >
          {icon}
        </span>
      </Link>
    ) : (
      <span
        aria-disabled="true"
        aria-label={direction === "previous" ? t.previous : t.next}
        className={cn(arrowClassName, "text-muted-foreground opacity-40")}
      >
        {icon}
      </span>
    );
  };

  return (
    <nav aria-label={t.pagination} className="mt-20 flex flex-col items-center gap-8">
      {summary && total !== undefined && (
        <div className="w-full max-w-xs text-center">
          <p className="caps text-[0.625rem] font-medium text-muted-foreground tabular-nums">
            {format(t.showing, {
              from: number.format(summary.from),
              to: number.format(summary.to),
              total: number.format(total),
            })}
          </p>
          <div aria-hidden className="relative mt-3 h-px overflow-hidden bg-border">
            <span
              className="absolute inset-y-0 start-0 bg-foreground transition-[width] duration-700 ease-out"
              style={{ width: `${(summary.to / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 sm:gap-6">
        {arrow("previous")}

        <ul className="hidden items-center gap-1 sm:flex">
          {pageWindow(page, pageCount).map((target, index) =>
            target === null ? (
              <li
                key={`gap-${index}`}
                aria-hidden
                className="px-1 font-display text-muted-foreground"
              >
                ⋯
              </li>
            ) : (
              <li key={target}>
                <Link
                  href={href(target)}
                  aria-label={format(t.goToPage, { page: target })}
                  aria-current={target === page ? "page" : undefined}
                  className={cn(
                    "relative inline-flex size-11 items-center justify-center font-display text-lg tabular-nums transition-colors duration-300",
                    // Underline: drawn for the current page, on hover for the others.
                    "after:absolute after:bottom-1.5 after:h-px after:w-5 after:bg-current after:transition-transform after:duration-300 after:content-['']",
                    target === page
                      ? "font-medium text-foreground after:scale-x-100"
                      : "text-muted-foreground after:scale-x-0 hover:text-foreground hover:after:scale-x-100",
                  )}
                >
                  {pad(target)}
                </Link>
              </li>
            ),
          )}
        </ul>

        {/* Phones: the position instead of numbers. */}
        <p className="font-display text-lg tabular-nums sm:hidden">
          <span className="sr-only">{format(t.pageOf, { page, total: pageCount })}</span>
          <span aria-hidden>
            {pad(page)}
            <span className="mx-2 text-muted-foreground">/</span>
            <span className="text-muted-foreground">{pad(pageCount)}</span>
          </span>
        </p>

        {arrow("next")}
      </div>

      {!summary && (
        <p className="hidden text-xs text-muted-foreground sm:block">
          {format(t.pageOf, { page, total: pageCount })}
        </p>
      )}
    </nav>
  );
}
