-- ============================================================
--  Booking lifecycle: real states, real money, no double booking
--  Safe on an empty bookings table. Production had 0 bookings.
-- ============================================================

create extension if not exists btree_gist;

-- ---------- profiles: add the admin role ----------
alter table public.profiles drop constraint if exists profiles_type_check;
alter table public.profiles add constraint profiles_type_check
  check (type in ('user','host','admin'));

-- ---------- bookings: new shape ----------
drop index if exists bookings_slot_unique;

alter table public.bookings
  add column if not exists starts_at          timestamptz,
  add column if not exists ends_at            timestamptz,
  add column if not exists commission_rate    numeric(5,4) not null default 0.20,
  add column if not exists commission_amount  numeric(10,3),
  add column if not exists host_payout_amount numeric(10,3),
  add column if not exists refund_policy      jsonb not null
    default '{"fullRefundHours":24,"partialFraction":0.5}'::jsonb,
  add column if not exists approved_at        timestamptz,
  add column if not exists payment_deadline   timestamptz,
  add column if not exists confirmed_at       timestamptz,
  add column if not exists completed_at       timestamptz,
  add column if not exists cancelled_at       timestamptz,
  add column if not exists denial_reason      text;

-- the old shape is gone; `code` moves to its own table (see below)
alter table public.bookings
  drop column if exists date,
  drop column if exists slot,
  drop column if exists dur,
  drop column if exists code;

delete from public.bookings where starts_at is null or ends_at is null;

alter table public.bookings
  alter column starts_at set not null,
  alter column ends_at   set not null,
  alter column total     type numeric(10,3);

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('Requested','Approved','Denied','Expired','Confirmed',
                    'Completed','NoShow','CancelledByGuest','CancelledByHost'));
alter table public.bookings alter column status set default 'Requested';

alter table public.bookings drop constraint if exists bookings_time_order;
alter table public.bookings add constraint bookings_time_order check (ends_at > starts_at);

-- The whole fix for slot-span double booking. Two concurrent overlapping
-- bookings cannot both commit, whatever the client does.
alter table public.bookings drop constraint if exists bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('Requested','Approved','Confirmed'));

-- ---------- booking_codes: the host must never read these ----------
create table if not exists public.booking_codes (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  code       text not null check (code ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now()
);

-- ---------- payments: replaced ----------
drop table if exists public.payments cascade;
create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete restrict,
  kind         text not null check (kind in ('charge','refund')),
  status       text not null check (status in ('pending','succeeded','failed')),
  amount       numeric(10,3) not null check (amount >= 0),
  currency     text not null default 'JOD',
  provider     text not null default 'stub',
  provider_ref text,
  created_at   timestamptz not null default now()
);
create index if not exists payments_booking_idx on public.payments (booking_id);

alter table public.booking_codes enable row level security;
alter table public.payments      enable row level security;
