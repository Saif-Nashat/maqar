-- ============================================================
--  Arrival-code brute-force lockout
--
--  A host may legitimately call validate_arrival_code repeatedly for their
--  own bookings. Nothing stopped them scripting all 10,000 four-digit
--  combinations, which defeats the whole reason the code is hidden from
--  them (booking_codes_read only lets the guest see their own code).
--
--  Adds an attempt counter with a 15-minute lockout after 5 wrong guesses.
--  Ownership and status checks are unchanged. Already folded into
--  schema.sql; this file is here so a fresh project and an existing one
--  converge on the same database.
-- ============================================================

alter table public.booking_codes
  add column if not exists attempts int not null default 0,
  add column if not exists locked_until timestamptz;

create or replace function public.validate_arrival_code(p_booking_id uuid, p_code text)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings; v_expected text; v_attempts int; v_locked_until timestamptz;
begin
  select b.* into v_booking from bookings b
    join rooms r on r.id = b.room_id
   where b.id = p_booking_id and r.host_id = auth.uid();
  if not found then raise exception 'Not your booking'; end if;
  if v_booking.status <> 'Confirmed' then
    raise exception 'Cannot check in a booking that is %', v_booking.status;
  end if;

  select code, attempts, locked_until into v_expected, v_attempts, v_locked_until
    from booking_codes where booking_id = p_booking_id;

  if v_locked_until is not null and v_locked_until > now() then
    raise exception 'Too many incorrect attempts. Try again later.';
  end if;

  if v_expected is null or v_expected <> p_code then
    v_attempts := coalesce(v_attempts, 0) + 1;
    if v_attempts >= 5 then
      update booking_codes set attempts = 0, locked_until = now() + interval '15 minutes'
       where booking_id = p_booking_id;
    else
      update booking_codes set attempts = v_attempts where booking_id = p_booking_id;
    end if;
    raise exception 'That code does not match';
  end if;

  update booking_codes set attempts = 0, locked_until = null where booking_id = p_booking_id;

  update bookings set status = 'Completed', completed_at = now()
   where id = p_booking_id returning * into v_booking;
  return v_booking;
end $$;
