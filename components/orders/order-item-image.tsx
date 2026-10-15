import Image from "next/image";
import type { OrderItemImage as ImageData } from "@/lib/orders/queries";
import { cn } from "@/lib/utils/cn";
import { ImagePlaceholder } from "@/components/catalogue/image-placeholder";

/**
 * Product image for an order line (decorative: the name is next to it). The
 * placeholder shows when the product is no longer on sale or has no image.
 */
export function OrderItemImage({
  image,
  sizes,
  className,
}: {
  image: ImageData | null;
  sizes: string;
  className?: string;
}) {
  return (
    <div className={cn("relative aspect-[2/3] shrink-0 overflow-hidden bg-brand-soft", className)}>
      {image ? (
        <Image src={image.url} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <ImagePlaceholder wordmark={false} />
      )}
    </div>
  );
}
