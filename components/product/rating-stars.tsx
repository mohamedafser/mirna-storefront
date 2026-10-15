import { Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Five stars filled to `rating` (0–5, fractions shown as partly filled).
 * Decorative: pair it with a text label (`label` is read out instead).
 */
export function RatingStars({
  rating,
  label,
  size = "sm",
  className,
}: {
  rating: number;
  /** Accessible text, e.g. "Rated 4.5 out of 5". Omit when the text is shown next to it. */
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const icon = { sm: "size-3.5", md: "size-4", lg: "size-5" }[size];
  const fill = `${(Math.max(0, Math.min(5, rating)) / 5) * 100}%`;
  const row = (filled: boolean) => (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          aria-hidden
          strokeWidth={1.5}
          className={cn(icon, "shrink-0", filled && "fill-current")}
        />
      ))}
    </span>
  );

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("relative inline-flex text-foreground", className)}
    >
      <span className="text-muted-foreground/50">{row(false)}</span>
      {/* Filled copy clipped to the rating, from the inline-start edge (mirrors in RTL). */}
      <span className="absolute inset-y-0 start-0 overflow-hidden" style={{ width: fill }}>
        {row(true)}
      </span>
    </span>
  );
}
