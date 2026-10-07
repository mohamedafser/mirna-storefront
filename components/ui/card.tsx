import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";

/** Bordered surface for grouped content (square, flat). */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("border bg-card text-card-foreground", className)} {...props} />;
}
