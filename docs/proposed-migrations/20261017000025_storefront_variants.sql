-- PROPOSED for mirna-admin (the repo that owns the schema). Copy this file to
-- mirna-admin/supabase/migrations/ unchanged and apply it there BEFORE
-- deploying the storefront's variant support. This repo has no migrations.
--
-- 025 · Storefront product options & variant purchasing (storefront Phase 19)
--
-- Lets mirna-storefront show a product's attributes, let customers pick a
-- variant (Size × Colour …) and buy exactly that variant, safely:
--
--   1. Public read of ACTIVE attributes / values / product attributes and of
--      ACTIVE variants of ACTIVE products (anon + authenticated). Stock stays
--      private: variant_inventory gets no new grant or policy.
--   2. variant_availability(): a yes/no per purchasable variant (like
--      product_availability() in 016), never quantities.
--   3. cart_items.variant_id (nullable). A product WITH variants is bought
--      per variant (one line per variant); a simple product keeps one line
--      per product with variant_id NULL. The insert policy only accepts a
--      line that matches the product's configuration.
--   4. order_items.variant_id + variant_label (nullable snapshots).
--   5. place_order() (017) re-created with the SAME signature: lines for a
--      variant are checked against that variant (active, values active,
--      enough variant stock) and priced from product_variants; simple lines
--      behave exactly as before.
--
-- Additive: no column, table or row is dropped. The only constraint replaced
-- is cart_items_user_product_key (unique per customer + product), which a
-- product with variants can't satisfy; it is replaced by two partial unique
-- indexes that keep the same rule for simple products. Existing cart lines are
-- untouched: a NULL-variant line for a product that now has variants is shown
-- by the storefront as "choose options" and refused by place_order().
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------

-- Target for the cart line's composite FK (the variant must belong to the
-- line's product).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'product_variants_product_id_id_key'
  ) then
    alter table public.product_variants
      add constraint product_variants_product_id_id_key unique (product_id, id);
  end if;
end;
$$;

-- A variant can be sold when it, its product, and every attribute and value
-- it is made of are active. (Stock is checked separately.)
create or replace function private.variant_purchasable(p_variant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = p_variant_id
      and v.is_active
      and p.is_active
      and exists (select 1 from public.variant_attribute_values vav where vav.variant_id = v.id)
      and not exists (
        select 1
        from public.variant_attribute_values vav
        join public.attributes a on a.id = vav.attribute_id
        join public.attribute_values av on av.id = vav.attribute_value_id
        where vav.variant_id = v.id
          and (not a.is_active or not av.is_active)
      )
  );
$$;

-- A cart line is valid when the product is active and the line matches its
-- configuration: a product with variants (active or not) needs a purchasable
-- variant of that product; a simple product needs no variant.
create or replace function private.cart_line_sellable(p_product_id uuid, p_variant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not exists (select 1 from public.products where id = p_product_id and is_active)
      then false
    when p_variant_id is null
      then not exists (select 1 from public.product_variants where product_id = p_product_id)
    else exists (
      select 1 from public.product_variants
      where id = p_variant_id and product_id = p_product_id
    ) and private.variant_purchasable(p_variant_id)
  end;
$$;

revoke all on function private.variant_purchasable(uuid) from public, anon, authenticated;
revoke all on function private.cart_line_sellable(uuid, uuid) from public, anon;
-- Used by the cart_items insert policy, which runs as the customer.
grant execute on function private.cart_line_sellable(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Public read access (active rows only)
-- ---------------------------------------------------------------------------
-- authenticated already has SELECT on these tables (023/024); its admin-only
-- policies are kept and the public policies below are OR-ed with them.

grant select on table
  public.attributes,
  public.attribute_values,
  public.product_attributes,
  public.product_type_attributes,
  public.variant_attribute_values
to anon;
-- Column grant: anon never sees combination_key or timestamps.
grant select (id, product_id, sku, price, compare_at_price, image_id, is_active, sort_order)
  on table public.product_variants to anon;

drop policy if exists attributes_select_active_public on public.attributes;
create policy attributes_select_active_public on public.attributes
  for select to anon, authenticated
  using (is_active);

drop policy if exists attribute_values_select_active_public on public.attribute_values;
create policy attribute_values_select_active_public on public.attribute_values
  for select to anon, authenticated
  using (
    is_active
    and exists (select 1 from public.attributes a where a.id = attribute_id and a.is_active)
  );

-- Only ordering metadata (type ↔ attribute, sort order, required flag).
drop policy if exists product_type_attributes_select_public on public.product_type_attributes;
create policy product_type_attributes_select_public on public.product_type_attributes
  for select to anon, authenticated
  using (exists (select 1 from public.attributes a where a.id = attribute_id and a.is_active));

drop policy if exists product_attributes_select_active_public on public.product_attributes;
create policy product_attributes_select_active_public on public.product_attributes
  for select to anon, authenticated
  using (
    exists (select 1 from public.products p where p.id = product_id and p.is_active)
    and exists (select 1 from public.attributes a where a.id = attribute_id and a.is_active)
  );

drop policy if exists product_variants_select_active_public on public.product_variants;
create policy product_variants_select_active_public on public.product_variants
  for select to anon, authenticated
  using (
    is_active
    and exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );

-- Rows of visible (active) variants only; product_variants' RLS applies inside.
drop policy if exists variant_attribute_values_select_active_public on public.variant_attribute_values;
create policy variant_attribute_values_select_active_public on public.variant_attribute_values
  for select to anon, authenticated
  using (exists (select 1 from public.product_variants v where v.id = variant_id));

-- ---------------------------------------------------------------------------
-- 3. Public availability per variant (yes/no only)
-- ---------------------------------------------------------------------------
-- Purchasable variants among the ids, and whether at least one unit can be
-- ordered right now. Unknown, inactive or unpurchasable ids are absent.
-- Bounded to 500 ids per call (generate_product_variants' maximum).
create or replace function public.variant_availability(p_variant_ids uuid[])
returns table (variant_id uuid, available boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, coalesce(vi.quantity - vi.reserved_quantity > 0, false)
  from public.product_variants v
  left join public.variant_inventory vi on vi.variant_id = v.id
  where v.id = any (p_variant_ids[1:500])
    and private.variant_purchasable(v.id);
$$;

revoke all on function public.variant_availability(uuid[]) from public;
grant execute on function public.variant_availability(uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Cart lines per variant
-- ---------------------------------------------------------------------------

alter table public.cart_items add column if not exists variant_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cart_items_variant_fkey') then
    -- A deleted variant takes its cart lines with it.
    alter table public.cart_items
      add constraint cart_items_variant_fkey foreign key (product_id, variant_id)
        references public.product_variants (product_id, id) on delete cascade;
  end if;
end;
$$;

-- Same rule as before for simple products; one line per variant otherwise.
create unique index if not exists cart_items_user_product_simple_key
  on public.cart_items (user_id, product_id) where variant_id is null;
create unique index if not exists cart_items_user_variant_key
  on public.cart_items (user_id, variant_id) where variant_id is not null;
create index if not exists cart_items_user_id_idx on public.cart_items (user_id, created_at);
create index if not exists cart_items_variant_id_idx
  on public.cart_items (variant_id) where variant_id is not null;
alter table public.cart_items drop constraint if exists cart_items_user_product_key;

-- Grants unchanged: INSERT covers variant_id; only quantity can be updated,
-- so a line's product / variant never changes after insert.
drop policy if exists cart_items_insert_own_active on public.cart_items;
create policy cart_items_insert_own_active on public.cart_items
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.cart_line_sellable(product_id, variant_id)
  );

-- ---------------------------------------------------------------------------
-- 5. Order item snapshots
-- ---------------------------------------------------------------------------
-- order_items.sku already snapshots the SKU (now the variant's); the label
-- snapshots the chosen options ("Size: M / Colour: Red").
alter table public.order_items
  add column if not exists variant_id uuid
    references public.product_variants (id) on delete set null;
alter table public.order_items
  add column if not exists variant_label text
    check (char_length(variant_label) <= 500);
create index if not exists order_items_variant_id_idx
  on public.order_items (variant_id) where variant_id is not null;

-- ---------------------------------------------------------------------------
-- 6. place_order() — 017 plus variant lines (same signature and error codes)
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_address_id uuid,
  p_checkout_key uuid,
  p_expected_total public.money_amount
)
returns table (
  placed_order_id uuid,
  placed_order_number bigint,
  placed_total text,
  placed_currency text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing public.orders%rowtype;
  v_profile public.profiles%rowtype;
  v_address public.addresses%rowtype;
  v_email text;
  v_lines integer;
  v_unavailable integer;
  v_currencies integer;
  v_currency text;
  v_subtotal numeric(14, 3);
  v_order_id uuid;
  v_order_number bigint;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_address_id is null or p_checkout_key is null or p_expected_total is null then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('mirna.place_order:' || v_user::text, 0));

  select * into v_existing
  from public.orders o
  where o.user_id = v_user and o.checkout_key = p_checkout_key;
  if found then
    return query select v_existing.id, v_existing.order_number,
      v_existing.total::text, v_existing.currency_code::text;
    return;
  end if;

  select * into v_profile from public.profiles pr where pr.id = v_user;
  if not found or not v_profile.is_active or v_profile.role <> 'CUSTOMER' then
    raise exception 'account_not_allowed' using errcode = '42501';
  end if;

  select * into v_address
  from public.addresses a
  where a.id = p_address_id and a.user_id = v_user;
  if not found then
    raise exception 'address_invalid' using errcode = 'P0002';
  end if;

  -- Lock the cart lines, their products and variants, so prices and lines
  -- can't change between the checks below and the inserts.
  perform 1 from public.cart_items c where c.user_id = v_user for update;
  perform 1 from public.products p
  where p.id in (select c.product_id from public.cart_items c where c.user_id = v_user)
  for share;
  perform 1 from public.product_variants v
  where v.id in (select c.variant_id from public.cart_items c where c.user_id = v_user)
  for share;

  select count(*) into v_lines from public.cart_items c where c.user_id = v_user;
  if v_lines = 0 then
    raise exception 'cart_empty' using errcode = 'P0001';
  end if;

  -- Every line must match its product's configuration (simple product with no
  -- variant, or a purchasable variant of that product) and have enough
  -- sellable stock at that level (quantity - reserved).
  select count(*) into v_unavailable
  from public.cart_items c
  left join public.inventory i on i.product_id = c.product_id and c.variant_id is null
  left join public.variant_inventory vi on vi.variant_id = c.variant_id
  where c.user_id = v_user
    and (
      not private.cart_line_sellable(c.product_id, c.variant_id)
      or (c.variant_id is null and coalesce(i.quantity - i.reserved_quantity, 0) < c.quantity)
      or (c.variant_id is not null and coalesce(vi.quantity - vi.reserved_quantity, 0) < c.quantity)
    );
  if v_unavailable > 0 then
    raise exception 'cart_unavailable' using errcode = 'P0001';
  end if;

  -- Variants are priced in their product's currency.
  select count(distinct p.currency_code), min(p.currency_code),
         sum(coalesce(v.price, p.price) * c.quantity)
  into v_currencies, v_currency, v_subtotal
  from public.cart_items c
  join public.products p on p.id = c.product_id
  left join public.product_variants v on v.id = c.variant_id
  where c.user_id = v_user;
  if v_currencies <> 1 then
    raise exception 'mixed_currency' using errcode = 'P0001';
  end if;

  if v_subtotal <> p_expected_total then
    raise exception 'cart_changed' using errcode = 'P0001';
  end if;

  select u.email into v_email from auth.users u where u.id = v_user;

  insert into public.orders (
    user_id, status, subtotal, discount, shipping, tax, total, currency_code,
    shipping_address_snapshot, checkout_key
  )
  values (
    v_user, 'PENDING', v_subtotal, 0, 0, 0, v_subtotal, v_currency,
    jsonb_build_object(
      'address_id', v_address.id,
      'full_name', v_address.full_name,
      'phone', v_address.phone,
      'country_code', v_address.country_code,
      'state_region', v_address.state_region,
      'city', v_address.city,
      'area', v_address.area,
      'street', v_address.street,
      'building', v_address.building,
      'apartment', v_address.apartment,
      'postal_code', v_address.postal_code,
      'additional_instructions', v_address.additional_instructions,
      'customer', jsonb_build_object(
        'user_id', v_user,
        'email', v_email,
        'full_name', v_profile.full_name,
        'phone', v_profile.phone
      )
    ),
    p_checkout_key
  )
  returning id, order_number into v_order_id, v_order_number;

  insert into public.order_items (
    order_id, product_id, variant_id, product_name, variant_label, sku,
    quantity, unit_price, total_price, currency_code
  )
  select v_order_id, p.id, v.id, p.name,
         (
           -- Options in the product type's order (as the admin labels them).
           select left(string_agg(a.name || ': ' || av.value, ' / '
                         order by coalesce(pta.sort_order, 2147483647), a.name), 500)
           from public.variant_attribute_values vav
           join public.attributes a on a.id = vav.attribute_id
           join public.attribute_values av on av.id = vav.attribute_value_id
           left join public.product_type_attributes pta
             on pta.product_type_id = p.product_type_id and pta.attribute_id = vav.attribute_id
           where vav.variant_id = v.id
         ),
         coalesce(v.sku, p.sku), c.quantity,
         coalesce(v.price, p.price), coalesce(v.price, p.price) * c.quantity, p.currency_code
  from public.cart_items c
  join public.products p on p.id = c.product_id
  left join public.product_variants v on v.id = c.variant_id
  where c.user_id = v_user
  order by c.created_at;

  delete from public.cart_items c where c.user_id = v_user;

  return query select v_order_id, v_order_number, v_subtotal::text, v_currency;
end;
$$;

revoke all on function public.place_order(uuid, uuid, public.money_amount) from public;
grant execute on function public.place_order(uuid, uuid, public.money_amount) to authenticated;
