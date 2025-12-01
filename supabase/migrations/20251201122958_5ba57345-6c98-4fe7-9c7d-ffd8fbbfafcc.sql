-- Remove the dangerous public SELECT policy on shares table
DROP POLICY IF EXISTS "Anyone can view share tokens" ON public.shares;