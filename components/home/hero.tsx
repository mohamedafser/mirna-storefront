import Image from "next/image";
import Link from "next/link";
import { HeaderOverlay, HeaderOverlayScript } from "@/components/navigation/header-state";
import { buttonClassName } from "@/components/ui/button";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import type { Messages } from "@/lib/i18n/messages";

/**
 * Full-viewport editorial hero. It slides under the header and switches it
 * to its transparent style (HeaderOverlay) while visible. It shows siteConfig.heroImage when
 * one is configured, otherwise a neutral tonal backdrop. Copy sits at the
 * bottom inline-start corner, mirrored in RTL.
 */
export function Hero({ locale, t }: { locale: Locale; t: Messages["home"]["hero"] }) {
  const image = siteConfig.heroImage;
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate -mt-[calc(var(--header-h)+env(safe-area-inset-top))] flex h-[100svh] max-h-[62rem] min-h-[34rem] items-end overflow-hidden bg-[#2a2522] text-white"
    >
      <HeaderOverlayScript />
      <HeaderOverlay />
      {image ? (
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
      {/* Legibility scrim for the copy (bottom) and the header (top). */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(0_0_0/0.55),transparent_45%),linear-gradient(to_bottom,rgb(0_0_0/0.3),transparent_25%)]"
      />

      <div className="mx-auto w-full max-w-[100rem] px-5 pb-12 sm:px-8 sm:pb-16 lg:px-12 lg:pb-20">
        <p className="caps text-[0.6875rem] font-medium opacity-90">{t.eyebrow}</p>
        <h1
          id="hero-title"
          className="caps mt-4 max-w-2xl text-2xl leading-snug font-medium text-balance sm:text-4xl"
        >
          {t.title}
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-pretty text-white/85 sm:text-base">
          {t.subtitle}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={localizedHref(locale, routes.products)}
            className={buttonClassName({ variant: "inverse" })}
          >
            {t.cta}
          </Link>
          <Link
            href={localizedHref(locale, routes.categories)}
            className={buttonClassName({ variant: "outline-inverse" })}
          >
            {t.secondaryCta}
          </Link>
        </div>
      </div>
    </section>
  );
}
