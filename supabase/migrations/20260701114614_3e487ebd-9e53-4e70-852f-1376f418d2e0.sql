
-- 1. activity_logs: remove client INSERT
DROP POLICY IF EXISTS "Users can create their own activity" ON public.activity_logs;
REVOKE INSERT ON public.activity_logs FROM authenticated, anon;

-- 2. folders: column-level SELECT excluding password_hash
REVOKE SELECT ON public.folders FROM authenticated, anon;
GRANT SELECT (id, user_id, name, parent_id, created_at, updated_at, is_hidden, is_locked) ON public.folders TO authenticated;

-- 3. shares: column-level SELECT excluding password_hash
REVOKE SELECT ON public.shares FROM authenticated, anon;
GRANT SELECT (id, file_id, token, expires_at, created_at) ON public.shares TO authenticated;

-- 4. realtime.messages RLS: only allow users to subscribe to their own topics
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can subscribe to own topics" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe to own topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() LIKE '%:' || auth.uid()::text)
  OR (realtime.topic() LIKE '%:' || auth.uid()::text || ':%')
);
