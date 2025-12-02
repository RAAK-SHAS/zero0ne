-- Add trash system to files table
ALTER TABLE public.files ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add password protection to shares table
ALTER TABLE public.shares ADD COLUMN password_hash TEXT DEFAULT NULL;

-- Add index for finding trashed files
CREATE INDEX idx_files_deleted_at ON public.files(deleted_at) WHERE deleted_at IS NOT NULL;

-- Add index for finding non-trashed files
CREATE INDEX idx_files_active ON public.files(user_id, deleted_at) WHERE deleted_at IS NULL;

-- Update RLS policies to exclude deleted files from normal views
DROP POLICY IF EXISTS "Users can view own files" ON public.files;
CREATE POLICY "Users can view own active files"
ON public.files
FOR SELECT
USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Add policy for viewing trashed files
CREATE POLICY "Users can view own trashed files"
ON public.files
FOR SELECT
USING (auth.uid() = user_id AND deleted_at IS NOT NULL);

-- Function to automatically delete files older than 30 days in trash
CREATE OR REPLACE FUNCTION public.cleanup_old_trash()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.files
  WHERE deleted_at IS NOT NULL 
  AND deleted_at < NOW() - INTERVAL '30 days';
END;
$$;