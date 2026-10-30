import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";

/**
 * Editorial page opener for content pages (About, Contact): a caps eyebrow
 * with a short rule, the page title (h1, #page-title) in the display face,
 * and a lead paragraph, on a soft tonal band.
 */
export function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  /** Optional actions under the lead. */
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby="page-title" className="border-b bg-muted/60">
      <Container className="py-16 sm:py-24">
        <div className="max-w-3xl">
          <p className="caps flex items-center gap-3 text-[0.625rem] font-medium text-muted-foreground">
            <span aria-hidden className="block h-px w-8 bg-current" />
            {eyebrow}
          </p>
          <h1
            id="page-title"
            className="mt-5 font-display text-3xl leading-[1.08] font-medium text-balance sm:text-5xl"
          >
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            {lead}
          </p>
          {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
        </div>
      </Container>
    </section>
  );
}
