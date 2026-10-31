import { jsonRoute } from "@/lib/api/json-route";
import { syncWishlist } from "@/lib/wishlist/actions";

/** POST { ids } → WishlistResult: merge the guest wishlist into the account. */
export const POST = jsonRoute((body) => syncWishlist(body.ids ?? []));
