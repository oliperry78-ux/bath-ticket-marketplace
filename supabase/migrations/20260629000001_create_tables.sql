-- ============================================================
-- Migration: 20260629000001_create_tables
--
-- Baseline capture of all public tables as they exist in the
-- live production database on 2026-06-29.
--
-- Tables: profiles, tickets, orders
-- DO NOT modify this file — open a new migration for changes.
-- ============================================================


-- ── profiles ────────────────────────────────────────────────
-- Created automatically when a new auth.users row is inserted
-- via the handle_new_user() trigger (see 20260629000006_triggers).
-- Primary key references auth.users so profiles are tied 1:1
-- to Supabase Auth accounts.

CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id),
  email      text,
  created_at timestamp with time zone DEFAULT now()
);


-- ── tickets ─────────────────────────────────────────────────
-- Core listing table. Sellers create rows here when uploading
-- a ticket. status values observed in production:
--   'available' (default) | 'reserved' | 'sold'
--
-- ticket_image_url: legacy column, no longer populated by the
--   current application code but retained for existing rows.
-- ticket_qr_hash: SHA-256 of the raw QR payload; enforces
--   duplicate-ticket prevention via a partial unique index
--   (see 20260629000002_create_indexes).
-- validation_status / validation_notes: set at listing time
--   to record the result of ticket file validation.

CREATE TABLE IF NOT EXISTS public.tickets (
  id               uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name       text,
  venue            text,
  event_date       timestamp without time zone,
  price            numeric,
  seller_id        uuid,
  ticket_image_url text,
  status           text    DEFAULT 'available'::text,
  created_at       timestamp without time zone DEFAULT now(),
  ticket_file_path text,
  seller_email     text,
  ticket_qr_hash   text,
  validation_status text,
  validation_notes  text
);


-- ── orders ──────────────────────────────────────────────────
-- Created atomically by the reserve_ticket() RPC when a buyer
-- reserves a ticket. ticket_id has a foreign key back to
-- tickets(id) with default ON DELETE NO ACTION — the application
-- must delete orders before deleting the parent ticket.
--
-- status values observed in production:
--   'pending' (default) | 'completed'

CREATE TABLE IF NOT EXISTS public.orders (
  id             uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id      uuid    REFERENCES public.tickets(id),
  buyer_id       uuid,
  seller_id      uuid,
  purchase_price numeric,
  status         text    DEFAULT 'pending'::text,
  created_at     timestamp without time zone DEFAULT now()
);
