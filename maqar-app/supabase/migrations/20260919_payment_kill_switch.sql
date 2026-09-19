-- ============================================================
--  Payment-verification kill switch
--
--  confirm_booking_payment(p_booking_id, p_provider_ref) has never verified
--  that a charge actually happened — it is a normal RPC, so any signed-in
--  user could call supabase.rpc("confirm_booking_payment", {...}) from a
--  browser console with any string and land on Confirmed with a payments
--  row marked 'succeeded', having paid nothing.
--
--  This is NOT a fix for that — verifying a payment requires a server-side
--  authority (a PSP webhook or a server-initiated charge), and neither
--  exists yet; the payment rail (src/services/paymentRail.js) is a
--  client-side stub. What this migration does is make the unsafe state
--  impossible to enter BY ACCIDENT: an operator-only flag that, once
--  turned on, makes confirm_booking_payment refuse to run until someone
--  has actually wired real verification. Already folded into schema.sql;
--  this file is here so a fresh project and an existing one converge on
--  the same database.
-- ============================================================

create table if not exists public.platform_settings (
  id            int primary key default 1 check (id = 1),
  live_payments boolean not null default false,
  updated_at    timestamptz not null default now()
);
insert into public.platform_settings (id, live_payments) values (1, false)
  on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

grant select on public.platform_settings to authenticated;
drop policy if exists platform_settings_read on public.platform_settings;
create policy platform_settings_read on public.platform_settings for select using (true);

-- confirm_booking_payment: p_provider_ref is NOT verified against any payment
-- provider — it is whatever string the caller passes over supabase.rpc(...).
-- This is safe ONLY because the payment rail (src/services/paymentRail.js)
-- is a client-side stub: no real money moves, so there is nothing to fake.
-- Wiring a real PSP (CliQ, a card processor, etc.) requires REWRITING this
-- function to verify the charge against a server-side source of truth — a
-- webhook-recorded payment, or a charge this function itself initiates —
-- before setting the booking to Confirmed. The live_payments check below
-- does not perform that integration; it only makes this function refuse to
-- run once live_payments is turned on, so a misconfiguration fails loudly
-- instead of silently accepting a fabricated reference as proof of payment.
create or replace function public.confirm_booking_payment(p_booking_id uuid, p_provider_ref text)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings; v_code text;
begin
  if (select live_payments from platform_settings where id = 1) then
    raise exception 'Live payments are enabled but confirm_booking_payment still accepts an unverified client-supplied reference. Integrate a server-side payment verification (PSP webhook or server-initiated charge) before enabling live_payments.';
  end if;

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
