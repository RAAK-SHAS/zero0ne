
-- 1. Fix broken folders SELECT policy
DROP POLICY IF EXISTS "Users can view their own folders" ON public.folders;
CREATE POLICY "Users can view their own folders"
ON public.folders
FOR SELECT
USING (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- 2. Recreate folders_safe view with security_invoker so it respects caller RLS
DROP VIEW IF EXISTS public.folders_safe;
CREATE VIEW public.folders_safe
WITH (security_invoker = true)
AS
SELECT id, user_id, name, parent_id, created_at, updated_at, is_hidden, is_locked
FROM public.folders
WHERE user_id = auth.uid();

GRANT SELECT ON public.folders_safe TO authenticated;

-- 3. Hide shares.password_hash from clients
-- Drop existing SELECT policy and replace with a safer one. We also revoke
-- column-level SELECT on password_hash from authenticated users.
REVOKE SELECT (password_hash) ON public.shares FROM authenticated;
REVOKE SELECT (password_hash) ON public.shares FROM anon;

-- Create a safe view exposing shares without password_hash
DROP VIEW IF EXISTS public.shares_safe;
CREATE VIEW public.shares_safe
WITH (security_invoker = true)
AS
SELECT s.id, s.file_id, s.token, s.expires_at, s.created_at,
       (s.password_hash IS NOT NULL) AS password_protected
FROM public.shares s;

GRANT SELECT ON public.shares_safe TO authenticated;

-- 4. share_attempts table for brute-force protection
CREATE TABLE IF NOT EXISTS public.share_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL,
  ip_address text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  succeeded boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_share_attempts_token_time
  ON public.share_attempts (token_hash, attempted_at DESC);

ALTER TABLE public.share_attempts ENABLE ROW LEVEL SECURITY;
-- No client policies: only service role (edge functions) reads/writes this.

-- 5. ai_call_log table for rate-limiting the terminal-ai function
CREATE TABLE IF NOT EXISTS public.ai_call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  called_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_call_log_user_time
  ON public.ai_call_log (user_id, called_at DESC);

ALTER TABLE public.ai_call_log ENABLE ROW LEVEL SECURITY;
-- No client policies: only service role manages this.
