"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { ProductCardData } from "@/types/domain";

/**
 * The card's photo. It fades in once loaded (instead of popping in), zooms a
 * touch on hover and, when the product has a second photo, cross-fades to it
 * on devices with a mouse. The hover photo is display:none on touch screens,
 * so it is never downloaded there. Without JavaScript the photo shows as
 * normal (the fade-in is gated on `scripting: enabled` in globals.css).
 */
export function ProductCardImage({
  image,
  hoverImage,
  name,
  sizes,
  priority = false,
}: {
  image: NonNullable<ProductCardData["image"]>;
  hoverImage?: ProductCardData["hoverImage"];
  name: string;
  sizes: string;
  /** Load at once (first row above the fold). */
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const zoom =
    "object-cover transition-[opacity,scale] duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none";

  return (
    <>
      <Image
        src={image.url}
        alt={image.alt ?? name}
        fill
        sizes={sizes}
        loading={priority ? "eager" : undefined}
        fetchPriority={priority ? "high" : undefined}
        onLoad={() => setLoaded(true)}
        data-loaded={loaded || undefined}
        className={cn(
          "fade-image",
          zoom,
          hoverImage && "[@media(hover:hover)]:group-hover:opacity-0",
        )}
      />
      {hoverImage && (
        <Image
          src={hoverImage.url}
          alt=""
          aria-hidden
          fill
          sizes={sizes}
          className={cn(
            zoom,
            "hidden opacity-0 group-hover:opacity-100 [@media(hover:hover)]:block",
          )}
        />
      )}
    </>
  );
}
