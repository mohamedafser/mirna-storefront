import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { publicImageUrl } from "@/lib/catalogue/queries";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Homepage hero images uploaded in mirna-admin (hero_slides, public read), in
 * slot order. Only this project's public Storage URLs are kept. A failed read
 * falls back to no slides, so the hero shows its default backdrop instead of
 * breaking the home page; that fallback is cached only for seconds, so a
 * fixed table or connection shows the slides again almost immediately.
 */
export async function getHeroSlides(): Promise<string[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("hero");

  const { data, error } = await createPublicClient()
    .from("hero_slides")
    .select("image_url")
    .order("position", { ascending: true });
  if (error) {
    console.error("[hero] slides failed", error.code, error.message);
    cacheLife("seconds");
    return [];
  }
  return data.map((row) => publicImageUrl(row.image_url)).filter((url) => url !== null);
}
