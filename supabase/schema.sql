-- ChadWallet Supabase schema
-- Run this in the Supabase dashboard SQL editor.

-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  privy_id       TEXT PRIMARY KEY,
  wallet_address TEXT,
  email          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- NOTE: Production should replace this with a policy that validates the Privy JWT.
CREATE POLICY "allow all for anon key" ON profiles
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- watchlist
-- ============================================================
CREATE TABLE IF NOT EXISTS watchlist (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  privy_id      TEXT        NOT NULL,
  token_address TEXT        NOT NULL,
  token_symbol  TEXT,
  token_name    TEXT,
  logo_uri      TEXT,
  added_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (privy_id, token_address)
);

ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- NOTE: Production should replace this with a policy that validates the Privy JWT.
CREATE POLICY "allow all for anon key" ON watchlist
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- trades
-- ============================================================
CREATE TABLE IF NOT EXISTS trades (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  privy_id       TEXT        NOT NULL,
  wallet_address TEXT,
  token_address  TEXT        NOT NULL,
  token_symbol   TEXT,
  side           TEXT        NOT NULL CHECK (side IN ('buy', 'sell')),
  in_amount      TEXT        NOT NULL,
  out_amount     TEXT        NOT NULL,
  tx_signature   TEXT        NOT NULL UNIQUE,
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- NOTE: Production should replace this with a policy that validates the Privy JWT.
CREATE POLICY "allow all for anon key" ON trades
  FOR ALL USING (true) WITH CHECK (true);
