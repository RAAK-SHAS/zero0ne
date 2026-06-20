ALTER TABLE public.files
ADD COLUMN IF NOT EXISTS upload_strategy TEXT NOT NULL DEFAULT 'single',
ADD COLUMN IF NOT EXISTS chunk_size_bytes BIGINT,
ADD COLUMN IF NOT EXISTS chunk_count INTEGER,
ADD COLUMN IF NOT EXISTS chunk_paths TEXT[];

ALTER TABLE public.files
ADD CONSTRAINT files_upload_strategy_valid
CHECK (upload_strategy IN ('single', 'chunked'));

CREATE INDEX IF NOT EXISTS idx_files_upload_strategy ON public.files(upload_strategy);