import { serializeJsonLd, type JsonLdNode } from "@/lib/structured-data";

/** Structured data for a page. Several nodes are sent as one @graph. */
export function JsonLd({ data }: { data: JsonLdNode | readonly JsonLdNode[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
