/**
 * 20260106_init_stripe.sql
 * 
 * Sets up the schema for syncing Stripe data to Supabase.
 * - products: synced from Stripe
 * - prices: synced from Stripe
 * - customers: links auth.users to stripe_customer_id
 * - subscriptions: synced from Stripe
 */

-- 1. Create Schema for public access (standard)
-- Note: We use the 'public' schema.

-- ENUMS
create type pricing_type as enum ('one_time', 'recurring');
create type pricing_plan_interval as enum ('day', 'week', 'month', 'year');
create type subscription_status as enum ('trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'paused');

-- PRODUCTS
create table products (
  id text primary key,
  active boolean,
  name text,
  description text,
  image text,
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table products enable row level security;
create policy "Allow public read-only access." on products for select using (true);

-- PRICES
create table prices (
  id text primary key,
  product_id text references products,
  active boolean,
  description text,
  unit_amount bigint,
  currency text check (char_length(currency) = 3),
  type pricing_type,
  interval pricing_plan_interval,
  interval_count integer,
  trial_period_days integer,
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table prices enable row level security;
create policy "Allow public read-only access." on prices for select using (true);

-- CUSTOMERS
-- Security: This table links the private User ID to the Stripe Customer ID.
create table customers (
  id uuid references auth.users not null primary key,
  stripe_customer_id text
);
alter table customers enable row level security;
-- Only the user can read their own customer ID (although rarely needed on client)
create policy "Can read own customer data." on customers for select using (auth.uid() = id);

-- SUBSCRIPTIONS
create table subscriptions (
  id text primary key, -- Stripe Subscription ID
  user_id uuid references auth.users not null,
  status subscription_status,
  metadata jsonb,
  price_id text references prices,
  quantity integer,
  cancel_at_period_end boolean,
  created timestamp with time zone default timezone('utc'::text, now()) not null,
  current_period_start timestamp with time zone default timezone('utc'::text, now()) not null,
  current_period_end timestamp with time zone default timezone('utc'::text, now()) not null,
  ended_at timestamp with time zone default timezone('utc'::text, now()),
  cancel_at timestamp with time zone default timezone('utc'::text, now()),
  canceled_at timestamp with time zone default timezone('utc'::text, now()),
  trial_start timestamp with time zone default timezone('utc'::text, now()),
  trial_end timestamp with time zone default timezone('utc'::text, now())
);
alter table subscriptions enable row level security;
create policy "Can only view own data." on subscriptions for select using (auth.uid() = user_id);

-- UTILITIES (Update timestamps)
create or replace function public.handle_updated_at() 
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_updated_at before update on products 
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at before update on prices 
  for each row execute procedure public.handle_updated_at();
