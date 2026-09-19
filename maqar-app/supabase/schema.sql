-- ============================================================
--  Maqar — Supabase schema, RLS policies, and seed data
--  Paste this whole file into the Supabase SQL editor and run.
--  Safe to re-run (drops + recreates policies; upserts seed rooms).
--
--  This file folds in every migration under supabase/migrations/ —
--  running it alone on an empty project produces the same database
--  those migrations produce when applied to schema.sql's previous
--  version. If you add a new migration, fold it in here too.
-- ============================================================

-- ---------- extensions ----------
create extension if not exists "pgcrypto";
create extension if not exists btree_gist;

-- ============================================================
--  TABLES
-- ============================================================

-- profiles: one row per auth user, holds the account TYPE (guest/host/admin)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  type        text not null default 'user' check (type in ('user','host','admin')),
  name        text,
  created_at  timestamptz not null default now()
);

create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid references public.profiles(id) on delete set null,
  title       text not null,
  title_ar    text,
  loc         text,
  loc_ar      text,
  area        text,
  type        text not null default 'Meeting' check (type in ('Meeting','Private','Event')),
  cap         int  not null default 1,
  price       int  not null default 0,
  verified    boolean not null default false,
  rating      numeric default 0,
  reviews     int default 0,
  lat         double precision,
  lng         double precision,
  feats       text[] default '{}',
  imgs        text[] default '{}',
  descr       text,
  descr_ar    text,
  created_at  timestamptz not null default now()
);

-- bookings: one request-to-stay lifecycle per room/guest. The client never
-- writes this table directly (see the revokes below) — every transition
-- goes through a security-definer function so state changes stay honest.
create table if not exists public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  room_id             uuid not null references public.rooms(id) on delete cascade,
  guest_id            uuid not null references public.profiles(id) on delete cascade,
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  status              text not null default 'Requested'
                        check (status in ('Requested','Approved','Denied','Expired','Confirmed',
                                          'Completed','NoShow','CancelledByGuest','CancelledByHost')),
  total               numeric(10,3) default 0,
  commission_rate     numeric(5,4) not null default 0.20,
  commission_amount   numeric(10,3),
  host_payout_amount  numeric(10,3),
  refund_policy       jsonb not null default '{"fullRefundHours":24,"partialFraction":0.5}'::jsonb,
  approved_at         timestamptz,
  payment_deadline    timestamptz,
  confirmed_at        timestamptz,
  completed_at        timestamptz,
  cancelled_at        timestamptz,
  denial_reason       text,
  created_at          timestamptz not null default now(),
  constraint bookings_time_order check (ends_at > starts_at),
  -- The whole fix for slot-span double booking. Two concurrent overlapping
  -- bookings cannot both commit, whatever the client does.
  constraint bookings_no_overlap exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('Requested','Approved','Confirmed'))
);

-- booking_codes: the guest's 4-digit arrival code. The host must never read
-- these directly — validate_arrival_code() checks it server-side.
create table if not exists public.booking_codes (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  code       text not null check (code ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  author_name text,
  rating      int not null check (rating between 1 and 5),
  text        text,
  created_at  timestamptz not null default now()
);

-- a 1:1 guest↔host conversation per room
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  guest_id    uuid not null references public.profiles(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  sender_type text not null check (sender_type in ('user','host')),
  text        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  room_id     uuid not null references public.rooms(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, room_id)
);

-- payments: one row per charge or refund against a booking. Also written
-- only by the security-definer booking functions, never by the client.
create table if not exists public.payments (
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

-- ============================================================
--  AUTO-CREATE PROFILE ON SIGN-UP
--  account type + name are passed in auth metadata at sign-up.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, type, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'type', 'user'),
    new.raw_user_meta_data->>'name'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
--  BOOKING LIFECYCLE FUNCTIONS
--  Every booking transition. The client calls these; it cannot
--  UPDATE bookings directly (see the grants/policies below).
--  Mirrors src/lib/bookingMachine.js — change both together.
-- ============================================================

-- security definer so a policy ON profiles can call it without recursing
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and type = 'admin');
$$;

create or replace function public.account_type() returns text
language sql security definer stable set search_path = public as $$
  select type from profiles where id = auth.uid();
$$;

create or replace function public.request_booking(
  p_room_id uuid, p_starts_at timestamptz, p_ends_at timestamptz
) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_price numeric; v_booking public.bookings;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if account_type() <> 'user' then raise exception 'Only guests can request bookings'; end if;
  if p_ends_at <= p_starts_at then raise exception 'End must be after start'; end if;
  if p_starts_at < now() + interval '1 hour' then
    raise exception 'Bookings must start at least 1 hour from now';
  end if;

  select price into v_price from rooms where id = p_room_id;
  if v_price is null then raise exception 'Room not found'; end if;

  insert into bookings (room_id, guest_id, starts_at, ends_at, status, total)
  values (p_room_id, auth.uid(), p_starts_at, p_ends_at, 'Requested',
          round(v_price * (extract(epoch from (p_ends_at - p_starts_at)) / 3600.0)::numeric, 3))
  returning * into v_booking;
  return v_booking;
end $$;

create or replace function public.approve_booking(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings;
begin
  select b.* into v_booking from bookings b
    join rooms r on r.id = b.room_id
   where b.id = p_booking_id and r.host_id = auth.uid();
  if not found then raise exception 'Not your booking to approve'; end if;
  if v_booking.status <> 'Requested' then
    raise exception 'Cannot approve a booking that is %', v_booking.status;
  end if;

  update bookings set status = 'Approved', approved_at = now(),
         payment_deadline = least(now() + interval '2 hours', starts_at - interval '30 minutes')
   where id = p_booking_id returning * into v_booking;
  return v_booking;
end $$;

create or replace function public.deny_booking(p_booking_id uuid, p_reason text)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  select b.* into v_booking from bookings b
    join rooms r on r.id = b.room_id
   where b.id = p_booking_id and r.host_id = auth.uid();
  if not found then raise exception 'Not your booking to deny'; end if;
  if v_booking.status <> 'Requested' then
    raise exception 'Cannot deny a booking that is %', v_booking.status;
  end if;

  update bookings set status = 'Denied', denial_reason = trim(p_reason), cancelled_at = now()
   where id = p_booking_id returning * into v_booking;
  return v_booking;
end $$;

create or replace function public.confirm_booking_payment(p_booking_id uuid, p_provider_ref text)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings; v_code text;
begin
  select * into v_booking from bookings where id = p_booking_id and guest_id = auth.uid();
  if not found then raise exception 'Not your booking'; end if;
  if v_booking.status <> 'Approved' then
    raise exception 'Cannot pay for a booking that is %', v_booking.status;
  end if;
  if v_booking.payment_deadline < now() then raise exception 'The payment window has closed'; end if;

  v_code := lpad((floor(random() * 10000))::int::text, 4, '0');

  update bookings set
      status = 'Confirmed',
      confirmed_at = now(),
      commission_amount = round(total * commission_rate, 3),
      host_payout_amount = round(total - round(total * commission_rate, 3), 3)
   where id = p_booking_id returning * into v_booking;

  insert into booking_codes (booking_id, code) values (p_booking_id, v_code)
    on conflict (booking_id) do update set code = excluded.code;

  insert into payments (booking_id, kind, status, amount, provider_ref)
  values (p_booking_id, 'charge', 'succeeded', v_booking.total, p_provider_ref);

  return v_booking;
end $$;

create or replace function public.validate_arrival_code(p_booking_id uuid, p_code text)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings; v_expected text;
begin
  select b.* into v_booking from bookings b
    join rooms r on r.id = b.room_id
   where b.id = p_booking_id and r.host_id = auth.uid();
  if not found then raise exception 'Not your booking'; end if;
  if v_booking.status <> 'Confirmed' then
    raise exception 'Cannot check in a booking that is %', v_booking.status;
  end if;

  select code into v_expected from booking_codes where booking_id = p_booking_id;
  if v_expected is null or v_expected <> p_code then
    raise exception 'That code does not match';
  end if;

  update bookings set status = 'Completed', completed_at = now()
   where id = p_booking_id returning * into v_booking;
  return v_booking;
end $$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings; v_is_guest boolean; v_is_host boolean;
        v_fraction numeric; v_refund numeric; v_remaining interval;
begin
  select b.* into v_booking from bookings b where b.id = p_booking_id;
  if not found then raise exception 'Not your booking'; end if;

  select (b.guest_id = auth.uid()), (r.host_id = auth.uid())
    into v_is_guest, v_is_host
    from bookings b join rooms r on r.id = b.room_id
   where b.id = p_booking_id;
  if not found or not (coalesce(v_is_guest, false) or coalesce(v_is_host, false)) then
    raise exception 'Not your booking';
  end if;
  if v_booking.status not in ('Requested','Approved','Confirmed') then
    raise exception 'Cannot cancel a booking that is %', v_booking.status;
  end if;
  if v_is_host and v_booking.status = 'Requested' then
    raise exception 'Deny the request instead';
  end if;

  if v_booking.status = 'Confirmed' then
    if v_is_host then
      v_fraction := 1;  -- a host cancelling a paid booking always refunds in full
    else
      v_remaining := v_booking.starts_at - now();
      if v_remaining <= interval '0' then v_fraction := 0;
      elsif v_remaining > make_interval(hours => (v_booking.refund_policy->>'fullRefundHours')::int)
        then v_fraction := 1;
      else v_fraction := (v_booking.refund_policy->>'partialFraction')::numeric;
      end if;
    end if;
    v_refund := round(v_booking.total * v_fraction, 3);
    if v_refund > 0 then
      insert into payments (booking_id, kind, status, amount)
      values (p_booking_id, 'refund', 'pending', v_refund);
    end if;
  end if;

  update bookings
     set status = case when v_is_guest then 'CancelledByGuest' else 'CancelledByHost' end,
         cancelled_at = now()
   where id = p_booking_id returning * into v_booking;
  return v_booking;
end $$;

create or replace function public.expire_stale_approvals() returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update bookings set status = 'Expired', cancelled_at = now()
   where status = 'Approved' and payment_deadline < now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.mark_no_shows() returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update bookings set status = 'NoShow'
   where status = 'Confirmed' and ends_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ============================================================
--  ROW-LEVEL SECURITY
-- ============================================================
alter table public.profiles     enable row level security;
alter table public.rooms        enable row level security;
alter table public.bookings     enable row level security;
alter table public.booking_codes enable row level security;
alter table public.reviews      enable row level security;
alter table public.messages     enable row level security;
alter table public.favorites    enable row level security;
alter table public.payments     enable row level security;

-- The browser reads. It does not write bookings, booking_codes, or payments
-- directly — every write to those three goes through a security-definer
-- function above, so INSERT/UPDATE/DELETE are revoked outright.
revoke insert, update, delete on public.bookings      from authenticated, anon;
revoke insert, update, delete on public.booking_codes from authenticated, anon;
revoke insert, update, delete on public.payments      from authenticated, anon;
grant select on public.bookings      to authenticated;
grant select on public.booking_codes to authenticated;
grant select on public.payments      to authenticated;

-- profiles: readable only where there's a legitimate reason to see it —
-- yourself, an admin, or the other side of a booking/message thread.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (
  id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.bookings b join public.rooms r on r.id = b.room_id
     where (b.guest_id = profiles.id and r.host_id = auth.uid())
        or (r.host_id  = profiles.id and b.guest_id = auth.uid())
  )
  or exists (
    select 1 from public.messages m join public.rooms r on r.id = m.room_id
     where (m.guest_id = profiles.id and r.host_id = auth.uid())
        or (r.host_id  = profiles.id and m.guest_id = auth.uid())
  )
);
drop policy if exists profiles_upsert on public.profiles;
create policy profiles_upsert on public.profiles for insert with check (auth.uid() = id);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (auth.uid() = id);

-- rooms: public browse; hosts manage their own
drop policy if exists rooms_read on public.rooms;
create policy rooms_read on public.rooms for select using (true);
drop policy if exists rooms_insert on public.rooms;
create policy rooms_insert on public.rooms for insert with check (auth.uid() = host_id);
drop policy if exists rooms_update on public.rooms;
create policy rooms_update on public.rooms for update using (auth.uid() = host_id);
drop policy if exists rooms_delete on public.rooms;
create policy rooms_delete on public.rooms for delete using (auth.uid() = host_id);

-- bookings: guest sees own; host sees bookings for their rooms; admin sees all.
-- No insert/update policy — writes only happen through the functions above.
drop policy if exists bookings_insert on public.bookings;
drop policy if exists bookings_update on public.bookings;
drop policy if exists bookings_read   on public.bookings;
create policy bookings_read on public.bookings for select using (
  auth.uid() = guest_id
  or auth.uid() = (select host_id from public.rooms r where r.id = room_id)
  or public.is_admin()
);

-- booking_codes: the guest's own code, never the host's
drop policy if exists booking_codes_read on public.booking_codes;
create policy booking_codes_read on public.booking_codes for select using (
  auth.uid() = (select guest_id from public.bookings b where b.id = booking_id)
  or public.is_admin()
);

-- reviews: public read; only after a completed stay
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using (true);
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert with check (
  auth.uid() = author_id
  and exists (
    select 1 from public.bookings b
     where b.room_id = reviews.room_id
       and b.guest_id = auth.uid()
       and b.status = 'Completed'
  )
);

-- messages: only the two participants (guest + the room's host)
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select using (
  auth.uid() = guest_id
  or auth.uid() = (select host_id from public.rooms r where r.id = room_id)
);
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert with check (auth.uid() = sender_id);

-- favorites: yours only
drop policy if exists favorites_all on public.favorites;
create policy favorites_all on public.favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- payments: guest who owns the booking, the room's host, or an admin.
-- No insert policy — writes only happen through the functions above.
drop policy if exists payments_read   on public.payments;
drop policy if exists payments_insert on public.payments;
create policy payments_read on public.payments for select using (
  auth.uid() = (select guest_id from public.bookings b where b.id = booking_id)
  or auth.uid() = (select r.host_id from public.bookings b join public.rooms r on r.id = b.room_id
                    where b.id = booking_id)
  or public.is_admin()
);

-- ============================================================
--  SEED ROOMS (stable ids so the frontend can match if needed)
-- ============================================================
-- host_id is null here on purpose: a host account can only be created by
-- signing up through the app (the profiles row comes from auth.users).
-- Assign a real host_id to each row afterwards, because every host-side
-- RLS policy above compares against rooms.host_id — with it null, none of
-- the host dashboard, messaging, or booking-approval flows have an owner
-- to match against, so the entire host side stays non-functional until you do.
insert into public.rooms (id, host_id, title, title_ar, loc, loc_ar, area, type, cap, price, verified, rating, reviews, lat, lng, feats, imgs, descr, descr_ar)
values
 ('00000000-0000-0000-0000-000000000001', null, 'The Crema Boardroom', 'قاعة كريما للاجتماعات', 'Abdoun, Amman', 'عبدون، عمّان', 'Abdoun', 'Meeting', 8, 9, true, 4.9, 128, 31.9454, 35.8806,
  array['Whiteboard','Projector','Coffee','Parking'],
  array['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80','https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80','https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&q=80'],
  'A warm, light-filled boardroom built for serious meetings.', 'قاعة اجتماعات دافئة وغنيّة بالإضاءة الطبيعية.'),
 ('00000000-0000-0000-0000-000000000002', null, 'Roastery Focus Room', 'غرفة التحميصة للتركيز', 'Jabal Amman', 'جبل عمّان', 'Jabal Amman', 'Private', 3, 5, true, 4.8, 64, 31.9515, 35.9239,
  array['Whiteboard','Coffee'],
  array['https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&q=80','https://images.unsplash.com/photo-1431540015161-0bf868a2d407?w=800&q=80'],
  'A cosy private room for deep work or small calls.', 'غرفة خاصة مريحة للعمل العميق.'),
 ('00000000-0000-0000-0000-000000000003', null, 'Mocha Conference Hall', 'قاعة موكا للمؤتمرات', 'Shmeisani, Amman', 'الشميساني، عمّان', 'Shmeisani', 'Event', 16, 18, false, 4.6, 41, 31.9678, 35.9089,
  array['Projector','Parking','Coffee'],
  array['https://images.unsplash.com/photo-1604328698692-f76ea9498e76?w=800&q=80','https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=800&q=80'],
  'Our largest space for workshops and events.', 'أكبر مساحاتنا لورش العمل والفعاليات.'),
 ('00000000-0000-0000-0000-000000000004', null, 'Latte Studio', 'استوديو لاتيه', 'Weibdeh, Amman', 'اللويبدة، عمّان', 'Weibdeh', 'Private', 4, 6, true, 4.9, 87, 31.9566, 35.9170,
  array['Whiteboard','Coffee','Parking'],
  array['https://images.unsplash.com/photo-1577412647305-991150c7d163?w=800&q=80','https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80'],
  'A bright studio with movable furniture.', 'استوديو مشرق بأثاث قابل للتحريك.'),
 ('00000000-0000-0000-0000-000000000005', null, 'Espresso Meeting Pod', 'كبسولة إسبريسو للاجتماعات', 'Sweifieh, Amman', 'الصويفية، عمّان', 'Sweifieh', 'Meeting', 6, 8, true, 4.7, 53, 31.9519, 35.8580,
  array['Whiteboard','Projector','Coffee'],
  array['https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80','https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&q=80'],
  'A compact glass meeting pod with a smart screen.', 'كبسولة اجتماعات زجاجية مدمجة مع شاشة ذكية.'),
 ('00000000-0000-0000-0000-000000000006', null, 'Cortado Workshop Loft', 'لوفت كورتادو للورش', 'Khalda, Amman', 'خلدا، عمّان', 'Khalda', 'Event', 12, 14, false, 4.5, 29, 31.9876, 35.8300,
  array['Projector','Parking'],
  array['https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80','https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=800&q=80'],
  'An open loft with exposed brick and flexible staging.', 'لوفت مفتوح بجدران من الطوب المكشوف.')
on conflict (id) do nothing;

-- ============================================================
--  REALTIME — let clients receive new chat messages live.
--  Safe to re-run (ignores "already added").
-- ============================================================
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
