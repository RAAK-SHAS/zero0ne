
-- B-1: restore activity_logs INSERT but with entity-ownership check
DROP POLICY IF EXISTS "Users can create their own activity" ON public.activity_logs;
GRANT INSERT ON public.activity_logs TO authenticated;

CREATE POLICY "Users can log activity for their own entities"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    entity_id IS NULL
    OR (
      entity_type = 'file'
      AND EXISTS (SELECT 1 FROM public.files f WHERE f.id = entity_id AND f.user_id = auth.uid())
    )
    OR (
      entity_type = 'folder'
      AND EXISTS (SELECT 1 FROM public.folders fo WHERE fo.id = entity_id AND fo.user_id = auth.uid())
    )
  )
);

-- B-3: storage-usage trigger must also react to soft-delete (deleted_at) transitions
CREATE OR REPLACE FUNCTION public.update_storage_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.size_bytes < 0 THEN
      RAISE EXCEPTION 'size_bytes cannot be negative';
    END IF;
    IF NEW.deleted_at IS NULL THEN
      UPDATE profiles
      SET storage_used_bytes = storage_used_bytes + NEW.size_bytes
      WHERE id = NEW.user_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- soft-delete: subtract
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      UPDATE profiles
      SET storage_used_bytes = GREATEST(0, storage_used_bytes - OLD.size_bytes)
      WHERE id = OLD.user_id;
    -- restore: add back
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      UPDATE profiles
      SET storage_used_bytes = storage_used_bytes + NEW.size_bytes
      WHERE id = NEW.user_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.deleted_at IS NULL THEN
      UPDATE profiles
      SET storage_used_bytes = GREATEST(0, storage_used_bytes - OLD.size_bytes)
      WHERE id = OLD.user_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS files_storage_usage ON public.files;
CREATE TRIGGER files_storage_usage
AFTER INSERT OR UPDATE OR DELETE ON public.files
FOR EACH ROW EXECUTE FUNCTION public.update_storage_usage();

-- B-4: schedule cleanup_old_trash daily (best-effort — pg_cron may not be enabled on all tiers)
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    -- pg_cron unavailable; client will trigger cleanup opportunistically
    RETURN;
  END;

  BEGIN
    PERFORM cron.unschedule('cleanup_old_trash_daily');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  PERFORM cron.schedule(
    'cleanup_old_trash_daily',
    '0 3 * * *',
    $cron$SELECT public.cleanup_old_trash();$cron$
  );
END $$;
