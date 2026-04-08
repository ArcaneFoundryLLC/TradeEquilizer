-- Fix trade session RLS policies to allow the QR join flow
-- Problem: Player B cannot SELECT or UPDATE a session they haven't joined yet

-- 1. Drop the overly restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own trade sessions" ON trade_sessions;

-- 2. Replace with a policy that also allows viewing "waiting" sessions (needed for QR join)
CREATE POLICY "Users can view trade sessions" ON trade_sessions
  FOR SELECT USING (
    auth.uid() = user_a_id
    OR auth.uid() = user_b_id
    OR status = 'waiting'  -- anyone authenticated can look up a waiting session by QR code
  );

-- 3. Drop the restrictive UPDATE policy
DROP POLICY IF EXISTS "Session participants can update sessions" ON trade_sessions;

-- 4. Replace with a policy that allows joining (setting user_b_id) and participant updates
CREATE POLICY "Session participants can update sessions" ON trade_sessions
  FOR UPDATE USING (
    auth.uid() = user_a_id
    OR auth.uid() = user_b_id
    OR (status = 'waiting' AND user_b_id IS NULL)  -- allow joining a waiting session
  );

-- 5. Make generate_qr_code SECURITY DEFINER so it can check uniqueness across all sessions
CREATE OR REPLACE FUNCTION generate_qr_code()
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 12));
    SELECT EXISTS(
      SELECT 1 FROM trade_sessions
      WHERE qr_code = v_code
      AND expires_at > NOW()
    ) INTO v_exists;
    IF NOT v_exists THEN
      EXIT;
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
