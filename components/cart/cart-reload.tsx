"use client";

import { useEffect } from "react";
import { useCart } from "./cart-provider";

/** Re-reads the cart once on mount (the order confirmation page: the cart was just emptied). */
export function CartReload() {
  const { reload } = useCart();
  useEffect(() => {
    reload();
    // Once per mount; `reload` changes whenever the cart does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
