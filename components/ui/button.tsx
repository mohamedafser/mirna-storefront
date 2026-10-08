import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "inverse" | "outline-inverse";
type Size = "md" | "sm" | "lg" | "icon" | "icon-sm";

// Square, uppercase, tracked: the storefront's editorial button style.
const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/85",
  secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
  outline: "border border-foreground/80 text-foreground hover:bg-foreground hover:text-background",
  ghost: "text-current hover:opacity-70",
  /** On photography / dark panels: white fill. */
  inverse: "bg-white text-[#291113] hover:bg-white/85",
  /** On photography / dark panels: white outline. */
  "outline-inverse": "border border-white/80 text-white hover:bg-white hover:text-[#291113]",
};

// md, lg and icon meet the 44px minimum touch target.
const sizes: Record<Size, string> = {
  sm: "h-9 gap-2 px-4 text-[0.6875rem] [&_svg]:size-3.5",
  md: "h-11 gap-2.5 px-6 text-xs [&_svg]:size-4",
  lg: "h-12 gap-3 px-8 text-xs [&_svg]:size-4",
  icon: "size-11 [&_svg]:size-5",
  "icon-sm": "size-9 [&_svg]:size-4",
};

export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  const isIcon = size === "icon" || size === "icon-sm";
  return cn(
    "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap",
    !isIcon && "caps",
    "transition-[color,background-color,border-color,opacity]",
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button type={type} className={buttonClassName({ variant, size, className })} {...props} />
  );
}
