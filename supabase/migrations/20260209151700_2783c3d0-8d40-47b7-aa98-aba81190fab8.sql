
-- Fix 1: Recreate folders_safe view with owner filtering built-in
-- This ensures password_hash is never exposed and only owner's folders are returned
DROP VIEW IF EXISTS public.folders_safe;
CREATE VIEW public.folders_safe AS
  SELECT id, user_id, name, parent_id, created_at, updated_at, is_hidden, is_locked
  FROM public.folders
  WHERE user_id = auth.uid();

-- Fix 2: Block direct SELECT on folders table to prevent password_hash exposure
-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own folders" ON public.folders;
-- Create new SELECT policy that blocks direct access
CREATE POLICY "Users can view their own folders"
  ON public.folders FOR SELECT
  USING (false);

-- The INSERT/UPDATE/DELETE policies remain unchanged - they don't expose password_hash
