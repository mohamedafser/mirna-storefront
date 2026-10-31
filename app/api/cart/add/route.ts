import { jsonRoute } from "@/lib/api/json-route";
import { addToCart } from "@/lib/cart/actions";

/** POST { productId, variantId, quantity, guestQuantity } → CartResult. */
export const POST = jsonRoute((body) =>
  addToCart(body.productId, body.variantId, body.quantity, body.guestQuantity ?? 0),
);
