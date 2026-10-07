import Link from "next/link";
import { CATEGORY_TONES, CategoryCard } from "@/components/catalogue/category-card";
import { buttonClassName } from "@/components/ui/button";
import type { Locale } from "@/config/i18n";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";
import type { CatalogueCategory } from "@/types/domain";

const TILE_COLUMNS = ["", "sm:grid-cols-1", "sm:grid-cols-2", "sm:grid-cols-3"];

/**
 * Full-bleed row of up to three tall collection tiles: the first active
 * categories in admin display order. Stacked on phones, side by side from sm.
 */
export function CategoryTiles({
  id,
  title,
  categories,
  locale,
  t,
  action,
}: {
  id: string;
  title: string;
  /** 1–3 categories (render CategoryTilesPlaceholder for none). */
  categories: CatalogueCategory[];
  locale: Locale;
  t: Messages["catalogue"];
  action: { href: string; label: string };
}) {
  return (
    <section aria-labelledby={id}>
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 pb-8 sm:px-8 lg:px-12">
        <h2 id={id} className="caps text-xs font-medium sm:text-[0.8125rem]">
          {title}
        </h2>
        <Link
          href={action.href}
          className="caps border-b border-current pb-1 text-[0.6875rem] font-medium hover:opacity-70"
        >
          {action.label}
        </Link>
      </div>
      <ul className={cn("grid grid-cols-1", TILE_COLUMNS[categories.length])}>
        {categories.map((category, index) => (
          <li key={category.id} className="border-white/5 sm:border-e sm:last:border-e-0">
            <CategoryCard
              category={category}
              locale={locale}
              t={t}
              index={index}
              headingLevel="h3"
              sizes="(min-width: 640px) 34vw, 100vw"
              className="h-[26rem] sm:h-[36rem] lg:h-[40rem]"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Shown while there are no active categories: the tile row carries one
 * honest "no categories yet" message across three tonal panels.
 */
export function CategoryTilesPlaceholder({
  id,
  eyebrow,
  title,
  description,
  action,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  action: { href: string; label: string };
}) {
  return (
    <section aria-labelledby={id} className="relative isolate text-white">
      <div aria-hidden className="grid h-[34rem] grid-cols-3 sm:h-[36rem] lg:h-[40rem]">
        {CATEGORY_TONES.map((tone, i) => (
          <div key={i} className={`${tone} border-e border-white/5 last:border-e-0`} />
        ))}
      </div>
      <div className="absolute inset-0 flex items-end bg-[linear-gradient(to_top,rgb(0_0_0/0.45),transparent_60%)]">
        <div className="mx-auto w-full max-w-[100rem] px-5 pb-12 sm:px-8 sm:pb-16 lg:px-12">
          <p className="caps text-[0.6875rem] font-medium opacity-80">{eyebrow}</p>
          <h2 id={id} className="caps-wide mt-4 text-xl font-medium sm:text-2xl">
            {title}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85">{description}</p>
          <Link
            href={action.href}
            className={buttonClassName({ variant: "inverse", className: "mt-8" })}
          >
            {action.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
