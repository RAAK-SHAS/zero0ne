-- Improve update_storage_usage function with validation
CREATE OR REPLACE FUNCTION public.update_storage_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.size_bytes < 0 THEN
      RAISE EXCEPTION 'size_bytes cannot be negative';
    END IF;
    
    UPDATE profiles
    SET storage_used_bytes = storage_used_bytes + NEW.size_bytes
    WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles
    SET storage_used_bytes = GREATEST(0, storage_used_bytes - OLD.size_bytes)
    WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$function$;

-- Improve handle_new_user function with error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;
  
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    RETURN NEW;
END;
$function$;