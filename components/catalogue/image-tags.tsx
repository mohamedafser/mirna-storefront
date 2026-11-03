import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

/**
 * Labels stacked over a product image's top inline-start corner: the product's
 * tags ("New", …), on the page colour so they read over any photo. Renders
 * nothing when there is nothing to show.
 */
export function ImageTags({
  tags,
  className,
}: {
  tags?: readonly { name: string; slug: string }[];
  className?: string;
}) {
  if (!tags?.length) return null;
  return (
    <ul
      className={cn(
        "pointer-events-none absolute start-3 top-3 flex max-w-[calc(100%-4.5rem)] flex-col items-start gap-1.5",
        className,
      )}
    >
      {tags.map((tag) => (
        <li key={tag.slug} className="max-w-full">
          <Badge className="max-w-full truncate border-transparent bg-background text-foreground">
            <bdi className="truncate">{tag.name}</bdi>
          </Badge>
        </li>
      ))}
    </ul>
  );
}
