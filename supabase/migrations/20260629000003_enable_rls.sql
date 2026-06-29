-- ============================================================
-- Migration: 20260629000003_enable_rls
--
-- Enable Row Level Security on all public tables.
-- RLS is confirmed enabled on all three tables in production.
-- Policies are defined in 20260629000004_rls_policies.
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders   ENABLE ROW LEVEL SECURITY;
