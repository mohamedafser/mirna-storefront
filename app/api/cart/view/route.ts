import { jsonRoute } from "@/lib/api/json-route";
import { getCartView } from "@/lib/cart/actions";

/** POST { lines } → CartView: the cart priced from current products. */
export const POST = jsonRoute((body) => getCartView(body.lines ?? []));
