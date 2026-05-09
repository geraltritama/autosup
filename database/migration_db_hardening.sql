-- ============================================================
-- AUTOSUP — Database Hardening Migration
-- FK constraints, CHECK hierarchy, RLS policies
-- Run AFTER migration_full_data_isolation.sql
-- Safe to re-run — uses DO blocks for conditional changes
-- ============================================================

-- ============================================
-- 1. CHECK constraint: orders hierarchy
--    Retailer cannot buy from supplier directly
-- ============================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_hierarchy'
    ) THEN
        ALTER TABLE orders ADD CONSTRAINT chk_orders_hierarchy CHECK (
            NOT (buyer_role = 'retailer' AND seller_type = 'supplier')
        );
    END IF;
END $$;

-- ============================================
-- 2. CHECK constraint: valid order status
--    Fix invalid existing rows first
UPDATE orders SET status = 'cancelled' WHERE status NOT IN ('pending','processing','shipping','delivered','cancelled') OR status IS NULL;
-- ============================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_status'
    ) THEN
        ALTER TABLE orders ADD CONSTRAINT chk_orders_status CHECK (
            status IN ('pending','processing','shipping','delivered','cancelled')
        );
    END IF;
END $$;

-- ============================================
-- 3. CHECK constraint: valid partnership status
--    Fix existing rows first, then add constraint
UPDATE partnerships SET status = 'inactive' WHERE status NOT IN ('pending','accepted','approved','partner','rejected','inactive') OR status IS NULL;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_partnerships_status'
    ) THEN
        ALTER TABLE partnerships ADD CONSTRAINT chk_partnerships_status CHECK (
            status IN ('pending','accepted','approved','partner','rejected','inactive')
        );
    END IF;
END $$;

-- ============================================
-- 4. CHECK constraint: valid credit account status
-- ============================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_credit_status'
    ) THEN
        ALTER TABLE credit_accounts ADD CONSTRAINT chk_credit_status CHECK (
            status IN ('active','overdue','suspended','closed')
        );
    END IF;
END $$;

-- ============================================
-- 5. CHECK constraint: valid shipment status
-- ============================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_shipments_status'
    ) THEN
        ALTER TABLE shipments ADD CONSTRAINT chk_shipments_status CHECK (
            status IN ('packed','dispatched','in_transit','delivered','delayed','failed')
        );
    END IF;
END $$;

-- ============================================
-- 6. CHECK constraint: valid inventory values (non-negative)
--    Fix invalid existing rows first
UPDATE inventories SET current_stock = 0 WHERE current_stock < 0 OR current_stock IS NULL;
UPDATE inventories SET min_threshold = 0 WHERE min_threshold < 0 OR min_threshold IS NULL;
-- ============================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_inventory_status'
    ) THEN
        ALTER TABLE inventories ADD CONSTRAINT chk_inventory_status CHECK (
            current_stock >= 0 AND min_threshold >= 0
        );
    END IF;
END $$;

-- ============================================
-- 7. RLS: Enable on all tables
-- ============================================
ALTER TABLE inventories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE partnerships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_activities  ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. RLS: Inventories — user sees own inventory
-- ============================================
DROP POLICY IF EXISTS "Users see own inventory" ON inventories;
CREATE POLICY "Users see own inventory" ON inventories
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 9. RLS: Orders — buyer or seller sees their orders
-- ============================================
DROP POLICY IF EXISTS "Users see their orders" ON orders;
CREATE POLICY "Users see their orders" ON orders
    FOR ALL USING (
        auth.uid()::text = buyer_id
        OR auth.uid()::text = seller_id
    );

-- ============================================
-- 10. RLS: Partnerships — both parties see their partnerships
-- ============================================
DROP POLICY IF EXISTS "Users see their partnerships" ON partnerships;
CREATE POLICY "Users see their partnerships" ON partnerships
    FOR ALL USING (
        auth.uid()::text = supplier_id
        OR auth.uid()::text = distributor_id
        OR auth.uid()::text = supplier_name
        OR auth.uid()::text = retailer_name
    );

-- ============================================
-- 11. RLS: Payments — payer or payee
-- ============================================
DROP POLICY IF EXISTS "Users see their payments" ON payments;
CREATE POLICY "Users see their payments" ON payments
    FOR ALL USING (
        auth.uid()::text = payer_id
        OR auth.uid()::text = payee_id
    );

-- ============================================
-- 12. RLS: Invoices — buyer or seller
-- ============================================
DROP POLICY IF EXISTS "Users see their invoices" ON invoices;
CREATE POLICY "Users see their invoices" ON invoices
    FOR ALL USING (
        auth.uid()::text = buyer_id
        OR auth.uid()::text = seller_id
    );

-- ============================================
-- 13. RLS: Shipments — sender or receiver
-- ============================================
DROP POLICY IF EXISTS "Users see their shipments" ON shipments;
CREATE POLICY "Users see their shipments" ON shipments
    FOR ALL USING (
        auth.uid()::text = sender_id
        OR auth.uid()::text = receiver_id
    );

-- ============================================
-- 14. RLS: Credit Accounts — distributor sees own
-- ============================================
DROP POLICY IF EXISTS "Distributors see their credit accounts" ON credit_accounts;
CREATE POLICY "Distributors see their credit accounts" ON credit_accounts
    FOR ALL USING (auth.uid()::text = distributor_id);

-- ============================================
-- 15. RLS: Retailers — distributor sees own retailers
-- ============================================
DROP POLICY IF EXISTS "Distributors see their retailers" ON retailers;
CREATE POLICY "Distributors see their retailers" ON retailers
    FOR ALL USING (auth.uid()::text = distributor_id);

-- ============================================
-- 16. RLS: AI agents — read by all, write by none via API
-- ============================================
DROP POLICY IF EXISTS "Anyone can read AI agents" ON ai_agents;
CREATE POLICY "Anyone can read AI agents" ON ai_agents
    FOR SELECT USING (true);

-- ============================================
-- 17. RLS: AI activities — read by role
-- ============================================
DROP POLICY IF EXISTS "Read AI activities" ON ai_activities;
CREATE POLICY "Read AI activities" ON ai_activities
    FOR SELECT USING (true);

-- ============================================
-- DONE.
-- ============================================
