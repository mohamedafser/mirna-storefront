import Image from "next/image";
import Link from "next/link";
import { HeaderOverlay, HeaderOverlayScript } from "@/components/navigation/header-state";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { HeroSlideshow } from "./hero-slideshow";
import type { Messages } from "@/lib/i18n/messages";

/**
 * Full-viewport editorial hero, lookbook style: the photography does the
 * talking, with only a small spaced-out caption in the bottom inline-start
 * corner (mirrored in RTL) and the whole banner linking to the collection.
 * It slides under the header and switches it to its transparent style
 * (HeaderOverlay) while visible. Background, in order: the slides uploaded in
 * mirna-admin (Homepage banner, cross-fading), else siteConfig.heroImage,
 * else a neutral tonal backdrop.
 */
export function Hero({
  locale,
  t,
  slides,
}: {
  locale: Locale;
  t: Messages["home"]["hero"];
  /** Public image URLs from getHeroSlides(). */
  slides: string[];
}) {
  const image = siteConfig.heroImage;
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate -mt-[calc(var(--header-h)+env(safe-area-inset-top))] flex h-[100svh] max-h-[62rem] min-h-[34rem] items-end overflow-hidden bg-[#2a2522] text-white"
    >
      <HeaderOverlayScript />
      <HeaderOverlay />
      {slides.length > 0 ? (
        <HeroSlideshow slides={slides} slideLabel={t.slide} />
      ) : image ? (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_70%_30%,#6b5646_0%,transparent_55%),radial-gradient(ellipse_at_20%_80%,#3d332c_0%,transparent_60%),linear-gradient(160deg,#4a3d34,#211c19)]"
        />
      )}
      {/* Light scrims so the caption (bottom) and the header (top) stay legible. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(0_0_0/0.35),transparent_35%),linear-gradient(to_bottom,rgb(0_0_0/0.25),transparent_22%)]"
      />

      <h1 id="hero-title" className="sr-only">
        {t.title}
      </h1>
      <div className="w-full px-6 pb-[4.375rem] sm:px-[1.875rem]">
        {/* The caption's link covers the whole banner (::after), like a lookbook slide. */}
        <Link
          href={localizedHref(locale, routes.products)}
          className="group/hero block max-w-[60%] drop-shadow-[0_1px_2px_rgb(0_0_0/0.3)] after:absolute after:inset-0 after:content-[''] sm:max-w-none"
        >
          <span className="block font-display text-2xl leading-tight font-medium sm:text-4xl">
            {t.caption}
          </span>
          {/* "Shop now" with a rule that stretches on hover. */}
          <span className="caps mt-4 flex items-center gap-3 text-[0.6875rem] font-medium">
            {t.shopNow}
            <span
              aria-hidden
              className="block h-px w-10 bg-white transition-[width] duration-500 ease-out group-hover/hero:w-20"
            />
          </span>
        </Link>
      </div>
    </section>
  );
}
