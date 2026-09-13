-- ============================================================
--  Maqar — Supabase schema, RLS policies, and seed data
--  Paste this whole file into the Supabase SQL editor and run.
--  Safe to re-run (drops + recreates policies; upserts seed rooms).
-- ============================================================

-- ---------- extensions ----------
create extension if not exists "pgcrypto";

-- ============================================================
--  TABLES
-- ============================================================

-- profiles: one row per auth user, holds the account TYPE (guest/host)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  type        text not null default 'user' check (type in ('user','host')),
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

create table if not exists public.bookings (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  guest_id    uuid not null references public.profiles(id) on delete cascade,
  date        date not null,
  slot        text not null,
  dur         numeric not null default 1,
  status      text not null default 'PendingHost'
                check (status in ('PendingHost','Confirmed','Upcoming','Denied','Cancelled','Completed')),
  code        text,
  total       numeric default 0,
  created_at  timestamptz not null default now()
);
-- one room/date/slot can only be taken once
create unique index if not exists bookings_slot_unique
  on public.bookings (room_id, date, slot)
  where status in ('PendingHost','Confirmed','Upcoming');

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

create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  room_id     uuid references public.rooms(id) on delete set null,
  label       text,
  amount      numeric not null default 0,
  method      text default 'CliQ',
  status      text default 'Paid',
  created_at  timestamptz not null default now()
);

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
--  ROW-LEVEL SECURITY
-- ============================================================
alter table public.profiles  enable row level security;
alter table public.rooms     enable row level security;
alter table public.bookings  enable row level security;
alter table public.reviews   enable row level security;
alter table public.messages  enable row level security;
alter table public.favorites enable row level security;
alter table public.payments  enable row level security;

-- profiles: anyone can read (host names shown publicly); you manage your own
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
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

-- bookings: guest sees own; host sees bookings for their rooms
drop policy if exists bookings_read on public.bookings;
create policy bookings_read on public.bookings for select using (
  auth.uid() = guest_id
  or auth.uid() = (select host_id from public.rooms r where r.id = room_id)
);
drop policy if exists bookings_insert on public.bookings;
create policy bookings_insert on public.bookings for insert with check (auth.uid() = guest_id);
drop policy if exists bookings_update on public.bookings;
create policy bookings_update on public.bookings for update using (
  auth.uid() = guest_id
  or auth.uid() = (select host_id from public.rooms r where r.id = room_id)
);

-- reviews: public read; authored by the signed-in user
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using (true);
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert with check (auth.uid() = author_id);

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

-- payments: yours only
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select using (auth.uid() = user_id);
drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments for insert with check (auth.uid() = user_id);

-- ============================================================
--  SEED ROOMS (stable ids so the frontend can match if needed)
-- ============================================================
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
