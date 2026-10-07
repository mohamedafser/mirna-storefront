import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { plural, type Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";
import type { CatalogueCategory } from "@/types/domain";

/**
 * Neutral tonal panels standing in for collection photography when a
 * category has no image (the Phase 5 placeholder style). They always sit
 * under white text, so they are the same in light and dark themes.
 */
export const CATEGORY_TONES = [
  "bg-[linear-gradient(160deg,#4b4038,#231e1b)]",
  "bg-[linear-gradient(160deg,#5c4c40,#2a231f)]",
  "bg-[linear-gradient(160deg,#3a322d,#1b1715)]",
];

/**
 * Category tile: the admin-managed image (or a tonal placeholder) with the
 * name, an optional description and the active product count over a scrim.
 * The whole tile links to the canonical /categories/[slug] page.
 */
export function CategoryCard({
  category,
  locale,
  t,
  index = 0,
  sizes,
  showDescription = false,
  headingLevel: Heading = "h2",
  className,
}: {
  category: CatalogueCategory;
  locale: Locale;
  t: Messages["catalogue"];
  /** Position in the list; picks the placeholder tone. */
  index?: number;
  sizes: string;
  showDescription?: boolean;
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  return (
    <Link
      href={localizedHref(locale, routes.category(category.slug))}
      className={cn(
        "group relative isolate flex items-end overflow-hidden text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
        className,
      )}
    >
      {category.imageUrl ? (
        <Image
          src={category.imageUrl}
          // Decorative: the tile's visible name already labels the link.
          alt=""
          fill
          sizes={sizes}
          className="-z-20 object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
        />
      ) : (
        <div
          aria-hidden
          className={cn("absolute inset-0 -z-20", CATEGORY_TONES[index % CATEGORY_TONES.length])}
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(0_0_0/0.55),transparent_60%)]"
      />
      <div className="w-full p-6 sm:p-8">
        <Heading className="caps-wide text-base font-medium break-words sm:text-lg">
          {category.name}
        </Heading>
        {showDescription && category.description && (
          <p className="mt-2 line-clamp-2 max-w-md text-sm leading-relaxed text-white/85">
            {category.description}
          </p>
        )}
        <p className="caps mt-3 text-[0.625rem] text-white/80">
          {plural(locale, category.productCount, t.productCount)}
        </p>
        <span className="caps mt-5 inline-block border-b border-current pb-1 text-[0.6875rem] font-medium">
          {t.shopNow}
        </span>
      </div>
    </Link>
  );
}
