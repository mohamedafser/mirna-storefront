import { jsonRoute } from "@/lib/api/json-route";
import { syncCart } from "@/lib/cart/actions";

/** POST { lines } → CartResult: merge the guest cart into the signed-in customer's cart. */
export const POST = jsonRoute((body) => syncCart(body.lines ?? []));
