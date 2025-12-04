-- Upgrade storage quota to 100TB (100 * 1024^4 bytes = 109951162777600)
UPDATE public.profiles SET storage_quota_bytes = 109951162777600;

-- Update default for new users
ALTER TABLE public.profiles ALTER COLUMN storage_quota_bytes SET DEFAULT 109951162777600;