"use client";

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ImagePlaceholder } from "@/components/catalogue/image-placeholder";
import { StaggerList } from "@/components/catalogue/stagger-list";
import { Container } from "@/components/ui/container";
import { localizedHref, routes } from "@/config/navigation";
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
 * "Shop by collection": framed portrait tiles with gutters, each a photo
 * with the collection name and piece count centred at the bottom and a round
 * arrow that turns solid on hover. Phones: a swipeable row with the next tile
 * peeking in; tablet 2, desktop 3 per row. Tiles rise in as they appear;
 * photos settle in from a slight zoom when loaded and drift in slowly while
 * hovered.
 */
export function CollectionTiles({ tiles }: { tiles: CollectionTile[] }) {
  const { locale, messages } = useI18n();
  const t = messages.home.collections;

  return (
    <section aria-labelledby="collections-title" className="py-14 lg:py-24">
      <Container size="wide">
        <header className="mb-8 text-center lg:mb-12">
          <h2
            id="collections-title"
            className="font-display text-2xl leading-tight font-medium sm:text-3xl"
          >
            {t.title}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">{t.subtitle}</p>
        </header>
        <StaggerList
          className={cn(
            "-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain px-5 pb-1",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 lg:grid-cols-3 lg:gap-8",
          )}
        >
          {tiles.map((tile) => (
            <li key={tile.id} className="w-[82%] shrink-0 snap-start sm:w-auto">
              <Tile
                tile={tile}
                href={localizedHref(locale, routes.category(tile.slug))}
                count={plural(locale, tile.productCount, messages.home.featured.pieces)}
                cta={t.viewProducts}
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
  href,
  count,
  cta,
}: {
  tile: CollectionTile;
  href: string;
  count: string;
  cta: string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Link
      href={href}
      className="group relative block aspect-[3/4] overflow-hidden bg-[#2a2522] text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      {/* Slow hover drift (8s), separate from the load-in settle on the image. */}
      <div className="absolute inset-0 transition-transform duration-[8000ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] motion-reduce:transition-none [@media(hover:hover)]:group-hover:scale-115">
        {tile.imageUrl ? (
          <Image
            src={tile.imageUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 31vw, (min-width: 640px) 48vw, 82vw"
            onLoad={() => setLoaded(true)}
            data-loaded={loaded || undefined}
            className="zoom-in-image object-cover"
          />
        ) : (
          <ImagePlaceholder wordmark={false} />
        )}
      </div>
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_top,rgb(0_0_0/0.55),transparent_50%)] transition-opacity duration-500 group-hover:opacity-80"
      />
      {/* Inner frame line, drawn just inside the edge. */}
      <span aria-hidden className="pointer-events-none absolute inset-3 border border-white/25" />

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-8 text-center sm:pb-10">
        <p className="caps text-[0.625rem] font-medium opacity-85">{count}</p>
        <h3 className="mt-2 font-display text-2xl leading-tight font-medium break-words drop-shadow-[0_1px_2px_rgb(0_0_0/0.3)] sm:text-[1.75rem]">
          {tile.name}
        </h3>
        <span className="sr-only">{cta}</span>
        <span
          aria-hidden
          className="mt-5 grid size-11 place-items-center rounded-full border border-white/70 transition-colors duration-300 group-hover:bg-white group-hover:text-[#291113]"
        >
          <ArrowUpRight
            strokeWidth={1.5}
            className="size-4 transition-transform duration-300 group-hover:rotate-45 rtl:-scale-x-100"
          />
        </span>
      </div>
    </Link>
  );
}
