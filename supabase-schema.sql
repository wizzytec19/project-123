-- Firefly Café Admin — simple Supabase schema
-- Run this in Supabase SQL Editor before using the dashboard.
-- Create the first owner in Supabase Auth, then insert their UUID into profiles.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','staff')),
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  reservation_date date not null,
  reservation_time time not null,
  guests integer not null check (guests > 0),
  status text not null default 'Pending' check (status in ('Pending','Confirmed','Cancelled','No-show')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.menu_categories(id) on delete set null,
  name text not null,
  price numeric(12,2) not null default 0 check (price >= 0),
  description text,
  display_order integer not null default 0,
  available boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  phone text,
  order_type text,
  status text not null default 'New' check (status in ('New','Preparing','Done','Cancelled')),
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  storage_path text,
  category text not null default 'Food' check (category in ('Food','People','Interior','Vibe')),
  caption text,
  display_order integer not null default 0,
  show_in_gallery boolean not null default true,
  show_in_slideshow boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  whatsapp_number text,
  phone_number text,
  address text,
  google_maps_link text,
  announcement text,
  announcement_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.opening_hours (
  day_index integer primary key check (day_index between 0 and 6),
  is_open boolean not null default true,
  open_time time,
  close_time time,
  updated_at timestamptz not null default now()
);

create index if not exists reservations_date_idx on public.reservations(reservation_date);
create index if not exists reservations_status_idx on public.reservations(status);
create index if not exists orders_created_idx on public.orders(created_at desc);
create index if not exists menu_items_category_idx on public.menu_items(category_id);

alter table public.profiles enable row level security;
alter table public.reservations enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.gallery enable row level security;
alter table public.site_settings enable row level security;
alter table public.opening_hours enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('owner','staff')
  );
$$;

-- Public/customer reads: only data needed by the website.
create policy "public read menu categories" on public.menu_categories for select using (true);
create policy "public read available menu" on public.menu_items for select using (available = true);
create policy "public read gallery" on public.gallery for select using (show_in_gallery = true);
create policy "public read slideshow" on public.gallery for select using (show_in_slideshow = true);
create policy "public read settings" on public.site_settings for select using (true);
create policy "public read hours" on public.opening_hours for select using (true);

-- Public website may submit reservations but cannot read them.
create policy "public create reservation" on public.reservations for insert with check (true);

-- Admin policies.
create policy "admins read reservations" on public.reservations for select using (public.is_admin());
create policy "admins update reservations" on public.reservations for update using (public.is_admin()) with check (public.is_admin());
create policy "admins delete reservations" on public.reservations for delete using (public.is_admin());

create policy "admins manage categories" on public.menu_categories for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage menu" on public.menu_items for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage orders" on public.orders for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage order items" on public.order_items for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage gallery" on public.gallery for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage settings" on public.site_settings for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage hours" on public.opening_hours for all using (public.is_admin()) with check (public.is_admin());
create policy "admins read own profile" on public.profiles for select using (id = auth.uid());

-- First owner setup:
-- 1. Create the user in Supabase Authentication.
-- 2. Copy the user's UUID.
-- 3. Run:
-- insert into public.profiles (id, role, full_name)
-- values ('YOUR-AUTH-USER-UUID', 'owner', 'Firefly Owner');
