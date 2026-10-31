import { jsonRoute } from "@/lib/api/json-route";
import { setCartQuantity } from "@/lib/cart/actions";

/** POST { productId, variantId, quantity } → CartResult. */
export const POST = jsonRoute((body) =>
  setCartQuantity(body.productId, body.variantId, body.quantity),
);
