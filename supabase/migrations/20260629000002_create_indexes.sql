-- ============================================================
-- Migration: 20260629000002_create_indexes
--
-- Explicit indexes beyond the primary-key indexes that Postgres
-- creates automatically.
--
-- NOTE: The foreign key orders.ticket_id → tickets.id does NOT
-- have a covering index in production. This is a known
-- performance issue flagged by the Supabase advisor and should
-- be addressed in a separate cleanup migration. It is omitted
-- here to reflect the exact current live state.
-- ============================================================


-- Partial unique index on ticket_qr_hash.
-- Only applies when ticket_qr_hash IS NOT NULL so that rows
-- without a QR hash (e.g. legacy listings before validation
-- was introduced) do not conflict with each other.
-- This is the database-level guard for duplicate-ticket prevention.

CREATE UNIQUE INDEX IF NOT EXISTS tickets_ticket_qr_hash_unique
  ON public.tickets (ticket_qr_hash)
  WHERE ticket_qr_hash IS NOT NULL;
