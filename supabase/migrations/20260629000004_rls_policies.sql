-- ============================================================
-- Migration: 20260629000004_rls_policies
--
-- All RLS policies exactly as they exist in production on
-- 2026-06-29. Duplicates and redundancies are preserved
-- intentionally — this is a faithful baseline capture.
--
-- Issues to address in a separate cleanup migration:
--
--   tickets — SELECT:
--     "Sellers can view all their own tickets" (role: public)
--     "Sellers can view own tickets"           (role: authenticated)
--     These are near-identical; one should be dropped.
--
--   tickets — UPDATE:
--     "Sellers can update own tickets"  (authenticated)
--     "Users can update own tickets"    (authenticated)
--     Identical conditions; one should be dropped.
--
--   orders — SELECT:
--     "Buyers can view own orders"            (role: public)
--     "Sellers can view orders for own tickets" (role: public)
--     Both use role 'public' (meaning anon + authenticated).
--     Should use role 'authenticated' only.
--
--   All policies use bare auth.uid() instead of
--   (select auth.uid()), causing per-row re-evaluation.
--   Fix in a cleanup migration for a performance improvement.
-- ============================================================


-- ── profiles ────────────────────────────────────────────────

CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);


-- ── tickets ─────────────────────────────────────────────────

-- Public marketplace: anyone (including unauthenticated) can
-- see available listings.
CREATE POLICY "Public can view available tickets"
  ON public.tickets
  FOR SELECT
  USING (status = 'available'::text);

-- Sellers can see all their own listings regardless of status.
-- NOTE: this policy uses role 'public' (anon + authenticated).
-- See cleanup note above.
CREATE POLICY "Sellers can view all their own tickets"
  ON public.tickets
  FOR SELECT
  USING (auth.uid() = seller_id);

-- Duplicate of the above scoped to authenticated role only.
-- Both policies are present in production.
CREATE POLICY "Sellers can view own tickets"
  ON public.tickets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = seller_id);

-- Only authenticated sellers can create listings.
CREATE POLICY "Authenticated users can create tickets"
  ON public.tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id);

-- Sellers can update their own listings (e.g. mark as sold).
CREATE POLICY "Sellers can update own tickets"
  ON public.tickets
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- Duplicate update policy present in production.
CREATE POLICY "Users can update own tickets"
  ON public.tickets
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- Sellers can delete their own listings.
CREATE POLICY "Users can delete own tickets"
  ON public.tickets
  FOR DELETE
  TO authenticated
  USING (auth.uid() = seller_id);


-- ── orders ──────────────────────────────────────────────────

-- Buyers can view reservations they made.
-- NOTE: uses role 'public' — should be 'authenticated'.
CREATE POLICY "Buyers can view own orders"
  ON public.orders
  FOR SELECT
  USING (auth.uid() = buyer_id);

-- Sellers can see orders placed against their tickets.
-- NOTE: uses role 'public' — should be 'authenticated'.
CREATE POLICY "Sellers can view orders for own tickets"
  ON public.orders
  FOR SELECT
  USING (auth.uid() = seller_id);

-- Buyers can create order rows (insert done by reserve_ticket
-- RPC via SECURITY DEFINER, but this policy also permits it
-- directly for authenticated users).
CREATE POLICY "Authenticated users can create orders"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

-- Sellers can update order status on their own tickets
-- (e.g. marking an order as completed when they mark sold).
CREATE POLICY "sellers_update_own_orders"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- Sellers can delete orders on their own tickets
-- (required before deleting the parent ticket row).
CREATE POLICY "sellers_delete_own_orders"
  ON public.orders
  FOR DELETE
  TO authenticated
  USING (auth.uid() = seller_id);
