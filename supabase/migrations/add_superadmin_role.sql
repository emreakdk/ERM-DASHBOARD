begin;

-- 1) Profiles tablosuna rol kolonu ekle / güncelle
alter table public.profiles
  add column if not exists role text not null default 'user';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('superadmin', 'admin', 'user'));

update public.profiles
  set role = coalesce(role, 'user');

update public.profiles
  set role = 'superadmin'
  where id = 'e1b58d99-28a3-4893-9748-b36ff25fcb70';

-- 2) Yardımcı fonksiyon: kullanıcının süper admin olup olmadığını tek noktadan kontrol et
create or replace function public.is_superadmin()
  returns boolean
  language sql
  security definer
  set search_path = public
  stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'superadmin'
  );
$$;

-- 3) Süper adminlerin şirket filtresini atlaması için RLS yetkileri
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.customers enable row level security;
alter table public.deals enable row level security;
alter table public.categories enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.products enable row level security;
alter table public.notes enable row level security;
alter table public.activities enable row level security;

-- Accounts
drop policy if exists "superadmin_bypass_accounts" on public.accounts;
create policy "superadmin_bypass_accounts" on public.accounts
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Transactions
drop policy if exists "superadmin_bypass_transactions" on public.transactions;
create policy "superadmin_bypass_transactions" on public.transactions
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Customers
drop policy if exists "superadmin_bypass_customers" on public.customers;
create policy "superadmin_bypass_customers" on public.customers
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Deals
drop policy if exists "superadmin_bypass_deals" on public.deals;
create policy "superadmin_bypass_deals" on public.deals
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Categories
drop policy if exists "superadmin_bypass_categories" on public.categories;
create policy "superadmin_bypass_categories" on public.categories
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Invoices
drop policy if exists "superadmin_bypass_invoices" on public.invoices;
create policy "superadmin_bypass_invoices" on public.invoices
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Payments
drop policy if exists "superadmin_bypass_payments" on public.payments;
create policy "superadmin_bypass_payments" on public.payments
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Products
drop policy if exists "superadmin_bypass_products" on public.products;
create policy "superadmin_bypass_products" on public.products
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Notes
drop policy if exists "superadmin_bypass_notes" on public.notes;
create policy "superadmin_bypass_notes" on public.notes
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Activities
drop policy if exists "superadmin_bypass_activities" on public.activities;
create policy "superadmin_bypass_activities" on public.activities
  for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

commit;
