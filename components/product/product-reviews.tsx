import { BadgeCheck, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { getCurrentCustomer, getCustomerAccess } from "@/lib/auth/dal";
import { REDIRECT_PARAM } from "@/lib/auth/redirect";
import { formatDateTime, toIntlLocale } from "@/lib/format";
import { format, plural, type Messages } from "@/lib/i18n/messages";
import { getMyReview, type ProductReviews as Reviews } from "@/lib/reviews/queries";
import { RatingStars } from "./rating-stars";
import { ReviewForm } from "./review-form";

/**
 * Customer reviews on the product page: the rating summary, the newest
 * published reviews (cached, public) and, streamed separately because it
 * depends on who is asking, the "write a review" area. Only verified buyers
 * (a delivered order containing the product) can write one; the database
 * enforces it, this only decides what to offer.
 */
export function ProductReviews({
  productId,
  productSlug,
  data,
  locale,
  messages,
}: {
  productId: string;
  productSlug: string;
  data: Reviews;
  locale: Locale;
  messages: Messages;
}) {
  const t = messages.reviews;
  const { summary, reviews } = data;
  const number = new Intl.NumberFormat(toIntlLocale(locale), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const percent = new Intl.NumberFormat(toIntlLocale(locale), { style: "percent" });

  return (
    <section
      id="reviews"
      aria-labelledby="reviews-title"
      className="mt-16 scroll-mt-[calc(var(--header-h)+1.5rem)] border-t pt-10 sm:mt-24 sm:pt-14"
    >
      <h2 id="reviews-title" className="caps text-xs font-medium sm:text-[0.8125rem]">
        {t.title}
      </h2>

      <div className="mt-8 grid gap-10 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-16">
        <div className="grid content-start gap-8">
          {summary.count > 0 ? (
            <div>
              <p className="flex items-end gap-3">
                <span className="text-4xl leading-none font-light tabular-nums">
                  {number.format(summary.average)}
                </span>
                <RatingStars
                  rating={summary.average}
                  size="md"
                  className="mb-1"
                  label={format(t.ratedOutOf, { rating: number.format(summary.average) })}
                />
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {plural(locale, summary.count, t.basedOn)}
              </p>
              <ul className="mt-5 grid gap-2" aria-label={t.breakdown}>
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = summary.stars[stars - 1];
                  const share = summary.count > 0 ? count / summary.count : 0;
                  return (
                    <li
                      key={stars}
                      className="grid grid-cols-[3.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-xs"
                    >
                      <span className="text-muted-foreground">
                        {plural(locale, stars, t.starCount)}
                      </span>
                      <span aria-hidden className="h-1.5 overflow-hidden bg-muted">
                        <span
                          className="block h-full bg-foreground"
                          style={{ width: `${share * 100}%` }}
                        />
                      </span>
                      <span className="text-end tabular-nums text-muted-foreground">
                        {percent.format(share)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t.noneYet}</p>
          )}

          <Suspense fallback={<Skeleton className="h-11 w-full" />}>
            <ReviewComposer
              productId={productId}
              productSlug={productSlug}
              locale={locale}
              messages={messages}
            />
          </Suspense>
        </div>

        {reviews.length > 0 ? (
          <ul className="grid content-start">
            {reviews.map((review) => (
              <li key={review.id} className="border-b py-6 first:pt-0 last:border-b-0">
                <article aria-label={format(t.reviewBy, { name: review.authorName })}>
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <RatingStars
                      rating={review.rating}
                      label={format(t.ratedOutOf, { rating: String(review.rating) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      <time dateTime={review.createdAt}>
                        {formatDateTime(review.createdAt, locale, { dateStyle: "medium" })}
                      </time>
                      {review.edited && ` · ${t.edited}`}
                    </p>
                  </div>
                  {review.title && (
                    <h3 className="mt-3 text-sm font-medium break-words">{review.title}</h3>
                  )}
                  {/* Customer text: plain text with line breaks, never parsed as HTML. */}
                  <p className="mt-2 text-sm leading-relaxed text-pretty break-words whitespace-pre-line text-muted-foreground">
                    {review.body}
                  </p>
                  <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="font-medium">{review.authorName}</span>
                    <span className="inline-flex items-center gap-1 text-success">
                      <BadgeCheck aria-hidden className="size-3.5" />
                      {t.verifiedBuyer}
                    </span>
                  </p>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 border border-dashed px-6 py-12 text-center">
            <MessageSquareText
              aria-hidden
              strokeWidth={1.25}
              className="size-8 text-muted-foreground"
            />
            <p className="text-sm text-muted-foreground">{t.beFirst}</p>
          </div>
        )}
      </div>
    </section>
  );
}

/** What this visitor can do: sign in, write, edit, or nothing (not a buyer). */
async function ReviewComposer({
  productId,
  productSlug,
  locale,
  messages,
}: {
  productId: string;
  productSlug: string;
  locale: Locale;
  messages: Messages;
}) {
  const t = messages.reviews;
  const user = await getCurrentCustomer();
  const productHref = localizedHref(locale, routes.product(productSlug));

  if (!user) {
    const login = `${localizedHref(locale, routes.login)}?${REDIRECT_PARAM}=${encodeURIComponent(productHref)}`;
    return (
      <p className="border-t pt-6 text-sm text-muted-foreground">
        {t.boughtIt}{" "}
        <Link href={login} className="font-medium text-foreground underline underline-offset-4">
          {t.signInToReview}
        </Link>
      </p>
    );
  }
  if (getCustomerAccess(user) !== "granted") return null;

  const mine = await getMyReview(productId);
  if (!mine) return null;
  if (!mine.review && !mine.eligible) {
    return <p className="border-t pt-6 text-sm text-muted-foreground">{t.onlyBuyers}</p>;
  }
  return <ReviewForm productId={productId} review={mine.review} />;
}
