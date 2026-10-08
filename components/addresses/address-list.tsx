"use client";

import { LoaderCircle, MapPin, Pencil, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FormMessage } from "@/components/auth/form-controls";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StatusState } from "@/components/ui/states";
import { localizedHref, routes } from "@/config/navigation";
import { deleteAddress, setDefaultAddress, type AddressError } from "@/lib/addresses/actions";
import { MAX_ADDRESSES } from "@/lib/addresses/validation";
import { toIntlLocale } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/messages";
import type { Address } from "@/types/domain";
import { countryName, regionName } from "./address-format";

type Notice = { tone: "success"; text: string } | { tone: "error"; error: AddressError };

/**
 * Saved addresses (default first) with edit, delete (confirmed in a dialog)
 * and set/remove default. Actions run on the server and refresh the list.
 */
export function AddressList({
  addresses,
  canAdd,
  saved,
}: {
  addresses: Address[];
  canAdd: boolean;
  /** Just came back from the form after a successful save. */
  saved: boolean;
}) {
  const { locale, messages } = useI18n();
  const t = messages.addresses;
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Address | null>(null);
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);

  // Back from the form (?saved=1): confirm, then drop the flag from the URL so
  // a refresh doesn't repeat it. An effect, not initial state, because Next.js
  // may keep this page mounted between visits.
  useEffect(() => {
    if (!saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off message from the URL
    setNotice({ tone: "success", text: t.saved });
    router.replace(localizedHref(locale, routes.addresses), { scroll: false });
  }, [saved, router, locale, t.saved]);

  function run(id: string, action: () => ReturnType<typeof deleteAddress>, success: string) {
    setBusyId(id);
    setNotice(null);
    startTransition(async () => {
      const result = await action().catch(() => ({
        ok: false as const,
        error: "unexpected" as const,
      }));
      setNotice(
        result.ok ? { tone: "success", text: success } : { tone: "error", error: result.error },
      );
      setBusyId(null);
      setToDelete(null);
    });
  }

  const addLink = (
    <Link href={localizedHref(locale, routes.newAddress)} className={buttonClassName()}>
      {t.add}
    </Link>
  );

  return (
    <div className="grid gap-6">
      <div aria-live="polite" className="empty:hidden">
        {notice &&
          (notice.tone === "success" ? (
            <FormMessage tone="success">{notice.text}</FormMessage>
          ) : (
            <FormMessage>{t.errors[notice.error]}</FormMessage>
          ))}
      </div>

      {addresses.length === 0 ? (
        <div className="border bg-card px-6">
          <StatusState
            icon={MapPin}
            title={t.emptyTitle}
            description={t.emptyBody}
            className="py-16 sm:py-24"
            action={addLink}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {format(t.limitNote, {
                count: new Intl.NumberFormat(toIntlLocale(locale)).format(MAX_ADDRESSES),
              })}
            </p>
            {canAdd && addLink}
          </div>
          <ul className="grid gap-4 sm:grid-cols-2" aria-busy={pending}>
            {addresses.map((address) => {
              const busy = busyId === address.id;
              const region = regionName(address, t);
              return (
                <li
                  key={address.id}
                  className="flex flex-col border bg-card p-5 sm:p-6"
                  aria-busy={busy}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{address.fullName}</p>
                    {address.isDefault && <Badge tone="primary">{t.defaultBadge}</Badge>}
                  </div>
                  <address className="mt-3 grid gap-0.5 text-sm text-muted-foreground not-italic">
                    <span>{address.line1}</span>
                    {address.line2 && <span>{address.line2}</span>}
                    <span>
                      {[address.city, region].filter(Boolean).join(locale === "ar" ? "، " : ", ")}
                    </span>
                    <span>
                      {countryName(address.countryCode, locale)}
                      {address.postalCode && (
                        <>
                          {" "}
                          <span dir="ltr">{address.postalCode}</span>
                        </>
                      )}
                    </span>
                    <span dir="ltr" className="mt-1 justify-self-start">
                      {address.phone}
                    </span>
                  </address>

                  <div className="mt-auto flex flex-wrap items-center gap-x-1 gap-y-2 pt-5">
                    <Link
                      href={localizedHref(locale, routes.editAddress(address.id))}
                      aria-label={format(t.editLabel, { name: address.fullName })}
                      className={buttonClassName({
                        variant: "ghost",
                        size: "sm",
                        className: "-ms-4",
                      })}
                    >
                      <Pencil aria-hidden />
                      {t.edit}
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      aria-busy={busy}
                      onClick={() =>
                        run(
                          address.id,
                          () => setDefaultAddress(address.id, !address.isDefault),
                          t.defaultUpdated,
                        )
                      }
                    >
                      {busy && !toDelete ? (
                        <LoaderCircle aria-hidden className="animate-spin" />
                      ) : (
                        <Star aria-hidden />
                      )}
                      {address.isDefault ? t.unsetDefault : t.setDefault}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      aria-label={format(t.deleteLabel, { name: address.fullName })}
                      onClick={() => setToDelete(address)}
                    >
                      <Trash2 aria-hidden />
                      {t.delete}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Modal
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t.deleteTitle}
        description={toDelete ? format(t.deleteBody, { name: toDelete.fullName }) : undefined}
        dismissible={!pending}
      >
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={pending} onClick={() => setToDelete(null)}>
            {t.cancel}
          </Button>
          <Button
            disabled={pending}
            aria-busy={pending}
            onClick={() =>
              toDelete && run(toDelete.id, () => deleteAddress(toDelete.id), t.deleted)
            }
          >
            {pending && <LoaderCircle aria-hidden className="animate-spin" />}
            {t.deleteConfirm}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
