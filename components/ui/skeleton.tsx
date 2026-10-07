import { cn } from "@/lib/utils/cn";

/** Pulsing placeholder block. Decorative: wrap groups in a labelled role="status". */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse bg-muted", className)} />;
}

/** Loading state for one product-grid section (title + tiles). */
export function SectionSkeleton({ label, items = 4 }: { label: string; items?: number }) {
  return (
    <div role="status" aria-label={label} className="py-16">
      <Skeleton className="mx-auto h-3 w-40" />
      <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-10">
        {Array.from({ length: items }, (_, i) => (
          <div key={i}>
            <Skeleton className="aspect-[2/3]" />
            <Skeleton className="mx-auto mt-4 h-2.5 w-3/4" />
            <Skeleton className="mx-auto mt-2 h-2.5 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Loading state for a whole page (page title + content). */
export function PageSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="py-16">
      <Skeleton className="mx-auto h-3 w-48" />
      <Skeleton className="mx-auto mt-4 h-2 w-6" />
      <Skeleton className="mx-auto mt-6 h-3 w-80 max-w-full" />
      <Skeleton className="mt-12 h-72" />
    </div>
  );
}
