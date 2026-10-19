-- PROPOSED for mirna-admin (the repo that owns the schema). Copy this file to
-- mirna-admin/supabase/migrations/ unchanged and apply it there. This repo has
-- no migrations. The storefront works without it (quantities are then capped
-- at the cart maximum only, as before) and uses it as soon as it exists.
--
-- 033 · Orderable quantities for the storefront
--
-- Lets the storefront stop customers from choosing more units than can be
-- sold: the product page and cart quantity controls stop at this number, and
-- the cart Server Actions refuse anything above it.
--
--   product_stock_limit(): per ACTIVE product, how many units of the simple
--     product can be ordered now (inventory quantity - reserved).
--   variant_stock_limit(): the same per PURCHASABLE variant (variant_inventory).
--
-- Stock stays private: both return least(sellable, 99), 99 being the
-- cart_items.quantity maximum, so exact stock above the cart limit is never
-- revealed, and inventory / variant_inventory get no new grant or policy.
-- product_availability() and variant_availability() are unchanged
-- (available = limit > 0). place_order() still checks stock itself.
--
-- Additive only. Safe to re-run.

create or replace function public.product_stock_limit(p_product_ids uuid[])
returns table (product_id uuid, max_quantity integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, least(greatest(coalesce(i.quantity - i.reserved_quantity, 0), 0), 99)::integer
  from public.products p
  left join public.inventory i on i.product_id = p.id
  where p.is_active
    and p.id = any (p_product_ids[1:100]);
$$;

revoke all on function public.product_stock_limit(uuid[]) from public;
grant execute on function public.product_stock_limit(uuid[]) to anon, authenticated;

-- Unknown, inactive or unpurchasable ids are absent (like variant_availability()).
create or replace function public.variant_stock_limit(p_variant_ids uuid[])
returns table (variant_id uuid, max_quantity integer)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, least(greatest(coalesce(vi.quantity - vi.reserved_quantity, 0), 0), 99)::integer
  from public.product_variants v
  left join public.variant_inventory vi on vi.variant_id = v.id
  where v.id = any (p_variant_ids[1:500])
    and private.variant_purchasable(v.id);
$$;

revoke all on function public.variant_stock_limit(uuid[]) from public;
grant execute on function public.variant_stock_limit(uuid[]) to anon, authenticated;
