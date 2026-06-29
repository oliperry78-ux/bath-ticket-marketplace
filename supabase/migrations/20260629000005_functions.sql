-- ============================================================
-- Migration: 20260629000005_functions
--
-- All three public Postgres functions as they exist in
-- production on 2026-06-29. Definitions captured verbatim
-- from pg_get_functiondef().
--
-- All functions are SECURITY DEFINER with search_path = public.
--
-- Security issues to address in a separate cleanup migration:
--
--   handle_new_user: callable by anon role via
--     /rest/v1/rpc/handle_new_user — should revoke EXECUTE
--     from anon since it is only meant to be called by the
--     auth trigger, not from the API.
--
--   get_seller_reservations: callable by anon role via
--     /rest/v1/rpc/get_seller_reservations — should revoke
--     EXECUTE from anon since it returns nothing useful without
--     an authenticated session.
--
--   reserve_ticket: callable by anon, but the function itself
--     guards against unauthenticated callers via auth.uid()
--     IS NULL check, so impact is low. Revoking anon EXECUTE
--     is still best practice.
-- ============================================================


-- ── handle_new_user ─────────────────────────────────────────
-- Trigger function: inserts a profile row whenever a new
-- auth.users record is created. Called by on_auth_user_created
-- trigger (see 20260629000006_triggers).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;


-- ── get_seller_reservations ──────────────────────────────────
-- Returns the ticket_id and buyer email for every pending
-- reservation belonging to the currently authenticated seller.
-- Joins orders → auth.users, which is only possible inside a
-- SECURITY DEFINER function because auth.users is not in the
-- public schema and therefore not directly accessible via
-- PostgREST.

CREATE OR REPLACE FUNCTION public.get_seller_reservations()
RETURNS TABLE(ticket_id uuid, buyer_email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT o.ticket_id, u.email AS buyer_email
  FROM   public.orders o
  JOIN   auth.users   u ON u.id = o.buyer_id
  WHERE  o.seller_id = auth.uid()
    AND  o.status    = 'pending';
$$;


-- ── reserve_ticket ───────────────────────────────────────────
-- Atomically reserves a ticket for the calling buyer.
-- Uses FOR UPDATE row-level locking to prevent double-booking.
-- Guards:
--   - buyer must be authenticated (auth.uid() IS NOT NULL)
--   - ticket must exist
--   - ticket must be status = 'available'
--   - buyer must not be the seller
-- On success: sets ticket.status = 'reserved' and inserts an
-- order row with status = 'pending'.

CREATE OR REPLACE FUNCTION public.reserve_ticket(p_ticket_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_ticket   RECORD;
  v_buyer_id UUID;
BEGIN
  v_buyer_id := auth.uid();

  IF v_buyer_id IS NULL THEN
    RETURN json_build_object('error', 'Unauthorized: no authenticated session.');
  END IF;

  SELECT id, price, seller_id, status
  INTO   v_ticket
  FROM   public.tickets
  WHERE  id = p_ticket_id
  FOR    UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Ticket not found.');
  END IF;

  IF v_ticket.status != 'available' THEN
    RETURN json_build_object('error', 'This ticket is no longer available.');
  END IF;

  IF v_ticket.seller_id = v_buyer_id THEN
    RETURN json_build_object('error', 'You cannot reserve your own ticket.');
  END IF;

  UPDATE public.tickets
  SET    status = 'reserved'
  WHERE  id = p_ticket_id;

  INSERT INTO public.orders (ticket_id, buyer_id, seller_id, purchase_price, status)
  VALUES (p_ticket_id, v_buyer_id, v_ticket.seller_id, v_ticket.price, 'pending');

  RETURN json_build_object('success', true);
END;
$$;
