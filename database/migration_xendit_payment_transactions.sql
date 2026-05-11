-- ============================================================
-- AUTOSUP — Xendit Payment Transaction Persistence
-- Adds durable tables for checkout/webhook flow:
-- 1) payment_transactions
-- 2) payment_webhook_events
-- Safe to re-run.
-- ============================================================

-- 1) Payment transactions (one row per invoice/payment intent lifecycle)
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text,
  invoice_id text,
  payer_id text,
  payee_id text,
  amount float8 DEFAULT 0,
  currency text DEFAULT 'IDR',
  payment_method text,
  gateway text DEFAULT 'xendit',
  external_id text UNIQUE,
  xendit_invoice_id text UNIQUE,
  invoice_url text,
  status text DEFAULT 'PENDING',
  raw_response jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_invoice_id ON payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payer_id ON payment_transactions(payer_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payee_id ON payment_transactions(payee_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_external_id ON payment_transactions(external_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_xendit_invoice_id ON payment_transactions(xendit_invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at DESC);

-- 2) Webhook event log (idempotency + audit trail)
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  gateway text DEFAULT 'xendit',
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_event_id ON payment_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_gateway ON payment_webhook_events(gateway);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_created_at ON payment_webhook_events(created_at DESC);

-- 3) RLS
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see their payment transactions" ON payment_transactions;
CREATE POLICY "Users see their payment transactions" ON payment_transactions
  FOR SELECT USING (
    auth.uid()::text = payer_id
    OR auth.uid()::text = payee_id
  );

DROP POLICY IF EXISTS "Service role manages payment transactions" ON payment_transactions;
CREATE POLICY "Service role manages payment transactions" ON payment_transactions
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages payment webhook events" ON payment_webhook_events;
CREATE POLICY "Service role manages payment webhook events" ON payment_webhook_events
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

