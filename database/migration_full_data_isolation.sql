-- ============================================================
-- AUTOSUP — Full Data Isolation Migration
-- Run this in Supabase SQL Editor (all at once is fine)
-- Safe to re-run — all statements use IF NOT EXISTS
-- ============================================================

-- ============================================
-- 1. INVENTORIES
-- ============================================
ALTER TABLE inventories
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS price float8 DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_threshold int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'umum',
  ADD COLUMN IF NOT EXISTS unit text DEFAULT 'pcs';

CREATE INDEX IF NOT EXISTS idx_inventories_user_id ON inventories(user_id);

-- ============================================
-- 2. ORDERS
-- ============================================
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS seller_id text,
  ADD COLUMN IF NOT EXISTS buyer_id text,
  ADD COLUMN IF NOT EXISTS buyer_name text,
  ADD COLUMN IF NOT EXISTS buyer_role text DEFAULT 'distributor',
  ADD COLUMN IF NOT EXISTS seller_name text,
  ADD COLUMN IF NOT EXISTS seller_type text DEFAULT 'supplier',
  ADD COLUMN IF NOT EXISTS items jsonb,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS escrow_status text DEFAULT 'held',
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS shipping_info jsonb,
  ADD COLUMN IF NOT EXISTS total_price float8 DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);

-- ============================================
-- 3. PARTNERSHIPS
-- ============================================
ALTER TABLE partnerships
  ADD COLUMN IF NOT EXISTS distributor_id text,
  ADD COLUMN IF NOT EXISTS supplier_id text,
  ADD COLUMN IF NOT EXISTS distributor_name text,
  ADD COLUMN IF NOT EXISTS partnership_type text DEFAULT 'distributor_supplier';

CREATE INDEX IF NOT EXISTS idx_partnerships_distributor_id ON partnerships(distributor_id);
CREATE INDEX IF NOT EXISTS idx_partnerships_supplier_id ON partnerships(supplier_id);

UPDATE partnerships
SET supplier_id = supplier_name,
    distributor_name = retailer_name
WHERE supplier_id IS NULL AND supplier_name IS NOT NULL;

-- ============================================
-- 4. RETAILERS (create if not exists, then alter)
-- ============================================
CREATE TABLE IF NOT EXISTS retailers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text,
  contact_person text,
  phone text,
  city text,
  segment text DEFAULT 'reguler',
  status text DEFAULT 'active',
  monthly_order_volume int DEFAULT 0,
  total_purchase_amount float8 DEFAULT 0,
  last_order_at timestamptz,
  distributor_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE retailers
  ADD COLUMN IF NOT EXISTS distributor_id text;

CREATE INDEX IF NOT EXISTS idx_retailers_distributor_id ON retailers(distributor_id);

-- ============================================
-- 5. PAYMENTS (create if not exists, then alter)
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id text,
  counterpart_name text,
  amount float8 DEFAULT 0,
  type text DEFAULT 'payable',
  status text DEFAULT 'pending',
  payer_id text,
  payee_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payer_id text,
  ADD COLUMN IF NOT EXISTS payee_id text;

CREATE INDEX IF NOT EXISTS idx_payments_payer_id ON payments(payer_id);
CREATE INDEX IF NOT EXISTS idx_payments_payee_id ON payments(payee_id);

-- ============================================
-- 6. INVOICES (create if not exists, then alter)
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id text,
  seller_name text,
  amount float8 DEFAULT 0,
  status text DEFAULT 'pending',
  due_date timestamptz,
  buyer_id text,
  seller_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS buyer_id text,
  ADD COLUMN IF NOT EXISTS seller_id text;

CREATE INDEX IF NOT EXISTS idx_invoices_buyer_id ON invoices(buyer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_seller_id ON invoices(seller_id);

-- ============================================
-- 7. SHIPMENTS (create if not exists, then alter)
-- ============================================
CREATE TABLE IF NOT EXISTS shipments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id text,
  retailer_name text,
  destination text,
  status text DEFAULT 'in_transit',
  eta timestamptz,
  carrier text DEFAULT 'JNE',
  sender_id text,
  receiver_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS sender_id text,
  ADD COLUMN IF NOT EXISTS receiver_id text;

CREATE INDEX IF NOT EXISTS idx_shipments_sender_id ON shipments(sender_id);
CREATE INDEX IF NOT EXISTS idx_shipments_receiver_id ON shipments(receiver_id);

-- ============================================
-- 8. CREDIT_ACCOUNTS (create if not exists, then alter)
-- ============================================
CREATE TABLE IF NOT EXISTS credit_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  retailer_id text,
  retailer_name text,
  credit_limit float8 DEFAULT 0,
  utilized_amount float8 DEFAULT 0,
  status text DEFAULT 'active',
  risk_level text DEFAULT 'medium',
  distributor_id text,
  next_due_date timestamptz,
  next_due_amount float8 DEFAULT 0,
  opened_at timestamptz DEFAULT now()
);

ALTER TABLE credit_accounts
  ADD COLUMN IF NOT EXISTS distributor_id text;

CREATE INDEX IF NOT EXISTS idx_credit_accounts_distributor_id ON credit_accounts(distributor_id);

-- ============================================
-- 9. USERS (queryable public user list)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  role text,
  business_name text,
  phone text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================
-- DONE.
-- ============================================
