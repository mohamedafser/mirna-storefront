import { PackageOpen, SearchX, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { StatusState } from "@/components/ui/states";
import type { Messages } from "@/lib/i18n/messages";

export type EmptyReason = "empty" | "search" | "filters" | "out-of-range";

/**
 * Empty results, with the most useful next step:
 * - empty: the catalogue (or category) has no active products yet
 * - search: nothing matches the search term → clear the search
 * - filters: nothing matches the filters → clear filters (and the search)
 * - out-of-range: ?page= is past the last page → go to page 1
 */
export function EmptyCatalogue({
  reason,
  t,
  actions,
}: {
  reason: EmptyReason;
  t: Messages["catalogue"];
  actions: {
    clearFilters?: string;
    clearSearch?: string;
    firstPage?: string;
    allProducts?: string;
  };
}) {
  const content = {
    empty: { icon: PackageOpen, title: t.emptyTitle, body: t.emptyBody },
    search: { icon: SearchX, title: t.noSearchTitle, body: t.noSearchBody },
    filters: { icon: SlidersHorizontal, title: t.noFilterTitle, body: t.noFilterBody },
    "out-of-range": { icon: SearchX, title: t.pageMissingTitle, body: t.pageMissingBody },
  }[reason];

  const links = [
    actions.firstPage && { href: actions.firstPage, label: t.firstPage },
    actions.clearFilters && { href: actions.clearFilters, label: t.clearFilters },
    actions.clearSearch && { href: actions.clearSearch, label: t.clearSearch },
    actions.allProducts && { href: actions.allProducts, label: t.viewAllProducts },
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  return (
    <div className="border bg-card px-6">
      <StatusState
        icon={content.icon}
        title={content.title}
        description={content.body}
        className="py-16 sm:py-20"
        action={
          links.length > 0 &&
          links.map((link, index) => (
            <Link
              key={link.href + link.label}
              href={link.href}
              className={buttonClassName({ variant: index === 0 ? "primary" : "outline" })}
            >
              {link.label}
            </Link>
          ))
        }
      />
    </div>
  );
}
