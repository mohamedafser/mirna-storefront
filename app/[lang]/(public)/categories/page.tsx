import { LayoutGrid } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/catalogue/breadcrumbs";
import { CategoryCard } from "@/components/catalogue/category-card";
import { CategoryGridSkeleton } from "@/components/catalogue/catalogue-skeleton";
import { SectionHeading } from "@/components/home/section-heading";
import { buttonClassName } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { StatusState } from "@/components/ui/states";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { getActiveCategories } from "@/lib/catalogue/queries";
import type { Messages } from "@/lib/i18n/messages";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.pages.categories;
  return pageMetadata({
    locale,
    path: routes.categories,
    siteName: messages.site.name,
    title: t.title,
    description: t.description,
  });
}

/** Active categories in admin display order, each linking to its page. */
export default async function CategoriesPage() {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.catalogue;

  return (
    <Container size="wide" className="py-10 sm:py-14">
      <Breadcrumbs
        label={t.breadcrumb}
        items={[
          { label: messages.nav.home, href: localizedHref(locale, routes.home) },
          { label: t.categoriesTitle },
        ]}
      />
      <div className="mt-8">
        <SectionHeading
          as="h1"
          id="page-title"
          title={t.categoriesTitle}
          subtitle={t.categoriesSubtitle}
        />
      </div>
      <div className="mt-12 sm:mt-14">
        <Suspense fallback={<CategoryGridSkeleton label={t.loadingCategories} />}>
          <CategoryList locale={locale} messages={messages} />
        </Suspense>
      </div>
    </Container>
  );
}

async function CategoryList({ locale, messages }: { locale: Locale; messages: Messages }) {
  const t = messages.catalogue;
  const categories = await getActiveCategories();

  if (categories.length === 0) {
    return (
      <div className="border bg-card px-6">
        <StatusState
          icon={LayoutGrid}
          title={t.noCategoriesTitle}
          description={t.noCategoriesBody}
          className="py-16 sm:py-24"
          action={
            <Link href={localizedHref(locale, routes.products)} className={buttonClassName()}>
              {t.viewAllProducts}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category, index) => (
        <li key={category.id}>
          <CategoryCard
            category={category}
            locale={locale}
            t={t}
            index={index}
            showDescription
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="aspect-[4/5]"
          />
        </li>
      ))}
    </ul>
  );
}
