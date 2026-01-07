-- Fix RLS policies to require authentication on ALL tables
-- This prevents anonymous users from accessing any data

-- ============================================
-- PROFILES TABLE
-- ============================================

-- SELECT policy
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated' AND auth.uid() = id);

-- UPDATE policy
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.role() = 'authenticated' AND auth.uid() = id);

-- ============================================
-- FILES TABLE
-- ============================================

-- SELECT policies
DROP POLICY IF EXISTS "Users can view own active files" ON files;
CREATE POLICY "Users can view own active files"
  ON files FOR SELECT
  USING (auth.role() = 'authenticated' AND auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can view own trashed files" ON files;
CREATE POLICY "Users can view own trashed files"
  ON files FOR SELECT
  USING (auth.role() = 'authenticated' AND auth.uid() = user_id AND deleted_at IS NOT NULL);

-- INSERT policy
DROP POLICY IF EXISTS "Users can insert own files" ON files;
CREATE POLICY "Users can insert own files"
  ON files FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- UPDATE policy
DROP POLICY IF EXISTS "Users can update own files" ON files;
CREATE POLICY "Users can update own files"
  ON files FOR UPDATE
  USING (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- DELETE policy
DROP POLICY IF EXISTS "Users can delete own files" ON files;
CREATE POLICY "Users can delete own files"
  ON files FOR DELETE
  USING (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- ============================================
-- SHARES TABLE
-- ============================================

-- SELECT policy
DROP POLICY IF EXISTS "Users can view shares for own files" ON shares;
CREATE POLICY "Users can view shares for own files"
  ON shares FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM files
      WHERE files.id = shares.file_id AND files.user_id = auth.uid()
    )
  );

-- INSERT policy
DROP POLICY IF EXISTS "Users can create shares for own files" ON shares;
CREATE POLICY "Users can create shares for own files"
  ON shares FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM files
      WHERE files.id = shares.file_id AND files.user_id = auth.uid()
    )
  );

-- DELETE policy
DROP POLICY IF EXISTS "Users can delete shares for own files" ON shares;
CREATE POLICY "Users can delete shares for own files"
  ON shares FOR DELETE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM files
      WHERE files.id = shares.file_id AND files.user_id = auth.uid()
    )
  );

-- ============================================
-- FILE_VERSIONS TABLE
-- ============================================

-- SELECT policy
DROP POLICY IF EXISTS "Users can view versions of own files" ON file_versions;
CREATE POLICY "Users can view versions of own files"
  ON file_versions FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM files
      WHERE files.id = file_versions.file_id AND files.user_id = auth.uid()
    )
  );

-- INSERT policy
DROP POLICY IF EXISTS "Users can create versions of own files" ON file_versions;
CREATE POLICY "Users can create versions of own files"
  ON file_versions FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM files
      WHERE files.id = file_versions.file_id AND files.user_id = auth.uid()
    )
  );

-- ============================================
-- FOLDERS TABLE
-- ============================================

-- SELECT policy
DROP POLICY IF EXISTS "Users can view their own folders" ON folders;
CREATE POLICY "Users can view their own folders"
  ON folders FOR SELECT
  USING (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- INSERT policy
DROP POLICY IF EXISTS "Users can create their own folders" ON folders;
CREATE POLICY "Users can create their own folders"
  ON folders FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- UPDATE policy
DROP POLICY IF EXISTS "Users can update their own folders" ON folders;
CREATE POLICY "Users can update their own folders"
  ON folders FOR UPDATE
  USING (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- DELETE policy
DROP POLICY IF EXISTS "Users can delete their own folders" ON folders;
CREATE POLICY "Users can delete their own folders"
  ON folders FOR DELETE
  USING (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- ============================================
-- ACTIVITY_LOGS TABLE
-- ============================================

-- SELECT policy
DROP POLICY IF EXISTS "Users can view their own activity" ON activity_logs;
CREATE POLICY "Users can view their own activity"
  ON activity_logs FOR SELECT
  USING (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- INSERT policy
DROP POLICY IF EXISTS "Users can create their own activity" ON activity_logs;
CREATE POLICY "Users can create their own activity"
  ON activity_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);