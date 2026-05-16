-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- This fixes the handle_new_user trigger that blocks user registration

-- 1. Fix generate_account_number — add SECURITY DEFINER + explicit search_path
CREATE OR REPLACE FUNCTION public.generate_account_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_number TEXT;
BEGIN
  LOOP
    new_number := 'YT' || LPAD(FLOOR(RANDOM() * 1000000000)::TEXT, 9, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE account_number = new_number
    );
  END LOOP;
  RETURN new_number;
END;
$$;

-- 2. Fix handle_new_user — add SECURITY DEFINER + explicit search_path + EXCEPTION block
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, account_number)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    public.generate_account_number()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block auth user creation even if profile insert fails
  RETURN NEW;
END;
$$;

-- 3. Recreate the trigger (ensures it points to the updated function)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
