-- ============================================================
--  The browser reads. It does not write anything that matters.
-- ============================================================

-- ---------- bookings ----------
revoke insert, update, delete on public.bookings from authenticated, anon;
grant select on public.bookings to authenticated;

drop policy if exists bookings_insert on public.bookings;
drop policy if exists bookings_update on public.bookings;
drop policy if exists bookings_read   on public.bookings;
create policy bookings_read on public.bookings for select using (
  auth.uid() = guest_id
  or auth.uid() = (select host_id from public.rooms r where r.id = room_id)
  or public.is_admin()
);

-- ---------- booking_codes: the guest's code, never the host's ----------
revoke insert, update, delete on public.booking_codes from authenticated, anon;
grant select on public.booking_codes to authenticated;

drop policy if exists booking_codes_read on public.booking_codes;
create policy booking_codes_read on public.booking_codes for select using (
  auth.uid() = (select guest_id from public.bookings b where b.id = booking_id)
  or public.is_admin()
);

-- ---------- payments ----------
revoke insert, update, delete on public.payments from authenticated, anon;
grant select on public.payments to authenticated;

drop policy if exists payments_read   on public.payments;
drop policy if exists payments_insert on public.payments;
create policy payments_read on public.payments for select using (
  auth.uid() = (select guest_id from public.bookings b where b.id = booking_id)
  or auth.uid() = (select r.host_id from public.bookings b join public.rooms r on r.id = b.room_id
                    where b.id = booking_id)
  or public.is_admin()
);

-- ---------- reviews: only after a completed stay ----------
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

-- ---------- profiles: no more enumerating every user ----------
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
