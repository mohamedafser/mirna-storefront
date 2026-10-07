import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/**
 * Breadcrumb trail. The last item is the current page (no link,
 * aria-current). Separators are decorative and read the same in RTL.
 */
export function Breadcrumbs({
  label,
  items,
  align = "center",
}: {
  label: string;
  items: ReadonlyArray<{ label: string; href?: string }>;
  align?: "center" | "start";
}) {
  return (
    <nav aria-label={label}>
      <ol
        className={cn(
          "caps flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.625rem] text-muted-foreground",
          align === "center" ? "justify-center" : "justify-start",
        )}
      >
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${index}-${item.label}`} className="flex min-w-0 items-center gap-x-2">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="inline-flex min-h-6 items-center transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className="truncate text-foreground">
                  {item.label}
                </span>
              )}
              {!last && <span aria-hidden>/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
