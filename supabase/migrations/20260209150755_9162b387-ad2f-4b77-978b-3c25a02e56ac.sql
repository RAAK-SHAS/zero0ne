
-- Add hidden and locked folder columns
ALTER TABLE public.folders 
ADD COLUMN is_hidden boolean NOT NULL DEFAULT false,
ADD COLUMN is_locked boolean NOT NULL DEFAULT false,
ADD COLUMN password_hash text DEFAULT NULL;

-- Create a view that excludes password_hash for client queries
CREATE VIEW public.folders_safe
WITH (security_invoker=on) AS
  SELECT id, user_id, name, parent_id, created_at, updated_at, is_hidden, is_locked
  FROM public.folders;
