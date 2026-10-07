import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * Reusable promotional band: centred eyebrow, title, copy and call to
 * action. Presentation only: it carries no discount or coupon logic.
 */
export function PromoBanner({
  id,
  eyebrow,
  title,
  body,
  action,
  className,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  body?: string;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("border-y bg-card", className)}>
      <div className="mx-auto max-w-2xl px-5 py-16 text-center sm:py-24">
        {eyebrow && (
          <p className="caps text-[0.6875rem] font-medium text-muted-foreground">{eyebrow}</p>
        )}
        <h2 id={id} className="caps mt-4 text-base leading-relaxed font-medium sm:text-lg">
          {title}
        </h2>
        <span aria-hidden className="mx-auto mt-5 block h-px w-4 bg-current" />
        {body && (
          <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-pretty text-muted-foreground">
            {body}
          </p>
        )}
        {action && (
          <Link href={action.href} className={buttonClassName({ className: "mt-9" })}>
            {action.label}
          </Link>
        )}
      </div>
    </section>
  );
}
