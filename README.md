# Mirna Storefront

Customer-facing storefront for the **Mirna** ecommerce platform. It is UAE-first (AE · AED · `en-AE` · Asia/Dubai · English/Arabic) and can add more countries, currencies and languages without a rewrite.

> **Status: Phase 7 (product details).** Phase 5 built the storefront foundation (layout, navigation, i18n EN/AR with LTR/RTL, Light/Dark/System themes, PWA, SEO, error and loading UI, Supabase clients). Phase 6 connected the real Supabase catalogue: product listing, category pages, search, filters, sorting and pagination (see [Catalogue](#catalogue)). Phase 7 adds the product details page (see [Product details](#product-details)).
> Customer auth (Phase 8) and the cart (Phase 9) are **not** built yet.

---

## Architecture

```text
                 ┌───────────────────────────┐
                 │   Supabase (one project)  │
                 │ PostgreSQL · Auth · RLS   │
                 │ Storage                   │
                 └─────────────┬─────────────┘
              ┌────────────────┴────────────────┐
     ┌────────▼─────────┐              ┌────────▼──────────┐
     │   mirna-admin    │              │ mirna-storefront  │
     │ (separate repo)  │              │   (this repo)     │
     │  Admin PWA       │              │  Customer PWA     │
     └──────────────────┘              └───────────────────┘
```

- **`mirna-storefront` and `mirna-admin` are two separate applications in two separate repositories.** They use the **same Supabase project**: one database, one set of auth users, one Storage, one set of RLS policies.
- **`mirna-admin` owns the database schema.** All migrations live in `mirna-admin/supabase/migrations/`. This repo has **no migrations** and never creates tables. The storefront reads the shared `categories`, `products` and `product_images` tables.
- There is no separate backend. Server logic runs in Next.js Server Components and Server Actions. PostgreSQL RLS enforces authorization.

### Tech stack

| Concern      | Choice                                                                                |
| ------------ | ------------------------------------------------------------------------------------- |
| Framework    | Next.js 16 (App Router, Cache Components, `proxy.ts`), React 19                       |
| Language     | TypeScript (strict)                                                                   |
| Styling      | Tailwind CSS v4 with semantic design tokens (`app/globals.css`)                       |
| Backend      | Supabase: PostgreSQL, Auth, Storage, RLS (shared with mirna-admin)                    |
| Supabase SDK | `@supabase/ssr` (cookie sessions) + `@supabase/supabase-js`                           |
| i18n         | Built-in: `app/[lang]` routing + `next/root-params` + JSON messages (no i18n library) |
| Icons        | `lucide-react`                                                                        |
| Lint/format  | ESLint (`eslint-config-next`), Prettier                                               |

The stack and conventions match mirna-admin on purpose: the same i18n, theme and Supabase patterns. The storefront's visual design is its own: an editorial fashion-store style modelled on the layout of [kamin.ae](https://kamin.ae/), described under [Visual design](#visual-design).

### Project layout

```text
app/
  [lang]/                    # every page is under a locale: /en/…, /ar/…
    layout.tsx               # root layout: <html lang dir>, fonts, theme script, metadata
    error.tsx                # errors in the storefront chrome
    (public)/                # storefront pages, wrapped in header + footer
      layout.tsx             # skip link, Header, <main>, Footer
      page.tsx               # home
      products/              # catalogue (Phase 6); [slug]/ product details (Phase 7)
      categories/            # category listing; [slug]/ is the canonical category page
      about/ contact/        # placeholders (content)
      account/ cart/         # header entry points (Phase 8 / Phase 9), noindex
      [...rest]/             # unknown URLs → localized 404 inside the layout
      loading.tsx, error.tsx, not-found.tsx
  manifest.ts robots.ts sitemap.ts
  global-not-found.tsx global-error.tsx      # last-resort, bilingual
components/
  layout/      Header, Footer, MobileNav, Brand (wordmark, the only logo), ErrorView
  navigation/  NavLinks, SearchForm, MobileSearch, AccountLink/CartLink,
               LocaleMenu/LocaleSwitcher, ThemeMenu/ThemeSwitcher
  catalogue/   ProductCard, ProductGrid, ProductPrice, CategoryCard, CatalogueView,
               CatalogueToolbar, CatalogueFilters, FilterDrawer, SortSelect, SearchInput,
               Pagination, EmptyCatalogue, Breadcrumbs, skeletons, CatalogueNavigation
  product/     ProductGallery (the only client component on the product page)
  home/        Hero, SectionHeading, PlaceholderGrid, PromoBanner, CategoryTiles
  page/        ComingSoonPage, NotFoundContent
  ui/          Button, Container, Card, Badge, Input, Modal, Sheet, Dropdown,
               Skeleton/SectionSkeleton/PageSkeleton, StatusState, Spinner, Separator
  pwa/         service worker registration
config/
  site.ts        name, public URL, brand colour, contact/social (empty until real)
  navigation.ts  route paths + localizedHref(); product(slug)/category(slug) ready
  i18n.ts        locales + direction
  region.ts      country / currency / timezone (the only place they are set)
lib/
  supabase/      client.ts · server.ts · proxy.ts · public.ts · env.ts · database.types.ts
  i18n/          server/client message access, Accept-Language matching, locale switching
  catalogue/     params.ts (URL state: parse/validate/build hrefs) · queries.ts (cached anon reads)
  format.ts      formatPrice / formatDateTime (Intl, market-aware)
  money.ts       decimal-string parsing/comparison (BigInt minor units, no floats)
  seo.ts         pageMetadata(): canonical, hreflang, Open Graph, Twitter
  theme.ts       theme cookie + no-flash init script
messages/        en.json, ar.json (ar must have every en key, checked by TypeScript)
public/          icons/ (icon.svg is the source mark), sw.js, offline.html
scripts/         generate-icons.mjs
types/domain.ts  Category / Product / ProductImage picked from the generated DB types
```

---

## Environment variables

Copy `.env.example` to `.env.local`. **Never commit `.env.local`.** `.gitignore` excludes every `.env*` file except the example.

| Variable                        | Required | Notes                                                                                                                                                                           |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | yes      | The **same** project URL as mirna-admin                                                                                                                                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes      | The anon key (or the publishable `sb_publishable_…` key). It is browser-safe because RLS applies. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (mirna-admin's name for it) also works |
| `NEXT_PUBLIC_SITE_URL`          | prod     | Public origin used for canonical URLs, Open Graph, robots and the sitemap. Defaults to `http://localhost:3006`                                                                  |
| `NEXT_PUBLIC_REGION`            | no       | Market from `config/region.ts` (default `AE`)                                                                                                                                   |
| `SUPABASE_PROJECT_ID`           | no       | Used only by `npm run db:types`                                                                                                                                                 |

The storefront **never uses `SUPABASE_SERVICE_ROLE_KEY`**. Do not add it here, and never give any secret a `NEXT_PUBLIC_` prefix.

## Supabase connection

| File                     | Where it runs                        | Acts as                                                                                            |
| ------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `lib/supabase/client.ts` | Client Components                    | The visitor (cookie session managed by `@supabase/ssr`)                                            |
| `lib/supabase/server.ts` | Server Components / Actions / Routes | The visitor (reads request cookies); use for anything personal                                     |
| `lib/supabase/proxy.ts`  | `proxy.ts` (Next 16's middleware)    | Refreshes the session cookie on each request. No network call for guests                           |
| `lib/supabase/public.ts` | Server, cache-safe (`"use cache"`)   | Always `anon`, with no cookies, so it is identical for everyone. Use it for public catalogue reads |

The security model is inherited from mirna-admin's RLS:

- The `anon` role can read only **active** categories, **active** products and those products' images.
- `inventory`, `profiles`, `addresses`, `orders` and `order_items` are not readable by anonymous visitors. Customers will only see their own rows once Phase 8+ adds auth.
- Tokens stay in cookies and are never copied to localStorage.
- Money is never handled as a float. Select NUMERIC columns as text (`.select("price::text")`) and display them with `formatPrice()`, which formats the decimal string exactly.
- `lib/supabase/database.types.ts` is a copy of the shared schema's types. Regenerate it after an admin migration with `npm run db:types`, or copy it from mirna-admin.

## Catalogue

All catalogue data comes from the shared Supabase tables `categories`, `products` and `product_images`. There are no storefront-specific tables or copies.

### Routes

| Route                | What it shows                                                                          |
| -------------------- | -------------------------------------------------------------------------------------- |
| `/products`          | All active products: search, category and price filters, sort, pagination              |
| `/categories`        | Active categories in admin `sort_order`, with image (or placeholder) and product count |
| `/categories/[slug]` | Canonical category page: the same catalogue UI, locked to that category                |
| `/products/[slug]`   | Link target for product cards. Phase 7 builds the real page; for now a noindex notice  |
| `/` (home)           | "New arrivals" (8 newest active products) and up to 3 category tiles                   |

`/products` and `/categories/[slug]` share one implementation (`components/catalogue/catalogue-view.tsx`). The header keeps the **Shop** and **Categories** links rather than loading every category into the menu.

### URL state

The URL is the only source of catalogue state, so refresh, shared links, bookmarks and Back/Forward all work.

| Param      | Values                                                                 | Invalid input                                                              |
| ---------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `q`        | Search text (max 100 chars)                                            | Wildcards/quotes stripped                                                  |
| `category` | An active category slug (on `/products`)                               | Unknown slug → "no products match your filters"                            |
| `minPrice` | Non-negative decimal, ≤ 3 decimals (Arabic-Indic digits accepted)      | Ignored (negative, NaN, text)                                              |
| `maxPrice` | Same                                                                   | Ignored; a reversed range is swapped                                       |
| `sort`     | `newest` (default), `price-asc`, `price-desc`, `name-asc`, `name-desc` | Falls back to `newest`                                                     |
| `page`     | 1, 2, …                                                                | Falls back to 1; past the end → "This page doesn't exist" + link to page 1 |

Example: `/en/products?q=candle&category=home-fragrance&minPrice=50&maxPrice=500&sort=price-asc&page=2`. Default values are left out of URLs. Changing search, a filter or the sort always resets to page 1. Parsing and href building live in `lib/catalogue/params.ts`.

### Search, filters, sorting and pagination

- **Search** matches the product **name** and **slug** with PostgreSQL `ILIKE` (each word in order: `oud candle` → `%oud%candle%`). SKU is treated as internal and is not searched. For a larger catalogue, add a `pg_trgm` GIN index in mirna-admin; the query does not need to change.
- **Filters**: category (links to the canonical category page, keeping search/price/sort) and a min/max price range in the market currency. There is no availability filter, because anonymous visitors cannot read `inventory` and stock must not be exposed.
- **Sorting** happens in the database. There is no `featured` field, so the default order is **newest first**. Every sort adds `id` as a tie-break so pages never overlap.
- **Pagination** is server-side (`range()` with an exact count), 20 products per page, using plain links that work without JavaScript.
- **Interaction**: search, sort and filters are small client islands that `router.push()` the new URL inside a transition. The current results dim (`aria-busy`) until the new ones arrive. Each control is a real GET form, so it also works before JavaScript loads. On phones and tablets the filters open in a drawer (`Sheet`, which slides in from the inline-end edge); from `lg` up they sit in a sticky sidebar.

### Supabase access and caching

- Reads use `lib/supabase/public.ts` (anon role, no cookies). RLS from mirna-admin returns only **active** categories, **active** products and images of active products. The queries also filter `is_active = true` explicitly, so visibility never depends on React.
- Product cards select only `id, name, slug, price::text, compare_at_price::text, currency_code`, the category name/slug and **one** image. No SKU, descriptions, inventory or admin fields are selected. `inventory` is not readable by anon at all.
- Category product counts come from an embedded aggregate (`products(count)`, counted under RLS, so only active products) in the same request as the categories. There are no N+1 queries.
- Query functions in `lib/catalogue/queries.ts` use `"use cache"` with `cacheLife("minutes")` and the `catalogue` tag. Results are the same for every visitor, so `/`, `/categories` and the sitemap prerender as static pages and revalidate about every minute. mirna-admin cannot revalidate this app's cache, so admin changes (deactivating a product, a new price) appear within about a minute.
- Supabase errors are logged on the server and replaced with a generic error. The visitor sees the friendly error boundary, never SQL or Supabase details.
- Products whose category is inactive stay visible in `/products` (the product itself is still active), but the category's page, tile and filter disappear.

### Product images and prices

- Image order: the `is_primary` image first, then the lowest `sort_order` (ordered and limited to 1 inside the query). With no image, the card shows the neutral placeholder tile.
- Alt text: `product_images.alt_text`, falling back to the product name.
- Images are served through `next/image`. Only this project's public Storage URLs are used (`next.config.ts` → `remotePatterns`). Any other URL falls back to the placeholder.
- Category tiles use `categories.image_url` from the admin, or a tonal placeholder.
- Prices are shown with `formatPrice()` in the product's own `currency_code` (AED today). They stay NUMERIC decimal strings end to end. `compare_at_price` is shown struck through, with a "Sale" badge and screen-reader labels, only when it is strictly greater than the price (compared with BigInt minor units in `lib/money.ts`). There are no computed discount percentages.

### Database migrations and indexes

**Phase 6 adds no migrations.** mirna-admin owns the schema, and the existing indexes already cover these queries:
`categories_active_sort_idx (sort_order, name) where is_active`, unique `categories.slug`, `products_active_created_at_idx (created_at desc) where is_active`, `products_category_id_idx`, unique `products.slug`, and `product_images_product_sort_idx (product_id, sort_order)`. Price and name sorting and `ILIKE` search are fine at the current catalogue size. If the catalogue grows into the thousands, add these in a mirna-admin migration: `products (price) where is_active`, `products (name) where is_active`, and `pg_trgm` GIN indexes on `products.name` and `products.slug`.

### PWA

Catalogue pages are ordinary HTML/RSC navigations. The service worker never caches them, so visitors never see stale prices offline, and offline navigations show `offline.html`. Product images come from Supabase Storage, which is cross-origin, so the service worker doesn't cache them either. Nothing in the catalogue is personal.

## Product details

`/products/[slug]` (`app/[lang]/(public)/products/[slug]/page.tsx`) is a Server Component. Only the image gallery is client-side.

- **Data:** `getProductDetail(slug)` in `lib/catalogue/queries.ts` makes **one** anon request: the active product (`is_active = true` in the query and under RLS), its category (null if the category is inactive) and all of its images. It is cached (`"use cache"`, `minutes`), so `generateMetadata` and the page share the result. No inventory is read. Malformed, unknown and inactive slugs render the product not-found page (`not-found.tsx`) with "Back to products" and `noindex`.
- **Layout:** breadcrumb (Home / Category / Product, or Home / Products / Product), then gallery | info. On mobile the order is image, name, price, short description, details, description. On desktop the info column is sticky.
- **Gallery** (`components/product/product-gallery.tsx`, no carousel library): primary image first, then `sort_order`. Thumbnails sit in a column at the inline start on desktop and in a scrollable row on mobile. Thumbnails are buttons with a visible selected state (`aria-current`). Arrow keys move between them (mirrored in RTL), as do Home and End. The large image has previous/next buttons, touch swipe, an "Image n of N" counter and a pulse until it loads. Alt text is `alt_text`, falling back to "{name}" or "{name}, image n". `next/image` serves sized images (`sizes`: 45vw desktop, 100vw mobile; 80px thumbnails). With no images, the page shows the storefront placeholder.
- **Info:** category link, name, price via `ProductPrice`/`formatPrice()` in the product's currency (compare-at only when it is greater than the price, compared with BigInt), short description, and a details list with category and **SKU**. The SKU is shown as a customer reference code, not used for search; remove the `<dt>`/`<dd>` pair to hide it. The full description is plain text (the admin uses a textarea), rendered with line breaks and never as HTML.
- **Availability:** not shown. Anonymous visitors cannot read `inventory`, and there is no safe public stock mechanism yet. It belongs with the cart/order phases.
- **Cart slot:** a plain "Online ordering is coming soon." note sits where Phase 9's Add to Cart will go. There is no button and no fake action.
- **SEO:** title = product name. Description = short description, else the description (trimmed to 160 characters at a word boundary), else "Shop {name} at Mirna.". The canonical is `/products/[slug]`, with hreflang alternates. Open Graph and Twitter use the primary image when there is one (`pageMetadata({ image })`). The page includes `Product` JSON-LD with name, description, SKU, images, category and an `Offer` (price and currency, without availability).

## Local development

```bash
npm install
cp .env.example .env.local     # fill in the shared Supabase URL + anon key
npm run dev                    # http://localhost:3006 (mirna-admin runs on :3005)
```

| Script              | Purpose                                                 |
| ------------------- | ------------------------------------------------------- |
| `npm run lint`      | ESLint                                                  |
| `npm run typecheck` | `next typegen` + `tsc --noEmit`                         |
| `npm run build`     | Production build                                        |
| `npm run format`    | Prettier                                                |
| `npm run icons`     | Regenerate PNG icons from `public/icons/icon.svg`       |
| `npm run db:types`  | Regenerate Supabase types (needs `SUPABASE_PROJECT_ID`) |

## UAE-first, global-ready configuration

`config/region.ts` is the single place for country, currency and timezone. It is kept in sync with mirna-admin:

```ts
AE: { countryCode: "AE", currencyCode: "AED", defaultLocale: "en", timezone: "Asia/Dubai" }
```

- The Intl locale is the UI language plus the market: `en-AE` or `ar-AE` (`toIntlLocale()` in `lib/format.ts`).
- `formatPrice(amount, locale, currencyCode?)` defaults to the active market's currency. Pass the record's own `currency_code` when you have it. Decimal places follow the currency (AED 2, KWD 3, JPY 0).
- To add a market (SAR, USD, EUR, GBP, INR, …), add a region entry and select it with `NEXT_PUBLIC_REGION`. Components never hard-code "AED".

## Visual design

The storefront follows an editorial fashion-store layout modelled on [kamin.ae](https://kamin.ae/). Only the layout and styling are reused: the content, branding and imagery are Mirna's own.

- **Palette:** a monochrome cream and near-black palette: `#fdf9f4` background, `#1c1b1b` text and buttons, white surfaces, with a matching dark theme. Corners are square and shadows are minimal.
- **Type:** Montserrat in uppercase with wide letter-spacing (the `caps` and `caps-wide` utilities) for headings, navigation and buttons. Nunito Sans for body text, and Tajawal for Arabic.
- **Header:** three columns, with the nav at the start, the **MIRNA** wordmark in the centre, and ACCOUNT · SEARCH · CART · language · theme at the end. On mobile it shows the menu, the wordmark, search and cart. It is transparent with white text over the full-bleed hero and turns solid when the page scrolls or the search panel opens (`.site-header` in `globals.css`, plus `HeaderState`).
- **Home page:** a full-viewport hero with copy in the bottom-start corner, then a centred section title with a short rule, a 4-column 2:3 grid of the newest products and a black "View all products" button. After that come a promotional band and a full-bleed row of up to three real category tiles.
- **Footer:** a white surface with columns for about, shop links, customer service and language, plus a small uppercase copyright line.
- **Hero image:** set `siteConfig.heroImage` (`config/site.ts`) to show real campaign photography. Until then a neutral tonal backdrop is shown instead of stock photos.

## Theme system

- Themes: **Light / Dark / System**. They are stored in a `theme` cookie (one year), not localStorage, so the browser tab and the installed PWA share the choice.
- An inline `<head>` script (`themeInitScript`) sets `data-theme` before first paint, so there is no flash of the wrong theme. "System" leaves the attribute unset and follows `prefers-color-scheme`.
- Colours are semantic CSS tokens in `app/globals.css` (`bg-background`, `text-primary`, `bg-brand-soft`, …). Components never use raw hex values.
- The header uses a theme menu. The mobile drawer uses an inline segmented control.

## i18n

- Routes are locale-prefixed: `/en/…` and `/ar/…`. English is the default.
- `proxy.ts` redirects unprefixed URLs to the visitor's language. It checks the `NEXT_LOCALE` cookie first, then `Accept-Language`, then the region default. It also remembers the language being browsed.
- All UI text lives in `messages/en.json` and `messages/ar.json`. TypeScript fails the build if `ar.json` is missing a key that `en.json` has.
- Server Components use `getMessages()` and `getLocale()`. Client Components use `useI18n()`.
- To add a language, add it to `config/i18n.ts`, add `messages/<code>.json`, and register it in `lib/i18n/messages.ts`.

## RTL / LTR

- The root layout sets `<html lang dir>` from the locale: Arabic is `rtl` and English is `ltr`.
- Both directions use the same components. Layouts use logical utilities (`ms-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `border-s/e`). Directional icons flip with `rtl:-scale-x-100`.
- The mobile drawer slides in from the inline-end edge: from the right in English and from the left in Arabic.
- Fonts: Nunito Sans (body), Montserrat (display) and Tajawal (Arabic), loaded with `next/font`. Arabic text uses Tajawal first. The `caps` utilities drop letter-spacing in Arabic, because tracking breaks letter joining and Arabic has no uppercase.

## PWA

- **Manifest** (`app/manifest.ts` → `/manifest.webmanifest`): name and short name "Mirna", `display: standalone`, `start_url: /`, theme colour `#1c1b1b`, background `#fdf9f4`, category `shopping`. It lists SVG, 192px, 512px and maskable icons.
- **Icons**: `public/icons/icon.svg` is a **placeholder** "M" mark (cream on near-black). To rebrand, replace that file and run `npm run icons` to regenerate the favicon, Apple touch icon and PWA icons. `components/layout/brand.tsx` (the header/footer wordmark) is the only place the logo is rendered.
- **Service worker** (`public/sw.js`, registered in production builds only) is deliberately conservative:
  - It caches only content-hashed `/_next/static/*` assets, `/icons/*` and `offline.html`.
  - It never caches HTML or RSC pages, non-GET requests, or any cross-origin request (Supabase Auth, REST and Storage go straight to the network). It therefore never stores account, cart, order, address or payment data.
  - When a navigation fails offline, it shows a bilingual `offline.html`. There is no offline checkout or account editing.
- The storefront never shows an install prompt. Installing is left entirely to the browser.

## SEO

- Root metadata provides `metadataBase` (from `NEXT_PUBLIC_SITE_URL`), a title template, a description, icons, Apple web-app settings and a theme colour for both colour schemes.
- `pageMetadata()` (`lib/seo.ts`) gives each page a canonical URL, `hreflang` alternates (`en-AE`, `ar-AE`, `x-default`), Open Graph (`og:locale` `en_AE`/`ar_AE`) and a Twitter card. Account and cart are `noindex`.
- `/robots.txt` and `/sitemap.xml` (with language alternates) are generated. The sitemap lists every active category page (`/categories/[slug]`) and product page (`/products/[slug]`).
- Catalogue SEO: `/products` and `/categories` have their own title/description. `/categories/[slug]` builds its title and description from the real category (name; description, or "Discover products in {name}."). Unknown or inactive slugs return the localized 404 with `noindex`.
- Canonical URLs: `/products?…` (search, sort, page, `?category=`) always declares `/products` as canonical, and `/categories/[slug]` is the canonical page for a category. Category filter links in the sidebar go to the category page, so filtered `/products` URLs don't compete with it.
- The share image is currently the placeholder mark. Replace it once campaign imagery exists.

## Accessibility

- Semantic landmarks are used throughout: a skip link, `header`, labelled `nav`s, `main` and `footer`. Each page has one `h1`, and section headings follow in order.
- Every icon-only control has an accessible name. Active links use `aria-current`.
- The mobile drawer and modals are built on `<dialog>`, which gives a focus trap, Escape to close, focus return to the opener and an inert background. The search panel and dropdowns close on Escape.
- Focus rings are visible. Touch targets are 44px or larger. Reduced-motion preferences are respected.

## Deployment

The app deploys to any Next.js 16 host, for example Vercel:

1. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the **same project as mirna-admin**, and set `NEXT_PUBLIC_SITE_URL` to the public origin.
2. Run `npm run build`. Real pages prerender as static HTML for both locales.
3. In Supabase → Auth → URL configuration, add the storefront origin when customer auth arrives (Phase 8).
4. Bump `VERSION` in `public/sw.js` if the caching rules change.
