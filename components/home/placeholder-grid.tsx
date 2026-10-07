import type { LucideIcon } from "lucide-react";
import { StatusState } from "@/components/ui/states";

/**
 * Reserved space for the product grid that arrives in Phase 6: faint 2:3
 * tiles show the future layout, and a note on top tells visitors what to
 * expect. Renders no catalogue data.
 */
export function ProductGridPlaceholder({
  icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="relative mt-12 sm:mt-14">
      <div aria-hidden className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-10">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i}>
            <div className="aspect-[2/3] bg-brand-soft" />
            <div className="mx-auto mt-5 h-2 w-2/3 bg-muted" />
            <div className="mx-auto mt-2.5 h-2 w-1/4 bg-muted" />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-sm border bg-background/95 px-6 backdrop-blur-sm">
          <StatusState icon={icon} title={title} description={description} headingLevel="h3" />
        </div>
      </div>
    </div>
  );
}
