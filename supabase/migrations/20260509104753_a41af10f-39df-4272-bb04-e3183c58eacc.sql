-- Raise bucket-level upload limit to 50GB so large files can use TUS resumable uploads
UPDATE storage.buckets
SET file_size_limit = 53687091200  -- 50 GB
WHERE id = 'user-files';