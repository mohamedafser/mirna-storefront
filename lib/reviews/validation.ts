/** Review form fields and their rules (shared by the form and the Server Action). */

export const REVIEW_TITLE_MAX = 120;
export const REVIEW_BODY_MIN = 10;
export const REVIEW_BODY_MAX = 2000;

export interface ReviewInput {
  rating: string;
  title: string;
  body: string;
}

export type ReviewFieldError = "ratingRequired" | "titleTooLong" | "bodyTooShort" | "bodyTooLong";

export type ReviewFieldErrors = Partial<Record<keyof ReviewInput, ReviewFieldError>>;

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

export function readReview(data: FormData): ReviewInput {
  return {
    rating: text(data.get("rating")),
    title: text(data.get("title")).trim(),
    body: text(data.get("body")).trim(),
  };
}

export function parseRating(value: string): number | null {
  return /^[1-5]$/.test(value) ? Number(value) : null;
}

export function validateReview(input: ReviewInput): ReviewFieldErrors {
  const errors: ReviewFieldErrors = {};
  if (parseRating(input.rating) === null) errors.rating = "ratingRequired";
  if (input.title.length > REVIEW_TITLE_MAX) errors.title = "titleTooLong";
  if (input.body.length < REVIEW_BODY_MIN) errors.body = "bodyTooShort";
  else if (input.body.length > REVIEW_BODY_MAX) errors.body = "bodyTooLong";
  return errors;
}
