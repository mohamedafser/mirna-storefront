import { cn } from "@/lib/utils/cn";

/**
 * Shown wherever a product has no photo: an abaya on a hanger, drawn in the
 * theme's brand-soft colours (so it follows light / dark / burgundy themes),
 * with the MIRNA wordmark under it on larger tiles. Fills its parent, which
 * sets the size and aspect ratio. `label` is read out (e.g. "No image");
 * omit it where the image is decorative.
 */
export function ImagePlaceholder({
  label,
  wordmark = true,
  className,
}: {
  label?: string;
  /** false for small thumbnails (cart, orders). */
  wordmark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "@container absolute inset-0 flex flex-col items-center justify-center gap-[6cqw] bg-brand-soft text-brand-soft-foreground select-none",
        // Soft light falling on the garment.
        "bg-[radial-gradient(ellipse_at_50%_38%,color-mix(in_oklab,var(--background)_45%,transparent),transparent_68%)]",
        className,
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 100 140"
        fill="none"
        className={cn("w-auto opacity-60", wordmark ? "h-[46%]" : "h-[62%]")}
      >
        {/* Hanger */}
        <path
          d="M50 19v-5.5a4.5 4.5 0 1 1 4.5-4.5M50 19 27 31h46L50 19Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Abaya: wide sleeves, flowing hem, V neckline */}
        <path
          d="M42 29 30 32 9 75l13 6 11-27-11 77q28 6 56 0L67 54l11 27 13-6-21-43-12-3q-8 11-16 0Z"
          fill="currentColor"
          fillOpacity="0.16"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        {/* Front opening and cuff trims */}
        <path
          d="M50 40v93M10.5 72.5l13 6M89.5 72.5l-13 6"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
      {wordmark && (
        <span
          aria-hidden
          className="font-display text-[7cqw] leading-none font-medium tracking-[0.35em] opacity-55 [padding-inline-start:0.35em]"
        >
          MIRNA
        </span>
      )}
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}
