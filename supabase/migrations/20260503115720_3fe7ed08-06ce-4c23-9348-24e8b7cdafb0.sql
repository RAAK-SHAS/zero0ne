CREATE TABLE IF NOT EXISTS public.run_code_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  executed_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS run_code_log_user_time_idx
  ON public.run_code_log (user_id, executed_at DESC);

ALTER TABLE public.run_code_log ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (used by the run-code edge function) can read/write.