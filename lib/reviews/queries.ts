import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { MyReview, ProductReview, ReviewSummary } from "@/types/domain";

/**
 * Product reviews (mirna-admin migration 027: product_reviews). Published
 * reviews are public and cached per product; the `reviews:<id>` tag is
 * expired by the review Server Actions so an author sees their change at
 * once. The caller's own review and eligibility are read per request.
 *
 * Until the migration is applied the table / functions don't exist: reads
 * return null and the product page simply leaves the section out.
 */

export const REVIEWS_PAGE_SIZE = 20;

export const reviewsTag = (productId: string) => `reviews:${productId}`;

/** Missing table or function (migration not applied yet). */
const MISSING = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);

function failed(context: string, error: { code?: string; message?: string }): null {
  if (!MISSING.has(error.code ?? "")) {
    console.error(`[reviews] ${context} failed`, error.code, error.message);
  }
  return null;
}

export interface ProductReviews {
  summary: ReviewSummary;
  reviews: ProductReview[];
}

/** The summary and newest published reviews of a product, or null if reviews are unavailable. */
export async function getProductReviews(productId: string): Promise<ProductReviews | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(reviewsTag(productId));

  const supabase = createPublicClient();
  const [summary, list] = await Promise.all([
    supabase.rpc("product_review_summary", { p_product_id: productId }).single(),
    supabase
      .from("product_reviews")
      .select("id, rating, title, body, author_name, created_at, updated_at")
      .eq("product_id", productId)
      .eq("status", "PUBLISHED")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(REVIEWS_PAGE_SIZE),
  ]);
  if (summary.error) return failed("summary", summary.error);
  if (list.error) return failed("list", list.error);

  const row = summary.data;
  return {
    summary: {
      count: row.review_count,
      average: Number(row.average_rating),
      stars: [row.stars_1, row.stars_2, row.stars_3, row.stars_4, row.stars_5],
    },
    reviews: list.data.map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      authorName: review.author_name,
      createdAt: review.created_at,
      // Saved again more than a minute after posting.
      edited: Date.parse(review.updated_at) - Date.parse(review.created_at) > 60_000,
    })),
  };
}

/**
 * The signed-in customer's eligibility and own review (any status). Call
 * only for an active customer; null when it can't be read.
 */
export async function getMyReview(productId: string): Promise<MyReview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("my_product_review", { p_product_id: productId })
    .maybeSingle();
  if (error) return failed("own review", error);
  if (!data) return { eligible: false, review: null };
  return {
    eligible: data.eligible,
    review:
      data.review_id && data.rating !== null && data.body !== null
        ? {
            id: data.review_id,
            rating: data.rating,
            title: data.title,
            body: data.body,
            hidden: data.status === "HIDDEN",
          }
        : null,
  };
}
