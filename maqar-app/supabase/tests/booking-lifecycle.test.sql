-- Run in the Supabase SQL editor. Everything happens inside one DO block so
-- ids can be held in variables, and the whole thing rolls back, leaving no
-- rows behind. A failed assertion raises and aborts.
begin;

do $$
declare
  v_host uuid := gen_random_uuid();
  v_guest uuid := gen_random_uuid();
  v_room uuid := gen_random_uuid();
  v_base timestamptz := date_trunc('hour', now()) + interval '2 days';
begin
  -- Insert into auth.users first, before profiles (profiles.id is FK to auth.users.id)
  insert into auth.users (id, email, instance_id)
  values (v_host, 'test-host@example.com', '00000000-0000-0000-0000-000000000000'::uuid);
  insert into auth.users (id, email, instance_id)
  values (v_guest, 'test-guest@example.com', '00000000-0000-0000-0000-000000000000'::uuid);

  insert into public.profiles (id, type, name) values (v_host, 'host', 'T Host');
  insert into public.profiles (id, type, name) values (v_guest, 'user', 'T Guest');
  insert into public.rooms (id, host_id, title, loc, area, type, cap, price)
  values (v_room, v_host, 'T Room', 'Abdoun, Amman', 'Abdoun', 'Meeting', 4, 10);

  -- a live 4-hour booking
  insert into public.bookings (room_id, guest_id, starts_at, ends_at, status, total)
  values (v_room, v_guest, v_base, v_base + interval '4 hours', 'Confirmed', 40);

  -- 1. the exact bug that shipped: 30 minutes into a 4-hour booking
  begin
    insert into public.bookings (room_id, guest_id, starts_at, ends_at, status, total)
    values (v_room, v_guest, v_base + interval '30 minutes', v_base + interval '90 minutes',
            'Requested', 10);
    raise exception 'FAIL: an overlapping booking was accepted';
  exception when exclusion_violation then
    raise notice 'PASS: overlapping booking rejected';
  end;

  -- 2. abutting is fine: starts exactly when the other ends
  insert into public.bookings (room_id, guest_id, starts_at, ends_at, status, total)
  values (v_room, v_guest, v_base + interval '4 hours', v_base + interval '5 hours',
          'Requested', 10);
  raise notice 'PASS: abutting booking accepted';

  -- 3. the status CHECK rejects the old vocabulary
  begin
    insert into public.bookings (room_id, guest_id, starts_at, ends_at, status, total)
    values (v_room, v_guest, v_base + interval '9 days', v_base + interval '9 days 1 hour',
            'PendingHost', 10);
    raise exception 'FAIL: legacy status accepted';
  exception when check_violation then
    raise notice 'PASS: legacy status rejected';
  end;

  -- 4. cancelling releases the slot
  update public.bookings set status = 'CancelledByGuest'
   where room_id = v_room and status = 'Confirmed';
  insert into public.bookings (room_id, guest_id, starts_at, ends_at, status, total)
  values (v_room, v_guest, v_base, v_base + interval '1 hour', 'Requested', 10);
  raise notice 'PASS: cancelled booking released its slot';

  -- 5. ends_at must follow starts_at
  begin
    insert into public.bookings (room_id, guest_id, starts_at, ends_at, status, total)
    values (v_room, v_guest, v_base + interval '20 days', v_base + interval '19 days',
            'Requested', 10);
    raise exception 'FAIL: backwards booking accepted';
  exception when check_violation then
    raise notice 'PASS: backwards booking rejected';
  end;
end $$;

rollback;
