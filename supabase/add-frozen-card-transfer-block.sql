-- ─────────────────────────────────────────────────────────────────────────────
-- Add: frozen-card check to transfer_funds()
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────
--
-- A frozen card must not be able to move money. The transfer page checks
-- profiles.card_frozen before calling this function, but that check lives in
-- the browser and can be bypassed by calling the RPC directly, so the same
-- rule is enforced here.
--
-- The check reads card_frozen from the row already locked FOR UPDATE, so a
-- freeze committing concurrently either lands before the lock (and blocks the
-- transfer) or after it (and the transfer completes) — never half-applied.
--
-- Returns an extra 'code' field so the frontend can tell a frozen card apart
-- from other failures and show the unfreeze prompt instead of a generic error.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION transfer_funds(
  p_sender_id UUID, p_receiver_id UUID,
  p_amount DECIMAL, p_description TEXT, p_category TEXT DEFAULT 'other'
)
RETURNS JSONB AS $$
DECLARE
  v_balance DECIMAL;
  v_frozen  BOOLEAN;
BEGIN
  SELECT balance, COALESCE(card_frozen, FALSE)
    INTO v_balance, v_frozen
    FROM profiles WHERE id = p_sender_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Sender not found'); END IF;
  IF v_frozen THEN
    RETURN jsonb_build_object(
      'success', false,
      'code',    'card_frozen',
      'error',   'Your card is frozen 🔒 — unfreeze it first to send money.'
    );
  END IF;
  IF p_sender_id = p_receiver_id THEN RETURN jsonb_build_object('success',false,'error','Cannot transfer to yourself'); END IF;
  IF v_balance < p_amount THEN RETURN jsonb_build_object('success',false,'error','Insufficient funds'); END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_receiver_id) THEN RETURN jsonb_build_object('success',false,'error','Recipient not found'); END IF;
  UPDATE profiles SET balance = balance - p_amount, updated_at = NOW() WHERE id = p_sender_id;
  UPDATE profiles SET balance = balance + p_amount, updated_at = NOW() WHERE id = p_receiver_id;
  INSERT INTO transactions (sender_id,receiver_id,amount,description,category,type,status)
  VALUES (p_sender_id,p_receiver_id,p_amount,p_description,p_category,'transfer','completed');
  INSERT INTO notifications (user_id,title,message,type) VALUES
    (p_sender_id,'Transfer sent','You sent £'||p_amount||COALESCE(' · '||p_description,''),'transfer'),
    (p_receiver_id,'Money received','You received £'||p_amount||COALESCE(' · '||p_description,''),'transfer');
  RETURN jsonb_build_object('success',true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
