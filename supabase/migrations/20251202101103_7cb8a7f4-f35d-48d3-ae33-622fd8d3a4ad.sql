-- Upgrade storage quota to 100GB
ALTER TABLE public.profiles 
ALTER COLUMN storage_quota_bytes SET DEFAULT 107374182400;

-- Update existing users to 100GB quota
UPDATE public.profiles 
SET storage_quota_bytes = 107374182400 
WHERE storage_quota_bytes = 10737418240;

-- Create file versions table for version history
CREATE TABLE public.file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  UNIQUE(file_id, version_number)
);

-- Add encryption metadata to files table
ALTER TABLE public.files 
ADD COLUMN is_encrypted BOOLEAN DEFAULT FALSE,
ADD COLUMN encryption_algorithm TEXT,
ADD COLUMN encryption_metadata JSONB;

-- Enable RLS on file_versions
ALTER TABLE public.file_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies for file_versions
CREATE POLICY "Users can view versions of own files"
ON public.file_versions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.files 
    WHERE files.id = file_versions.file_id 
    AND files.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create versions of own files"
ON public.file_versions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.files 
    WHERE files.id = file_versions.file_id 
    AND files.user_id = auth.uid()
  )
);

-- Create index for faster version lookups
CREATE INDEX idx_file_versions_file_id ON public.file_versions(file_id);
CREATE INDEX idx_files_encrypted ON public.files(is_encrypted) WHERE is_encrypted = TRUE;