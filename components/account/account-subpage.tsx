import Link from "next/link";
import { isValidElement, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** "← label" link at the top of a nested account page (an order, an address form). */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ms-1 inline-flex min-h-11 items-center gap-2 px-1 text-sm text-muted-foreground hover:text-foreground"
    >
      {/* Back arrow points against the reading direction. */}
      <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
      {label}
    </Link>
  );
}

/** Page title (h1, #page-title) and optional subtitle and action, start-aligned. */
export function AccountHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b pb-6">
      <div className="min-w-0">
        <h1 id="page-title" className="caps text-xs font-medium sm:text-[0.8125rem]">
          {title}
        </h1>
        {subtitle && (
          <div className="mt-3 text-sm text-pretty text-muted-foreground">{subtitle}</div>
        )}
      </div>
      {action}
    </div>
  );
}

/**
 * Account page frame inside the account layout (which adds the menu): an
 * optional back link for nested pages, the page title, then the content.
 */
export function AccountSubpage({
  title,
  subtitle,
  back,
  action,
  children,
  narrow = false,
}: {
  title: string;
  subtitle?: string;
  /** Nested pages only: a BackLink's props, or an element (e.g. one that depends on the request). */
  back?: { href: string; label: string } | ReactNode;
  /** Shown beside the title, e.g. "Add address". */
  action?: ReactNode;
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className={cn("min-w-0", narrow && "max-w-2xl")}>
      {back && (
        <div className="mb-4">
          {isValidElement(back) || !isBackProps(back) ? back : <BackLink {...back} />}
        </div>
      )}
      <AccountHeader title={title} subtitle={subtitle} action={action} />
      <div className="mt-8">{children}</div>
    </div>
  );
}

/** Bordered account section: caps title, optional description and header link. */
export function AccountSection({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("border bg-card p-6 sm:p-8", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 id={id} className="caps text-xs font-medium">
          {title}
        </h2>
        {action}
      </div>
      {description && <p className="mt-3 text-sm text-muted-foreground">{description}</p>}
      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}

/** Small underlined link for a section header ("View all orders"). */
export const sectionLinkClassName = "text-sm underline underline-offset-4 hover:opacity-70";

function isBackProps(value: unknown): value is { href: string; label: string } {
  return typeof value === "object" && value !== null && "href" in value && "label" in value;
}
