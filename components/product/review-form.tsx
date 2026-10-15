"use client";

import { PencilLine, Star, Trash2 } from "lucide-react";
import { useActionState, useId, useState, useTransition } from "react";
import {
  FormMessage,
  SubmitButton,
  TextField,
  useClientValidation,
} from "@/components/auth/form-controls";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  deleteReview,
  saveReview,
  type ReviewError,
  type ReviewState,
} from "@/lib/reviews/actions";
import {
  readReview,
  REVIEW_BODY_MAX,
  REVIEW_TITLE_MAX,
  validateReview,
} from "@/lib/reviews/validation";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";
import type { MyReview } from "@/types/domain";

/**
 * Write / edit / delete the customer's own review. Shown only to verified
 * buyers (and to authors of an existing review); the Server Action and the
 * database check again. Collapsed behind a button until opened.
 */
export function ReviewForm({
  productId,
  review,
}: {
  productId: string;
  review: MyReview["review"];
}) {
  const { messages } = useI18n();
  const t = messages.reviews;
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<ReviewError | null>(null);
  const [deleting, startDelete] = useTransition();
  const initial = {
    rating: review ? String(review.rating) : "",
    title: review?.title ?? "",
    body: review?.body ?? "",
  };
  const [state, action, pending] = useActionState(
    async (prev: ReviewState, data: FormData) => {
      const next = await saveReview(productId, prev, data);
      if (next.saved) setOpen(false);
      return next;
    },
    { error: null, fieldErrors: {}, values: initial, saved: false } satisfies ReviewState,
  );
  const { clientErrors, onSubmit } = useClientValidation(
    (data) => validateReview(readReview(data)),
    pending,
  );
  const fieldErrors = clientErrors ?? state.fieldErrors;
  const errorText = (key: keyof typeof fieldErrors) => {
    const error = fieldErrors[key];
    return error && format(t.errors[error], { min: "10", max: String(REVIEW_BODY_MAX) });
  };

  const saved = !pending && state.saved && !open;

  return (
    <div className="grid gap-4 border-t pt-6">
      {saved && <FormMessage tone="success">{t.saved}</FormMessage>}
      {deleteError && <FormMessage>{t.errors[deleteError]}</FormMessage>}

      {review && !open && (
        <div className="grid gap-2">
          <p className="caps text-[0.6875rem] font-medium">{t.yourReview}</p>
          {review.hidden && <p className="text-xs text-warning">{t.hiddenNote}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <PencilLine aria-hidden />
              {t.edit}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden />
              {t.delete}
            </Button>
          </div>
        </div>
      )}

      {!review && !open && (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">{t.invite}</p>
          <Button variant="outline" onClick={() => setOpen(true)} className="justify-self-start">
            <PencilLine aria-hidden />
            {t.write}
          </Button>
        </div>
      )}

      {open && (
        <form action={action} onSubmit={onSubmit} noValidate className="grid gap-5">
          {!pending && state.error && <FormMessage>{t.errors[state.error]}</FormMessage>}
          <StarInput
            label={t.rating}
            defaultValue={state.values.rating}
            error={errorText("rating")}
          />
          <TextField
            label={t.reviewTitle}
            name="title"
            maxLength={REVIEW_TITLE_MAX}
            defaultValue={state.values.title}
            hint={t.optional}
            error={errorText("title")}
          />
          <TextArea
            label={t.body}
            name="body"
            maxLength={REVIEW_BODY_MAX}
            defaultValue={state.values.body}
            hint={t.bodyHint}
            error={errorText("body")}
          />
          <div className="flex flex-wrap gap-3">
            <SubmitButton
              pending={pending}
              label={review ? t.update : t.submit}
              pendingLabel={t.saving}
              className="sm:w-auto"
            />
            <Button variant="ghost" size="lg" disabled={pending} onClick={() => setOpen(false)}>
              {messages.cart.cancel}
            </Button>
          </div>
        </form>
      )}

      <Modal
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t.deleteTitle}
        description={t.deleteBody}
        dismissible={!deleting}
      >
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={deleting} onClick={() => setConfirmDelete(false)}>
            {messages.cart.cancel}
          </Button>
          <Button
            disabled={deleting}
            aria-busy={deleting}
            onClick={() =>
              startDelete(async () => {
                const error = await deleteReview(productId);
                setDeleteError(error);
                setConfirmDelete(false);
              })
            }
          >
            {t.deleteConfirm}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/** 1–5 star rating as a native radio group (arrow keys, labels from the browser). */
function StarInput({
  label,
  defaultValue,
  error,
}: {
  label: string;
  defaultValue: string;
  error?: string;
}) {
  const { messages } = useI18n();
  const t = messages.reviews;
  const id = useId();
  const [value, setValue] = useState(Number(defaultValue) || 0);
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <fieldset aria-describedby={error ? `${id}-error` : undefined}>
      <legend className={cn("caps text-[0.6875rem] font-medium", error && "text-error")}>
        {label}
      </legend>
      <div className="mt-2 flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <label
            key={star}
            onMouseEnter={() => setHover(star)}
            className="inline-flex size-11 cursor-pointer items-center justify-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"
          >
            <input
              type="radio"
              name="rating"
              value={star}
              checked={value === star}
              onChange={() => setValue(star)}
              className="sr-only"
            />
            <Star
              aria-hidden
              strokeWidth={1.5}
              className={cn(
                "size-6 transition-transform",
                star <= shown ? "fill-current text-foreground" : "text-muted-foreground/60",
                star === hover && "scale-110",
              )}
            />
            <span className="sr-only">{format(t.starsLabel, { count: String(star) })}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** Labelled multi-line field styled like TextField, with a character count. */
function TextArea({
  label,
  hint,
  error,
  maxLength,
  defaultValue,
  name,
}: {
  label: string;
  hint?: string;
  error?: string;
  maxLength: number;
  defaultValue: string;
  name: string;
}) {
  const id = useId();
  const [length, setLength] = useState(defaultValue.length);
  const describedBy = [error && `${id}-error`, `${id}-hint`].filter(Boolean).join(" ");
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="caps text-[0.6875rem] font-medium">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={5}
        maxLength={maxLength}
        defaultValue={defaultValue}
        onChange={(event) => setLength(event.target.value.length)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "w-full min-w-0 resize-y border border-border bg-card px-4 py-3 text-base text-foreground sm:text-sm",
          "transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground hover:border-input",
          "focus-visible:border-foreground focus-visible:ring-[3px] focus-visible:ring-ring/15 focus-visible:outline-none",
          error && "border-error",
        )}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-error">
          {error}
        </p>
      )}
      <p id={`${id}-hint`} className="flex justify-between gap-4 text-xs text-muted-foreground">
        <span>{hint}</span>
        <span className="tabular-nums">
          {length}/{maxLength}
        </span>
      </p>
    </div>
  );
}
