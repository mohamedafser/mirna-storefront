import type { ReactNode } from "react";
import { SectionHeading } from "@/components/home/section-heading";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

/** Inline text link inside auth forms and footers. */
export const authLinkClassName =
  "font-medium text-foreground underline underline-offset-4 hover:opacity-70";

/**
 * Narrow, centred layout for the sign-in pages: page title and a bordered
 * form panel.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto w-full max-w-md">
        <SectionHeading as="h1" id="page-title" title={title} subtitle={subtitle} />
        <div className="mt-10 border bg-card p-6 sm:mt-12 sm:p-8">{children}</div>
      </div>
    </Container>
  );
}

/** Placeholder for a form while it streams in (forms read the URL on the client). */
export function FormSkeleton({ label, fields = 2 }: { label: string; fields?: number }) {
  return (
    <div role="status" aria-label={label} className="grid gap-5">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="grid gap-2">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-11" />
        </div>
      ))}
      <Skeleton className="mt-1 h-12" />
    </div>
  );
}
