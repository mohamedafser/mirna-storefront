"use server";

import { refresh, updateTag } from "next/cache";
import { getCustomerOrNull } from "@/lib/auth/dal";
import { isProductId } from "@/lib/cart/rules";
import { createClient } from "@/lib/supabase/server";
import { reviewsTag } from "./queries";
import {
  parseRating,
  readReview,
  validateReview,
  type ReviewFieldErrors,
  type ReviewInput,
} from "./validation";

/**
 * Review Server Actions. Only the product id and the form fields come from
 * the browser. The database decides the rest: the author is the session's
 * user, the insert policy only accepts a verified buyer (a DELIVERED order
 * containing the product), and author_name / status are set by a trigger.
 */

export type ReviewError = "signedOut" | "notEligible" | "unexpected";

export interface ReviewState {
  error: ReviewError | null;
  fieldErrors: ReviewFieldErrors;
  values: ReviewInput;
  saved: boolean;
}

const hasErrors = (errors: ReviewFieldErrors) => Object.values(errors).some(Boolean);

/** Creates the customer's review of a product, or updates it if one exists. */
export async function saveReview(
  productId: string,
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const values = readReview(formData);
  const fieldErrors = validateReview(values);
  if (hasErrors(fieldErrors)) return { error: null, fieldErrors, values, saved: false };
  const fail = (error: ReviewError): ReviewState => ({
    error,
    fieldErrors: {},
    values,
    saved: false,
  });
  if (!isProductId(productId)) return fail("unexpected");

  const customer = await getCustomerOrNull();
  if (!customer) return fail("signedOut");

  const supabase = await createClient();
  const fields = {
    rating: parseRating(values.rating)!,
    title: values.title || null,
    body: values.body,
  };
  const { data: own, error: readError } = await supabase
    .rpc("my_product_review", { p_product_id: productId })
    .maybeSingle();
  if (readError) {
    console.error("[reviews] eligibility read failed", readError.code);
    return fail("unexpected");
  }

  let error;
  if (own?.review_id) {
    ({ error } = await supabase
      .from("product_reviews")
      .update(fields)
      .eq("id", own.review_id)
      .select("id")
      .single());
  } else {
    if (!own?.eligible) return fail("notEligible");
    ({ error } = await supabase
      .from("product_reviews")
      .insert({ product_id: productId, ...fields })
      .select("id")
      .single());
  }

  if (error) {
    // 42501: refused by the insert policy (no longer a verified buyer).
    if (error.code === "42501") return fail("notEligible");
    console.error("[reviews] save failed", error.code, error.message);
    return fail("unexpected");
  }

  updateTag(reviewsTag(productId));
  refresh();
  return { error: null, fieldErrors: {}, values, saved: true };
}

/** Deletes the customer's own review of a product. */
export async function deleteReview(productId: string): Promise<ReviewError | null> {
  if (!isProductId(productId)) return "unexpected";
  const customer = await getCustomerOrNull();
  if (!customer) return "signedOut";

  const supabase = await createClient();
  const { data: own } = await supabase
    .rpc("my_product_review", { p_product_id: productId })
    .maybeSingle();
  if (!own?.review_id) return null;
  const { error } = await supabase.from("product_reviews").delete().eq("id", own.review_id);
  if (error) {
    console.error("[reviews] delete failed", error.code, error.message);
    return "unexpected";
  }
  updateTag(reviewsTag(productId));
  refresh();
  return null;
}
