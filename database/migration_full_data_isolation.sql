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
-- 10. AI_AGENTS (create if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_agents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_key text NOT NULL,
  name text NOT NULL,
  description text,
  status text DEFAULT 'active',
  automation_level text DEFAULT 'manual_approval',
  recent_action text,
  last_active timestamptz DEFAULT now(),
  agent_role text DEFAULT 'all',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS agent_role text DEFAULT 'all';

-- ============================================
-- 11. AI_ACTIVITIES (create if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_activities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name text,
  action text,
  impact text,
  full_result text,
  timestamp timestamptz DEFAULT now(),
  activity_role text DEFAULT 'all',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_activities ADD COLUMN IF NOT EXISTS activity_role text DEFAULT 'all';
ALTER TABLE ai_activities ADD COLUMN IF NOT EXISTS full_result text;

-- Clear old seed data and re-seed with role-specific agents
DELETE FROM ai_agents WHERE id IN (
  '00000001-0001-0001-0001-000000000001',
  '00000001-0001-0001-0001-000000000002',
  '00000001-0001-0001-0001-000000000003',
  '00000001-0001-0001-0001-000000000004',
  '00000001-0001-0001-0001-000000000005',
  '00000001-0001-0001-0001-000000000006',
  '00000001-0001-0001-0001-000000000007',
  '00000001-0001-0001-0001-000000000008',
  '00000001-0001-0001-0001-000000000009',
  '00000001-0001-0001-0001-000000000010',
  '00000001-0001-0001-0001-000000000011'
);

INSERT INTO ai_agents (id, agent_key, name, description, status, automation_level, recent_action, last_active, agent_role) VALUES
  -- Supplier agents (3)
  ('00000001-0001-0001-0001-000000000001', 'demand_forecast', 'Demand Forecast', 'Analyzes distributor demand for production optimization.', 'active', 'manual_approval', 'Analyzed 30-day demand trends.', now() - interval '5 minutes', 'supplier'),
  ('00000001-0001-0001-0001-000000000002', 'logistics_optimization', 'Logistics Optimization', 'Optimizes delivery routes to distributors.', 'active', 'auto_with_threshold', 'Routes optimized, 15% savings.', now() - interval '1 hour', 'supplier'),
  ('00000001-0001-0001-0001-000000000003', 'price_optimization', 'Price Optimization', 'Optimizes pricing based on supply-demand.', 'active', 'manual_approval', 'Pricing analysis for 5 products.', now() - interval '1 day', 'supplier'),
  -- Distributor agents (4)
  ('00000001-0001-0001-0001-000000000004', 'auto_restock', 'Auto Restock', 'Stock monitoring and restock recommendations from supplier.', 'active', 'auto_with_threshold', '2 products below minimum.', now() - interval '10 minutes', 'distributor'),
  ('00000001-0001-0001-0001-000000000005', 'credit_risk', 'Credit Risk Analyzer', 'Analyzes retailer credit risk.', 'active', 'manual_approval', 'Evaluation of 5 retailers completed.', now() - interval '20 minutes', 'distributor'),
  ('00000001-0001-0001-0001-000000000006', 'supplier_recommendation', 'Supplier Recommendation', 'Alternative supplier recommendations and partnership analysis.', 'active', 'manual_approval', '3 potential suppliers identified.', now() - interval '30 minutes', 'distributor'),
  ('00000001-0001-0001-0001-000000000007', 'cash_flow_optimizer', 'Cash Flow Optimizer', 'Optimizes payment and billing schedules.', 'active', 'auto_with_threshold', '3 payments rescheduled.', now() - interval '15 minutes', 'distributor'),
  -- Retailer agents (3)
  ('00000001-0001-0001-0001-000000000008', 'retailer_reorder', 'Smart Reorder', 'Retail stock monitoring and reorder recommendations from distributor.', 'active', 'auto_with_threshold', 'Awaiting activation.', now() - interval '1 minute', 'retailer'),
  ('00000001-0001-0001-0001-000000000009', 'retailer_sales_trend', 'Sales Trend Analyzer', 'Sales trend and consumer demand pattern analysis.', 'active', 'manual_approval', 'Awaiting activation.', now() - interval '1 minute', 'retailer'),
  ('00000001-0001-0001-0001-000000000010', 'retailer_demand_insight', 'Demand Insight', 'Predicts consumer demand 7-14 days ahead.', 'active', 'manual_approval', 'Awaiting activation.', now() - interval '1 minute', 'retailer');

-- Clear and re-seed activities (role-specific)
DELETE FROM ai_activities WHERE id IN (
  '00000001-0002-0001-0001-000000000001',
  '00000001-0002-0001-0001-000000000002',
  '00000001-0002-0001-0001-000000000003',
  '00000001-0002-0001-0001-000000000004',
  '00000001-0002-0001-0001-000000000005',
  '00000001-0002-0001-0001-000000000006',
  '00000001-0002-0001-0001-000000000007',
  '00000001-0002-0001-0001-000000000008'
);

INSERT INTO ai_activities (id, agent_name, action, impact, timestamp, activity_role) VALUES
  ('00000001-0002-0001-0001-000000000001', 'Demand Forecast', 'Predicted Arabica Coffee demand increase of 12%.', 'Stock optimization to prevent shortage.', now() - interval '10 minutes', 'supplier'),
  ('00000001-0002-0001-0001-000000000002', 'Logistics Optimization', 'Route to Distributor A optimized.', 'Estimated delivery cost savings of Rp450,000.', now() - interval '45 minutes', 'supplier'),
  ('00000001-0002-0001-0001-000000000003', 'Price Optimization', 'Analyzed pricing of 5 products against market rate.', 'Recommendation: increase Sugar price by 3%.', now() - interval '2 hours', 'supplier'),
  ('00000001-0002-0001-0001-000000000004', 'Auto Restock', 'Detected Sugar reaching minimum stock level.', 'Auto-generated purchase order to supplier.', now() - interval '5 minutes', 'distributor'),
  ('00000001-0002-0001-0001-000000000005', 'Credit Risk Analyzer', 'Retailer Toko ABC showing declining payment performance.', 'Recommendation: temporarily reduce credit limit.', now() - interval '30 minutes', 'distributor'),
  ('00000001-0002-0001-0001-000000000006', 'Supplier Recommendation', 'Identified 3 alternative suppliers for raw materials.', 'Potential savings of 8% from new suppliers.', now() - interval '1 hour', 'distributor'),
  ('00000001-0002-0001-0001-000000000007', 'Cash Flow Optimizer', 'Suggested delaying inv-002 payment to supplier.', 'Maintaining positive cash flow of Rp5,200,000.', now() - interval '20 minutes', 'distributor'),
  ('00000001-0002-0001-0001-000000000008', 'Demand Forecast', 'Predicted 15% demand increase for Beverage category.', 'Recommendation: increase stock by 200 units.', now() - interval '50 minutes', 'distributor');

-- ============================================
-- DONE.
-- ============================================
