"use client";

import { useEffect } from "react";
import { recordRecentlyViewed } from "@/lib/recently-viewed";
import type { ProductCardData } from "@/types/domain";

/** Adds the open product to this browser's "Recently viewed" list. Renders nothing. */
export function RecordView({ product }: { product: ProductCardData }) {
  useEffect(() => {
    recordRecentlyViewed(product);
  }, [product]);
  return null;
}
