import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";

/** Text input. Always pair with a visible <label> or an aria-label. */
export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full min-w-0 border border-border bg-card px-4 text-base text-foreground sm:text-sm",
        "transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground hover:border-input",
        // A soft halo on focus, in the theme's ring colour.
        "focus-visible:border-foreground focus-visible:ring-[3px] focus-visible:ring-ring/15 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
