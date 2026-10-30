import { Badge } from "@/components/ui/badge";
import type { PriceRow } from "@/lib/currency/money";
import { SaleBadge } from "./sale-badge";
import { cn } from "@/lib/utils/cn";

/**
 * Labels stacked over a product image's top inline-start corner: the
 * percentage off when on sale (in the visitor's currency) and the product's
 * tags ("New", …), on the page colour so they read over any photo. Renders
 * nothing when there is nothing to show.
 */
export function ImageTags({
  tags,
  prices,
  className,
}: {
  tags?: readonly { name: string; slug: string }[];
  /** The product's prices: a discount in the visitor's currency is shown first. */
  prices?: readonly PriceRow[];
  className?: string;
}) {
  if (!prices?.length && !tags?.length) return null;
  return (
    <ul
      className={cn(
        "pointer-events-none absolute start-3 top-3 flex max-w-[calc(100%-4.5rem)] flex-col items-start gap-1.5",
        className,
      )}
    >
      {prices && <SaleBadge prices={prices} />}
      {tags?.map((tag) => (
        <li key={tag.slug} className="max-w-full">
          <Badge className="max-w-full truncate border-transparent bg-background text-foreground">
            <bdi className="truncate">{tag.name}</bdi>
          </Badge>
        </li>
      ))}
    </ul>
  );
}
