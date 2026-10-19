-- PROPOSED for mirna-admin (the repo that owns the schema). Copy this file to
-- mirna-admin/supabase/migrations/ unchanged and apply it there BEFORE
-- deploying the storefront's wishlist. This repo has no migrations.
--
-- 028 · Customer wishlist
--
--   1. public.wishlist_items: one row per customer per product (unique
--      (user_id, product_id)). No price, quantity or variant: the storefront
--      reads names, prices and availability from the current products.
--   2. Customer-only RLS: an ACTIVE CUSTOMER reads, adds and removes only
--      their own rows (private.is_active_customer). Staff and deactivated
--      accounts get nothing. New rows must point at an active product.
--   3. Deleted products (and users) cascade away; inactive products stay in
--      the table but the storefront hides and removes them on read.
--   4. At most 100 items per customer (trigger), so the storefront's reads
--      stay bounded.
--
-- Additive: new table, functions and policies only. Guests keep their
-- wishlist in the browser; it is merged into this table when they sign in.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- One row per product per customer: saving again is a no-op.
  constraint wishlist_items_user_product_key unique (user_id, product_id)
);

alter table public.wishlist_items enable row level security;

-- The (user_id, product_id) unique index serves "my wishlist" lookups.
-- product_id: for the on-delete-cascade from products.
create index wishlist_items_product_id_idx on public.wishlist_items (product_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so it can read profiles without re-entering profiles' RLS.
create or replace function private.is_active_customer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'CUSTOMER'
      and is_active
  );
$$;

revoke all on function private.is_active_customer() from public;
grant execute on function private.is_active_customer() to authenticated;

-- On insert: the owner is always the caller, and a customer keeps at most
-- 100 items. Serialised per customer so parallel inserts can't pass the cap.
create or replace function private.prepare_wishlist_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.user_id := (select auth.uid());
  end if;
  perform pg_advisory_xact_lock(hashtextextended('wishlist:' || new.user_id::text, 0));
  if (select count(*) from public.wishlist_items where user_id = new.user_id) >= 100 then
    raise exception 'wishlist is full (100 items)' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke all on function private.prepare_wishlist_item() from public;

create trigger wishlist_items_prepare
  before insert on public.wishlist_items
  for each row execute function private.prepare_wishlist_item();

-- ---------------------------------------------------------------------------
-- Privileges (least privilege: rows are added or removed, never updated)
-- ---------------------------------------------------------------------------
revoke all on table public.wishlist_items from anon, authenticated;
grant select, delete on table public.wishlist_items to authenticated;
grant insert (product_id) on table public.wishlist_items to authenticated;

-- ---------------------------------------------------------------------------
-- Policies (customers only; admins get no extra access to wishlists)
-- ---------------------------------------------------------------------------
create policy wishlist_items_select_own_customer on public.wishlist_items
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_active_customer()));

create policy wishlist_items_insert_own_customer_active on public.wishlist_items
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_active_customer())
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.is_active
    )
  );

create policy wishlist_items_delete_own_customer on public.wishlist_items
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.is_active_customer()));
