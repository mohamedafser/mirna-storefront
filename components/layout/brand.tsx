import { cn } from "@/lib/utils/cn";

/**
 * Mirna wordmark: thin, widely tracked display type. The ONLY place the logo
 * is rendered — swap this for the final logo (e.g. an SVG via next/image)
 * to rebrand everywhere. The app icon lives in public/icons/icon.svg.
 */
export function Brand({
  name,
  className,
  size = "md",
}: {
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "caps-wide inline-block leading-none font-light whitespace-nowrap",
        { sm: "text-base", md: "text-xl lg:text-[1.375rem]", lg: "text-2xl" }[size],
        className,
      )}
    >
      {name}
    </span>
  );
}
