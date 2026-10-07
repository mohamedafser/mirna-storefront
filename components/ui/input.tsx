import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";

/** Text input. Always pair with a visible <label> or an aria-label. */
export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full min-w-0 border border-border bg-card px-4 text-base text-foreground sm:text-sm",
        "placeholder:text-muted-foreground hover:border-input",
        "focus-visible:border-foreground focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
