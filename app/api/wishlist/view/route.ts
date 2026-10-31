import { jsonRoute } from "@/lib/api/json-route";
import { getWishlistView } from "@/lib/wishlist/actions";

/** POST { ids } → WishlistView. */
export const POST = jsonRoute((body) => getWishlistView(body.ids ?? []));
