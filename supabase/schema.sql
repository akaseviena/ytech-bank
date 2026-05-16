CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  avatar_url TEXT,
  phone TEXT,
  plan TEXT NOT NULL DEFAULT 'basic'
    CHECK (plan IN ('basic','standard','travel','metal','ultimate','business')),
  balance DECIMAL(12,2) NOT NULL DEFAULT 1000.00,
  account_number TEXT UNIQUE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  card_frozen BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  receiver_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  category TEXT DEFAULT 'other'
    CHECK (category IN ('food','transport','entertainment','shopping','health','education','travel','business','other')),
  type TEXT NOT NULL CHECK (type IN ('transfer','deposit','withdrawal')),
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending','completed','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('transfer','system','promo','info')),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount DECIMAL(12,2) NOT NULL,
  current_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  emoji TEXT DEFAULT '🎯',
  deadline DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION generate_account_number()
RETURNS TEXT AS $$
DECLARE new_number TEXT;
BEGIN
  LOOP
    new_number := 'YT' || LPAD(FLOOR(RANDOM() * 1000000000)::TEXT, 9, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE account_number = new_number);
  END LOOP;
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION transfer_funds(
  p_sender_id UUID, p_receiver_id UUID,
  p_amount DECIMAL, p_description TEXT, p_category TEXT DEFAULT 'other'
)
RETURNS JSONB AS $$
DECLARE v_balance DECIMAL;
BEGIN
  SELECT balance INTO v_balance FROM profiles WHERE id = p_sender_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Sender not found'); END IF;
  IF p_sender_id = p_receiver_id THEN RETURN jsonb_build_object('success',false,'error','Cannot transfer to yourself'); END IF;
  IF v_balance < p_amount THEN RETURN jsonb_build_object('success',false,'error','Insufficient funds'); END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_receiver_id) THEN RETURN jsonb_build_object('success',false,'error','Recipient not found'); END IF;
  UPDATE profiles SET balance = balance - p_amount, updated_at = NOW() WHERE id = p_sender_id;
  UPDATE profiles SET balance = balance + p_amount, updated_at = NOW() WHERE id = p_receiver_id;
  INSERT INTO transactions (sender_id,receiver_id,amount,description,category,type,status)
  VALUES (p_sender_id,p_receiver_id,p_amount,p_description,p_category,'transfer','completed');
  INSERT INTO notifications (user_id,title,message,type) VALUES
    (p_sender_id,'Transfer sent','You sent €'||p_amount||COALESCE(' · '||p_description,''),'transfer'),
    (p_receiver_id,'Money received','You received €'||p_amount||COALESCE(' · '||p_description,''),'transfer');
  RETURN jsonb_build_object('success',true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id,email,first_name,last_name,account_number)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name','User'),
    COALESCE(NEW.raw_user_meta_data->>'last_name',''),
    generate_account_number())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block auth user creation even if profile insert fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own profile" ON profiles;
CREATE POLICY "own profile" ON profiles FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "search profiles" ON profiles;
CREATE POLICY "search profiles" ON profiles FOR SELECT USING (true);

-- SELECT: covers all transactions involving the user, including null-receiver withdrawals
DROP POLICY IF EXISTS "own transactions" ON transactions;
CREATE POLICY "own transactions" ON transactions FOR SELECT
  USING (
    auth.uid() = sender_id OR
    auth.uid() = receiver_id OR
    (auth.uid() = sender_id AND receiver_id IS NULL)
  );

-- INSERT: user may only insert transactions where they are the sender
DROP POLICY IF EXISTS "insert own transactions" ON transactions;
CREATE POLICY "insert own transactions" ON transactions FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "own notifications" ON notifications;
CREATE POLICY "own notifications" ON notifications FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own conversations" ON ai_conversations;
CREATE POLICY "own conversations" ON ai_conversations FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own goals" ON savings_goals;
CREATE POLICY "own goals" ON savings_goals FOR ALL USING (auth.uid() = user_id);
