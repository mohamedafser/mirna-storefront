import { jsonRoute } from "@/lib/api/json-route";
import { removeFromWishlist } from "@/lib/wishlist/actions";

/** POST { productId } → WishlistResult. */
export const POST = jsonRoute((body) => removeFromWishlist(body.productId));
