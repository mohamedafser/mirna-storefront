import { Container } from "@/components/ui/container";
import { PageSkeleton } from "@/components/ui/skeleton";
import { getMessages } from "@/lib/i18n/server";

// Instant fallback while a storefront page streams in (header/footer stay).
export default async function Loading() {
  const messages = await getMessages();
  return (
    <Container>
      <PageSkeleton label={messages.common.loading} />
    </Container>
  );
}
