import Link from "next/link";
import type { ReactNode } from "react";
import { SectionHeading } from "@/components/home/section-heading";
import { Container } from "@/components/ui/container";
import { ArrowLeft } from "lucide-react";

/** Account sub-page frame: back link, page title, content. */
export function AccountSubpage({
  title,
  subtitle,
  back,
  children,
  narrow = false,
}: {
  title: string;
  subtitle?: string;
  back: { href: string; label: string };
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <Container className="py-12 sm:py-20">
      <div className={narrow ? "mx-auto max-w-2xl" : "mx-auto max-w-5xl"}>
        <Link
          href={back.href}
          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          {/* Back arrow points against the reading direction. */}
          <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
          {back.label}
        </Link>
        <div className="mt-6">
          <SectionHeading as="h1" id="page-title" title={title} subtitle={subtitle} />
        </div>
        <div className="mt-10 sm:mt-12">{children}</div>
      </div>
    </Container>
  );
}
