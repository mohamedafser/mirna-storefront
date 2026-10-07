import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";

const tones = {
  neutral: "border-border text-muted-foreground",
  primary: "border-foreground/70 text-foreground",
  success: "border-success/40 text-success",
  warning: "border-warning/40 text-warning",
  error: "border-error/40 text-error",
} as const;

/** Small outlined label for statuses ("Coming soon"). */
export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        "caps inline-flex items-center border px-2 py-0.5 text-[0.625rem] font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
