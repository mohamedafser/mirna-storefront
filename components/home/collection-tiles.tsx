"use client";

import { ArrowRight, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ImagePlaceholder } from "@/components/catalogue/image-placeholder";
import { StaggerList } from "@/components/catalogue/stagger-list";
import { Container } from "@/components/ui/container";
import { localizedHref, routes } from "@/config/navigation";
import { toIntlLocale } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { plural } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";

export interface CollectionTile {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  productCount: number;
}

/**
 * "Shop by collection", an editorial two-column spread of the main
 * categories: a split header (eyebrow and large title at the inline start,
 * subtitle and a "view all" link at the end), then large portrait tiles two
 * per row, every second one set lower like a magazine layout. Each tile
 * carries its number (01, 02 …) and piece count at the top and, over the
 * bottom of the photo, the collection name in the display face with a
 * "Discover" link whose rule stretches on hover. Phones stack the tiles.
 * Tiles rise in as they appear; photos settle in from a slight zoom when
 * loaded and drift in slowly while hovered.
 */
export function CollectionTiles({ tiles }: { tiles: CollectionTile[] }) {
  const { locale, messages } = useI18n();
  const t = messages.home.collections;
  const number = new Intl.NumberFormat(toIntlLocale(locale), { minimumIntegerDigits: 2 });

  return (
    <section aria-labelledby="collections-title" className="py-16 lg:py-28">
      <Container size="wide">
        <header className="mb-10 grid gap-6 lg:mb-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12">
          <div>
            <p className="caps flex items-center gap-3 text-[0.625rem] font-medium text-muted-foreground">
              <span aria-hidden className="block h-px w-8 bg-current" />
              {t.eyebrow}
            </p>
            <h2
              id="collections-title"
              className="mt-4 font-display text-3xl leading-[1.05] font-medium text-balance sm:text-5xl"
            >
              {t.title}
            </h2>
          </div>
          <div className="flex flex-col gap-4 lg:max-w-xs lg:items-end lg:text-end">
            <p className="text-sm text-pretty text-muted-foreground">{t.subtitle}</p>
            <Link
              href={localizedHref(locale, routes.products)}
              className="group/all caps inline-flex items-center gap-3 self-start text-[0.6875rem] font-medium lg:self-end"
            >
              {messages.catalogue.viewAllProducts}
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform duration-300 group-hover/all:translate-x-1 rtl:-scale-x-100 rtl:group-hover/all:-translate-x-1"
              />
            </Link>
          </div>
        </header>

        <StaggerList className="grid gap-6 sm:grid-cols-2 sm:items-start sm:gap-8 lg:gap-12">
          {tiles.map((tile, index) => (
            <li
              key={tile.id}
              // Every second tile sits lower: a staggered, editorial rhythm.
              className={cn(index % 2 === 1 && "sm:mt-24 lg:mt-32")}
            >
              <Tile
                tile={tile}
                index={number.format(index + 1)}
                href={localizedHref(locale, routes.category(tile.slug))}
                count={plural(locale, tile.productCount, messages.home.featured.pieces)}
                cta={t.discover}
              />
            </li>
          ))}
        </StaggerList>
      </Container>
    </section>
  );
}

function Tile({
  tile,
  index,
  href,
  count,
  cta,
}: {
  tile: CollectionTile;
  index: string;
  href: string;
  count: string;
  cta: string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Link
      href={href}
      className="group relative block aspect-[4/5] overflow-hidden bg-[#2a2522] text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      {/* Slow hover drift (8s), separate from the load-in settle on the image. */}
      <div className="absolute inset-0 transition-transform duration-[8000ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] motion-reduce:transition-none [@media(hover:hover)]:group-hover:scale-110">
        {tile.imageUrl ? (
          <Image
            src={tile.imageUrl}
            alt=""
            fill
            sizes="(min-width: 640px) 46vw, 100vw"
            onLoad={() => setLoaded(true)}
            data-loaded={loaded || undefined}
            className="zoom-in-image object-cover"
          />
        ) : (
          <ImagePlaceholder wordmark={false} />
        )}
      </div>
      {/* Scrims: light at the top for the number, deeper at the bottom for the name. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.35),transparent_28%),linear-gradient(to_top,rgb(0_0_0/0.6),transparent_50%)] transition-opacity duration-500"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-black/15 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
      {/* Inner frame line, drawn just inside the edge. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-4 border border-white/20 transition-[inset,border-color] duration-500 group-hover:inset-3 group-hover:border-white/40 sm:inset-5 sm:group-hover:inset-4"
      />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-8 sm:p-10">
        <span
          aria-hidden
          className="font-display text-3xl leading-none font-light tabular-nums drop-shadow-[0_1px_2px_rgb(0_0_0/0.3)] sm:text-4xl"
        >
          {index}
        </span>
        <span className="caps rounded-full border border-white/40 bg-black/15 px-3 py-1.5 text-[0.5625rem] font-medium backdrop-blur-sm">
          {count}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-8 sm:p-10">
        <h3 className="font-display text-4xl leading-[1.05] font-medium break-words drop-shadow-[0_1px_2px_rgb(0_0_0/0.3)] sm:text-5xl lg:text-6xl">
          {tile.name}
        </h3>
        {/* "Discover" with a rule that stretches on hover. */}
        <span className="caps mt-5 flex items-center gap-3 text-[0.6875rem] font-medium">
          {cta}
          <span
            aria-hidden
            className="block h-px w-10 bg-white transition-[width] duration-500 ease-out group-hover:w-20"
          />
          <ArrowUpRight
            aria-hidden
            strokeWidth={1.5}
            className="size-4 transition-transform duration-300 group-hover:rotate-45 rtl:-scale-x-100"
          />
        </span>
      </div>
    </Link>
  );
}
