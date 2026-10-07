import { LoaderCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Spinner with an accessible label. */
export function Spinner({ label, className }: { label: string; className?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2", className)}>
      <LoaderCircle aria-hidden className="size-5 animate-spin" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * Shared layout for empty, "coming soon", error and not-found screens.
 * `action` is typically a link styled with buttonClassName().
 */
export function StatusState({
  icon: Icon,
  title,
  description,
  action,
  tone = "neutral",
  headingLevel = "h2",
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "error";
  headingLevel?: "h1" | "h2" | "h3";
  className?: string;
}) {
  const Heading = headingLevel;
  return (
    <div className={cn("mx-auto flex max-w-md flex-col items-center py-12 text-center", className)}>
      {Icon && (
        <Icon
          aria-hidden
          strokeWidth={1.25}
          className={cn("mb-6 size-9", tone === "error" ? "text-error" : "text-muted-foreground")}
        />
      )}
      <Heading className="caps text-sm font-medium text-balance">{title}</Heading>
      {description && (
        <div className="mt-3 text-sm leading-relaxed text-pretty text-muted-foreground">
          {description}
        </div>
      )}
      {action && <div className="mt-8 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}
