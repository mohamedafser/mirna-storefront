import { jsonRoute } from "@/lib/api/json-route";
import { removeFromCart } from "@/lib/cart/actions";

/** POST { productId, variantId } → CartResult (both null: empty the cart). */
export const POST = jsonRoute((body) =>
  removeFromCart(body.productId ?? null, body.variantId ?? null),
);
