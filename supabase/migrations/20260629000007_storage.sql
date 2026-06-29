-- ============================================================
-- Migration: 20260629000007_storage
--
-- Storage bucket and RLS policies as they exist in production
-- on 2026-06-29.
--
-- Bucket: ticket-files (private)
-- Policies: all on storage.objects
--
-- NOTE: There are two identical SELECT policies in production:
--   "Sellers can read own files"
--   "Sellers can read own ticket files"
-- Both are reproduced here exactly. One should be dropped in a
-- separate cleanup migration.
--
-- IMPORTANT: Supabase manages the storage schema internally.
-- Running this migration against a fresh project requires that
-- the storage schema already exists (which Supabase provisions
-- automatically). Do not run this against a plain Postgres
-- instance without the Supabase storage extension.
-- ============================================================


-- ── Bucket ──────────────────────────────────────────────────
-- Private bucket: files are not publicly accessible.
-- Signed URLs are generated server-side by the application for
-- authorized access (see app/api/ticket-file/[ticketId]/route.ts).

INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-files', 'ticket-files', false)
ON CONFLICT (id) DO NOTHING;


-- ── Storage RLS policies ─────────────────────────────────────
-- All policies check that:
--   bucket_id = 'ticket-files'
--   AND the first path segment matches the authenticated user's
--       UUID (i.e. files are stored at {user_id}/{filename})

-- Sellers can upload their own ticket files.
CREATE POLICY "Sellers can upload ticket files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-files'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- Sellers can read their own ticket files.
-- (Duplicate of "Sellers can read own ticket files" below —
-- both are present in production and reproduced here as-is.)
CREATE POLICY "Sellers can read own files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ticket-files'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- Duplicate SELECT policy present in production.
CREATE POLICY "Sellers can read own ticket files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ticket-files'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- Sellers can delete their own ticket files.
-- Used when a seller deletes a listing (dashboard action).
CREATE POLICY "Sellers can delete own ticket files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'ticket-files'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
