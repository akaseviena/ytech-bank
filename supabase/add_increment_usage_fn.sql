-- Run this in the Supabase SQL Editor.
--
-- Atomic increment for daily_usage.
-- Uses message_count = daily_usage.message_count + 1 directly in SQL so
-- concurrent requests from multiple tabs/agents can never overwrite each other.
-- Returns the new message_count so the API route can pass the real value to the frontend.
--
CREATE OR REPLACE FUNCTION increment_daily_usage(p_user_id UUID, p_date DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO daily_usage (user_id, usage_date, message_count)
  VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET message_count = daily_usage.message_count + 1
  RETURNING message_count INTO v_count;

  RETURN v_count;
END;
$$;
