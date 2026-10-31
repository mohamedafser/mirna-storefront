import { jsonRoute } from "@/lib/api/json-route";
import { addToWishlist } from "@/lib/wishlist/actions";

/** POST { productId } → WishlistResult. */
export const POST = jsonRoute((body) => addToWishlist(body.productId));
