import { getLocale, getMessages } from "@/lib/i18n/server";
import { getStoreContact, whatsappHref } from "@/lib/store/contact";

/**
 * Floating "Chat on WhatsApp" button, bottom right on every page (mounted by
 * the [lang] root layout). Uses the number an admin published (mirna-admin
 * Settings → Contact information, same cached read as the footer; else
 * STORE_WHATSAPP_NUMBER, see getStoreContact); nothing is shown without one. The chat opens with a short greeting in the visitor's language.
 */
export async function WhatsAppButton() {
  const [locale, messages, { contact }] = await Promise.all([
    getLocale(),
    getMessages(),
    getStoreContact(),
  ]);
  if (!contact.whatsapp) return null;

  const t = messages.common;
  const href = `${whatsappHref(contact.whatsapp)}?text=${encodeURIComponent(t.whatsappGreeting)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      lang={locale}
      aria-label={t.whatsappLabel}
      title={t.whatsappTitle}
      // Below drawers, dialogs and the wishlist prompt (z-50); clear of the
      // iPhone home indicator. Physical right in both languages.
      className="fixed right-[calc(1rem+env(safe-area-inset-right))] bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 inline-flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#25D366] motion-reduce:transition-none motion-reduce:hover:scale-100 sm:right-[calc(1.5rem+env(safe-area-inset-right))] sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] print:hidden"
    >
      <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="size-7">
        <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.29A11.81 11.81 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41" />
      </svg>
    </a>
  );
}
