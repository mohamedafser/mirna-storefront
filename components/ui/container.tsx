import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";

const widths = {
  default: "max-w-7xl",
  wide: "max-w-[100rem] lg:px-12",
  narrow: "max-w-3xl",
} as const;

/** Centred page-width wrapper with responsive side padding. */
export function Container({
  size = "default",
  className,
  ...props
}: ComponentProps<"div"> & { size?: keyof typeof widths }) {
  return <div className={cn("mx-auto w-full px-5 sm:px-8", widths[size], className)} {...props} />;
}
