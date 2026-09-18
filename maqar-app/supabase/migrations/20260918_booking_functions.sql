-- ============================================================
--  Every booking transition. The client calls these; it cannot
--  UPDATE bookings directly (see the policies migration).
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
