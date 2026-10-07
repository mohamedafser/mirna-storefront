import { Skeleton } from "@/components/ui/skeleton";

/** Product tiles only (2:3 image, name, price), matching ProductGrid. */
export function ProductGridSkeleton({
  items = 8,
  layout = "full",
}: {
  items?: number;
  layout?: "full" | "sidebar";
}) {
  return (
    <div
      aria-hidden
      className={
        layout === "full"
          ? "grid grid-cols-1 gap-x-4 gap-y-10 min-[22rem]:grid-cols-2 sm:gap-x-6 lg:grid-cols-4 lg:gap-x-10"
          : "grid grid-cols-1 gap-x-4 gap-y-10 min-[22rem]:grid-cols-2 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4"
      }
    >
      {Array.from({ length: items }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[2/3]" />
          <Skeleton className="mx-auto mt-4 h-2.5 w-3/4" />
          <Skeleton className="mx-auto mt-2 h-2.5 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/** Toolbar + sidebar + grid placeholder while a catalogue page streams in. */
export function CatalogueSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label}>
      <div className="grid gap-10 lg:grid-cols-[14rem_1fr] xl:grid-cols-[16rem_1fr]">
        <div aria-hidden className="hidden gap-3 lg:grid lg:content-start">
          <Skeleton className="h-2.5 w-24" />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="mt-2 h-3 w-40" />
          ))}
          <Skeleton className="mt-8 h-2.5 w-28" />
          <Skeleton className="mt-2 h-10" />
        </div>
        <div>
          <Skeleton className="h-12" />
          <div aria-hidden className="mt-5 mb-10 flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-11 w-44" />
          </div>
          <ProductGridSkeleton layout="sidebar" />
        </div>
      </div>
    </div>
  );
}

/** Category tiles placeholder for /categories. */
export function CategoryGridSkeleton({ label, items = 6 }: { label: string; items?: number }) {
  return (
    <div role="status" aria-label={label} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: items }, (_, i) => (
        <Skeleton key={i} className="aspect-[4/5]" />
      ))}
    </div>
  );
}
