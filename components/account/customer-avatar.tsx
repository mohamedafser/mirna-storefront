import Image from "next/image";
import { cn } from "@/lib/utils/cn";

/**
 * A customer's Google profile picture, decorative because their name is beside
 * it. Customers who have none simply don't show one.
 */
export function CustomerAvatar({ url, className }: { url: string | null; className?: string }) {
  if (!url) return null;
  return (
    <span className={cn("relative block size-12 shrink-0 overflow-hidden rounded-full", className)}>
      <Image src={url} alt="" fill sizes="48px" className="object-cover" />
    </span>
  );
}
