-- PROPOSED for mirna-admin (the repo that owns the schema). Copy this file to
-- mirna-admin/supabase/migrations/ unchanged and apply it there BEFORE
-- deploying the storefront's product reviews. This repo has no migrations.
--
-- 027 · Product reviews (verified buyers only)
--
--   1. public.product_reviews: one review per customer per product (rating
--      1–5, optional title, text). author_name is a display snapshot
--      ("Mirna A.") set by a trigger from the profile, never by the client.
--   2. Only a verified buyer can write one: an ACTIVE CUSTOMER with at least
--      one DELIVERED order containing the product (private.has_purchased).
--      Enforced by the insert policy, so the storefront can't be bypassed.
--   3. Everyone (anon + authenticated) reads PUBLISHED reviews, without
--      user_id. Authors edit or delete their own review; admins can hide
--      (status = 'HIDDEN') or delete any review.
--   4. product_review_summary(): count, average and per-star counts.
--      my_product_review(): the caller's eligibility and own review.
--
-- Additive: new table, functions and policies only.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 10 and 2000),
  author_name text not null check (char_length(author_name) between 1 and 80),
  status text not null default 'PUBLISHED' check (status in ('PUBLISHED', 'HIDDEN')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_reviews_product_user_key unique (product_id, user_id)
);

alter table public.product_reviews enable row level security;

-- Product page: published reviews of a product, newest first.
create index product_reviews_product_status_created_idx
  on public.product_reviews (product_id, status, created_at desc);
create index product_reviews_user_id_idx on public.product_reviews (user_id);

create trigger product_reviews_set_updated_at
  before update on public.product_reviews
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- Whether the caller has received this product: an active CUSTOMER with a
-- DELIVERED order containing it. SECURITY DEFINER: reads orders, order_items
-- and profiles without depending on their policies.
create or replace function private.has_purchased(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'CUSTOMER'
      and p.is_active
  ) and exists (
    select 1
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.user_id = (select auth.uid())
      and o.status = 'DELIVERED'
      and oi.product_id = p_product_id
  );
$$;

revoke all on function private.has_purchased(uuid) from public;
grant execute on function private.has_purchased(uuid) to authenticated;

-- On insert: the author is always the caller, the review starts PUBLISHED and
-- author_name is "First L." from the profile (fallback "Customer").
-- On update: only rating / title / body may change (status by admins only).
create or replace function private.prepare_product_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_parts text[];
begin
  if tg_op = 'INSERT' then
    new.user_id := (select auth.uid());
    new.status := 'PUBLISHED';
    select nullif(btrim(full_name), '') into v_name
    from public.profiles
    where id = new.user_id;
    v_parts := regexp_split_to_array(coalesce(v_name, ''), '\s+');
    new.author_name := case
      when v_name is null then 'Customer'
      when array_length(v_parts, 1) > 1
        then left(v_parts[1], 60) || ' ' || left(v_parts[array_length(v_parts, 1)], 1) || '.'
      else left(v_parts[1], 60)
    end;
  else
    new.id := old.id;
    new.product_id := old.product_id;
    new.user_id := old.user_id;
    new.author_name := old.author_name;
    new.created_at := old.created_at;
    if new.status is distinct from old.status and not private.is_admin() then
      raise exception 'only administrators can change a review''s status'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.prepare_product_review() from public;

create trigger product_reviews_prepare
  before insert or update on public.product_reviews
  for each row execute function private.prepare_product_review();

-- ---------------------------------------------------------------------------
-- Privileges (column level: user_id is never readable through the API)
-- ---------------------------------------------------------------------------
revoke all on table public.product_reviews from anon, authenticated;
grant select (id, product_id, rating, title, body, author_name, status, created_at, updated_at)
  on table public.product_reviews to anon, authenticated;
grant insert (product_id, rating, title, body) on table public.product_reviews to authenticated;
grant update (rating, title, body, status) on table public.product_reviews to authenticated;
grant delete on table public.product_reviews to authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
create policy product_reviews_select_published
  on public.product_reviews for select
  to anon, authenticated
  using (status = 'PUBLISHED');

create policy product_reviews_select_own_or_admin
  on public.product_reviews for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy product_reviews_insert_verified_buyer
  on public.product_reviews for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and private.has_purchased(product_id)
  );

create policy product_reviews_update_own
  on public.product_reviews for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy product_reviews_update_admin
  on public.product_reviews for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy product_reviews_delete_own_or_admin
  on public.product_reviews for delete
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Public functions
-- ---------------------------------------------------------------------------
-- Published reviews of a product: how many, the average, and per-star counts.
-- SECURITY INVOKER: RLS limits it to published reviews.
create or replace function public.product_review_summary(p_product_id uuid)
returns table (
  review_count integer,
  average_rating numeric(3, 2),
  stars_1 integer,
  stars_2 integer,
  stars_3 integer,
  stars_4 integer,
  stars_5 integer
)
language sql
stable
set search_path = ''
as $$
  select
    count(*)::integer,
    coalesce(round(avg(rating), 2), 0)::numeric(3, 2),
    count(*) filter (where rating = 1)::integer,
    count(*) filter (where rating = 2)::integer,
    count(*) filter (where rating = 3)::integer,
    count(*) filter (where rating = 4)::integer,
    count(*) filter (where rating = 5)::integer
  from public.product_reviews
  where product_id = p_product_id
    and status = 'PUBLISHED';
$$;

revoke all on function public.product_review_summary(uuid) from public;
grant execute on function public.product_review_summary(uuid) to anon, authenticated;

-- The caller's standing for one product: whether they may review it (verified
-- buyer) and their own review, if any (in any status). One row; review
-- columns are NULL when they haven't written one.
create or replace function public.my_product_review(p_product_id uuid)
returns table (
  eligible boolean,
  review_id uuid,
  rating smallint,
  title text,
  body text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_purchased(p_product_id),
    r.id, r.rating, r.title, r.body, r.status, r.created_at, r.updated_at
  from (select 1) as one
  left join public.product_reviews r
    on r.product_id = p_product_id
   and r.user_id = (select auth.uid());
$$;

revoke all on function public.my_product_review(uuid) from public;
grant execute on function public.my_product_review(uuid) to authenticated;
