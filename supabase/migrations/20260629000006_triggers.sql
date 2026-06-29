-- ============================================================
-- Migration: 20260629000006_triggers
--
-- Triggers as they exist in production on 2026-06-29.
--
-- There is exactly one non-internal trigger: on_auth_user_created
-- on auth.users. It fires handle_new_user() (defined in
-- 20260629000005_functions) after every new user signs up.
--
-- The storage and realtime triggers (tr_check_filters,
-- protect_buckets_delete, etc.) are Supabase-internal and are
-- managed by the platform — they do not need to be reproduced
-- in migrations.
-- ============================================================


-- Creates a profile row for every new auth signup.
-- Must run AFTER INSERT so new.id and new.email are available.

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
