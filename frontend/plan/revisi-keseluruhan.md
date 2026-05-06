# AUTOSUP Supply Chain — Comprehensive Audit & Revision Plan

> **Generated:** 2026-05-05  
> **Scope:** Full audit of all `plan/` documents vs implementation code  
> **Hierarchy enforced:** Supplier → Distributor → Retailer → Consumer (strict, no bypass)

---

## 1. Critical Issues (Must Fix)

### C1 — API Contract Contradicts Strict Hierarchy (Retailer → Supplier Bypass)

**Description:**  
`api-contract.md:59` states retailer can buy "langsung supplier" (directly from supplier).  
`api-contract.md:685` states "v2.0+ bisa beli langsung dari supplier".  
`revisi-plan(retail).md:387-389` sets **MVP constraint: Retailer only buys from distributor**.  
`PRD.md:631-633` says "distributor partner (atau supplier langsung)" — contradicts constraint.

**Impact:** If BE implements retailer→supplier direct ordering, it violates strict 3-tier hierarchy. FE developers have conflicting rules — ambiguity creates implementation risk.

**Location:**
- `plan/api-contract.md:59,685`
- `plan/revisi-plan(retail).md:387-389`
- `plan/PRD.md:631-633`

**Fix:**
- [x] `api-contract.md:57,59` — Remove "(atau langsung supplier)" for MVP scope ✅ 2026-05-05
- [x] `api-contract.md:685` — Changed to `retailer sebagai buyer → seller = distributor (MVP strict)` ✅ 2026-05-05
- [x] `PRD.md §3C.3` — Removed "(atau supplier langsung)" from lines 631, 634 ✅ 2026-05-05
- [ ] BE middleware — Reject `POST /orders` where `buyer.role=retailer` AND `seller.role=supplier`

```python
# BE enforcement example
if buyer.role == "retailer" and seller.role == "supplier":
    raise HTTPException(403, "Retailer must order through distributor")
```

---

### C2 — `POST /orders` Request Body Uses `supplier_id` Instead of Generic `seller_id`

**Description:**  
API contract §5 `POST /orders` request body specifies `supplier_id` field.  
FE already migrated to `seller_id` + `seller_type` per `revisi-plan(retail).md`.  
This is a direct FE/BE contract mismatch.

**Impact:** When BE implements per api-contract → expects `supplier_id`. FE sends `seller_id`. Integration breaks at first real API call.

**Location:** `plan/api-contract.md:763` (request body shows `supplier_id`)

**Fix:**
- [x] Update `api-contract.md POST /orders` request body to `seller_id` + `seller_type` ✅ 2026-05-05
- [x] `seller_type` enum: `"supplier" | "distributor"` documented ✅ 2026-05-05
- [ ] Notify BE to update endpoint implementation accordingly

---

### C3 — Partnership Page Blocks Supplier (`revisi-plan(supplier-partnership).md` NOT Implemented)

**Description:**  
`revisi-plan(supplier-partnership).md` items S1-S4 are all unchecked `[ ]`.  
Supplier cannot access the partnerships page to see distributor partners who buy from them.  
Code shows `isSupplier` logic exists in loading/error/refetch resolution (lines 162, 168, 175) but rendering section needs verification.

**Impact:** Supplier has no visibility into partnership trust layer. Breaks the intended 3-way partnership view (supplier ↔ distributor ↔ retailer).

**Location:** `app/dashboard/partnerships/page.tsx`

**Fix (from `revisi-plan(supplier-partnership).md`):**

- [x] **S1.1** — Supplier access: verified in code, full supplier render section exists ✅ (lines 349-370)
- [x] **S2.1** — Supplier header description: present ✅
- [x] **S2.3** — Render section: supplier sees distributor partner cards ✅
- [x] **S2.4** — Empty state for supplier ✅
- [x] **S3.1** — Side panel: supplier handled ✅
- [x] **S4.1** — KPI label: 3-role aware ✅
- [x] **S4.2** — Empty text: role-aware ✅

---

## 2. Warnings (Should Fix)

### W1 — `revisi-plan(partnership).md` P5.1–P5.7 NOT Implemented (Distributor Dual Tab)

**Description:**  
Partnership page for distributor needs "Suppliers | Retailers" tab view.  
Items P5.1–P5.7 all unchecked. Code shows `partnerView` state and conditional rendering already exists (lines 123, 155–195).

**Impact:** Without tab UI rendered, distributor cannot see retailer partners in the partnership context. Credit line decisions depend on partnership visibility.

**Location:** `app/dashboard/partnerships/page.tsx`

**Status:** Likely partially implemented — code has `partnerView` state + conditional rendering. Plan checklist is stale. Verify in browser.

**Fix (from `revisi-plan(partnership).md`):**

- [x] **P5.1** — `partnerView` state + `useRetailers({ type: "partner" })` wired ✅
- [x] **P5.2** — Tab UI (Supplier Partners / Retailer Partners) renders for distributor ✅
- [x] **P5.3** — Main content renders per tab selection ✅
- [x] **P5.4** — Side panel switches: retailers tab → `DistributorTrustPanel` ✅
- [x] **P5.5** — Header description: both directions mentioned ✅
- [x] **P5.6** — KPI label per tab ✅
- [x] **P5.7** — Empty state text per tab ✅

---

### W2 — `revisi-plan(supplier).md` S1–S4 All Unchecked (Partially Implemented)

**Description:**  
4 supplier-specific fix items not marked done. Code verification shows mixed status:

| Item | Status | Notes |
|------|--------|-------|
| S1 — Restock returns `null` for supplier | ✅ DONE | `useInventory.ts:174-191` 3-way logic implemented |
| S2 — Analytics KPI label 3-way | ❓ Verify | `analytics/page.tsx:95-97` |
| S3 — `canUpdateStatus` Op B (seller-specific) | ✅ DONE | `order-card.tsx:56` uses `order.seller.role === userRole` |
| S4 — Analytics description 3-way | ❓ Verify | `analytics/page.tsx:64` |

**Fix:**
- [x] **S2.1** — `RetailerAnalytics` KPI label fixed: "Distributor Perf." + "Indeks kinerja distributor" ✅ 2026-05-05
- [ ] **S4.1** — Verify `analytics/page.tsx` description uses 3-way role-aware text

---

### W3 — `revisi-plan-shipping.md` O1–O3 All Unchecked (Partially Implemented)

**Description:**  
Shipping flow revisions: remove manual "Mark as [status]" button, add "Kirim" button with tracking dialog, add "Terima Barang" for buyer.  
Code shows `isSeller && order.status === "processing"` "Kirim" button exists (`order-card.tsx:136`).

**Impact:** If old generic "Mark as [status]" button still coexists with new "Kirim" button → duplicate UX, confusing flow.

**Location:** `components/orders/order-card.tsx`, `app/dashboard/orders/page.tsx`

**Fix:**
- [x] **O1.1** — "Mark as [nextStatus]" button REMOVED — only `isSeller && status==="processing"` Kirim button exists ✅
- [ ] **O2.1–O2.6** — Verify `OrderStatusUpdateDialog` imported and tracking state wired in `orders/page.tsx`
- [ ] **O3.1–O3.3** — Verify "Terima Barang" button exists in Order Detail Dialog for buyer when `status === "shipped"`

---

### W4 — Mock Order 007–008 Buyer ID Inconsistent

**Description:**  
Orders 007 and 008 use `id: "user-uuid-ret-001"` for retailer buyer.  
`revisi-plan(mock-data-dari-supplier).md` M3.1 says change to `retailer-uuid-001`.  
Plan is unchecked, IDs not updated.

**Impact:** Inconsistent retailer IDs between orders mock and retailers mock (`useRetailers` uses `retailer-uuid-001`). Data joins fail when BE enforces ID matching.

**Location:** `lib/mocks/orders.ts:159,178`

**Fix:**
- [x] **M3.1** — `order-uuid-007` buyer fixed: `{ id: "retailer-uuid-001", name: "Toko Sumber Rejeki", role: "retailer" }` ✅ 2026-05-05
- [x] **M3.2** — `order-uuid-008` buyer fixed: `{ id: "retailer-uuid-002", name: "Warung Bu Tini", role: "retailer" }` ✅ 2026-05-05

---

### W5 — `CONTEXT.md` Stale — Says "2 Login Roles" Not 3

**Description:**  
`plan/CONTEXT.md:15` says "Dua role login" and lists only distributor/supplier.  
States "Retailer & logistics partner = entitas yang dikelola distributor, bukan role login."  
Retailer IS a full login role since v3.0.

**Impact:** New contributors read CONTEXT.md first → wrong mental model from the start.

**Location:** `plan/CONTEXT.md:14-18`, Section 7 `UserRole` type

**Fix:**
- [x] Update CONTEXT.md Section 1: "Tiga role login" (supplier, distributor, retailer) ✅ 2026-05-05
- [x] Removed stale "Retailer = entitas dikelola distributor" statement ✅ 2026-05-05
- [x] Update Section 7 `UserRole` type to `"supplier" | "distributor" | "retailer"` ✅ 2026-05-05
- [x] Update Section 9 Gap List: stale items removed, completed hooks marked ✅ 2026-05-05

---

### W6 — `revisi-plan(mock-data-dari-supplier).md` M5 Order Detail Role Display

**Description:**  
Plan M5.1 suggests showing `(${role})` suffix in order detail dialog description for clearer debugging.  
Status: unchecked, not implemented.

**Impact:** Low — cosmetic. Useful for dev debugging role-based data.

**Fix:**
- [x] **M5.1** — Detail dialog description with role already implemented ✅ (`orders/page.tsx:253`)

---

## 3. Improvement Suggestions

### I1 — Enforce Hierarchy at BE Middleware Level

FE enforces via `seller_type` in `CreateOrderPayload`. Real enforcement must be server-side:

```python
# Validate supply chain hierarchy on every order creation
ALLOWED_FLOWS = {
    ("distributor", "supplier"),   # Distributor buys from Supplier
    ("retailer", "distributor"),   # Retailer buys from Distributor
}

def validate_order_flow(buyer_role: str, seller_role: str):
    if (buyer_role, seller_role) not in ALLOWED_FLOWS:
        raise HTTPException(
            status_code=403,
            detail=f"Invalid order flow: {buyer_role} cannot order from {seller_role}"
        )
```

---

### I2 — Consolidate Plan Checklist Status

Multiple plan files have items marked `[x]` (done) that were implemented, but newer revision plans (`revisi-plan(supplier-partnership)`, `revisi-plan-shipping`, parts of `revisi-plan(partnership)`) remain unchecked despite partial implementation in code.

**Recommendation:**
- Create single `PROGRESS.md` tracking file OR use git issues
- Cross-reference code state vs plan state before starting new work
- Mark all verified-done items as `[x]` with verification date

---

### I3 — Type Safety for Order Flow Direction

Current `CreateOrderPayload.seller_type` is `"supplier" | "distributor"`. Add compile-time guard to prevent invalid combinations:

```typescript
// In hooks/useOrders.ts
type DistributorOrderPayload = {
  buyerRole: "distributor";
  seller_id: string;
  seller_type: "supplier";  // Distributor can only order from supplier
};

type RetailerOrderPayload = {
  buyerRole: "retailer";
  seller_id: string;
  seller_type: "distributor";  // Retailer can only order from distributor
};

type CreateOrderPayload = DistributorOrderPayload | RetailerOrderPayload;
```

---

### I4 — Partnership NFT Endpoint Naming Inconsistency

API contract uses `/blockchain/partnership-nft/{distributor_id}/{supplier_id}` — only works for distributor↔supplier partnerships.  
For retailer↔distributor partnerships, **no endpoint defined** in api-contract.  
FE mock `useRetailerPartnershipNFT` uses invented path `/blockchain/partnership-nft/distributor/{userId}/{retailerId}` — not in api-contract.

**Fix:**
- [ ] Add generic endpoint to api-contract:
```
GET /blockchain/partnership-nft/{party_a_id}/{party_b_id}
```
BE resolves relationship type from IDs. Returns union type covering both partnership directions.

---

### I5 — `revisi-plan(partnership).md` P6.1 Not Implemented (Distributor Insights 3-way)

**Description:**  
`usePartnerships.ts` mock insights for distributor should include both supplier AND retailer insights. P6.1 unchecked.

**Fix:**
- [ ] **P6.1** — `hooks/usePartnerships.ts` — Update mock insights to 3-way:
  - Retailer insights: distributor-related
  - Distributor insights: both supplier-related AND retailer-related
  - Supplier insights: distributor-related

---

## 4. Execution Priority

| Priority | Item | Reason |
|----------|------|--------|
| 🔴 P0 | C1 — Lock retailer→supplier direct order | Hierarchy violation |
| 🔴 P0 | C2 — Fix api-contract `supplier_id` → `seller_id` | Integration breaks at first real API call |
| 🔴 P0 | C3 — Partnership page supplier access | Supplier blocked from seeing partners |
| 🟠 P1 | W4 — Fix mock order 007-008 buyer IDs | Data integrity |
| 🟠 P1 | W3 — Verify shipping flow UX (duplicate buttons) | UX correctness |
| 🟡 P2 | W1 — Distributor dual-tab partnerships | Feature completeness |
| 🟡 P2 | W2 — S2/S4 analytics label 3-way | Label correctness |
| 🟡 P2 | W5 — Update CONTEXT.md | Documentation integrity |
| 🟢 P3 | I1 — BE middleware enforcement | Defense in depth |
| 🟢 P3 | I3 — TypeScript order flow type safety | Developer experience |
| 🟢 P3 | I4 — Generic partnership NFT endpoint | API consistency |
| 🟢 P3 | I5 — P6.1 distributor insights 3-way | Data completeness |
| ⚪ P4 | W6 — M5 order detail role display | Cosmetic / dev-only |

---

## 5. Overall Assessment

**Is the system aligned with the intended Supplier → Distributor → Retailer flow?**

### ✅ YES — Implementation (Code) is Correct

| Check | Status | Evidence |
|-------|--------|---------|
| Order form fetches distributors for retailer | ✅ | `order-form-dialog.tsx` — `useDistributors` for retailer |
| Order form fetches suppliers for distributor | ✅ | `order-form-dialog.tsx` — `useSuppliers` for distributor |
| `canUpdateStatus` checks seller role match | ✅ | `order-card.tsx:56` — `order.seller.role === userRole` |
| Restock recommendation returns `null` for supplier | ✅ | `useInventory.ts:191` — `role === "supplier" ? null` |
| Mock data reflects correct hierarchy | ✅ | `lib/mocks/orders.ts` — dist→supplier, retailer→distributor |
| Sidebar navigates retailer to `/dashboard/distributors` | ✅ | `dashboard-shell.tsx` |
| No retailer→supplier orders in mock data | ✅ | All retailer orders have `seller.role: "distributor"` |

### ❌ NO — API Contract and Documentation are NOT Correct

| Problem | Location | Risk |
|---------|----------|------|
| `POST /orders` uses `supplier_id` not `seller_id` | `api-contract.md:763` | Integration break |
| Retailer→supplier bypass still mentioned as future feature | `api-contract.md:59,685` | Hierarchy ambiguity |
| CONTEXT.md says 2 login roles not 3 | `CONTEXT.md:15` | Wrong mental model for contributors |
| Partnership page supplier access not confirmed | `partnerships/page.tsx` | Supplier locked out |

### RBAC Verdict
Role gating enforced via `useAuthStore.user.role`. Sidebar visibility, order form seller selection, dashboard data all role-aware for 3 roles. No privilege escalation paths found in FE. BE enforcement not auditable from FE code alone — must be independently verified.

### Data Isolation Verdict
Each role sees own data via `?role=buyer|seller` filter + auth context. Retailer CRM (`/retailers/*`) scoped to distributor only. No cross-role data leakage in mock layer. Partnership NFT queries scoped by user ID. Credit line management (`/credit/*`) distributor-only — no retailer write access.

---

## 6. Files Requiring Changes

| File | Change Type | Priority |
|------|-------------|----------|
| `plan/api-contract.md` | Update `POST /orders` body, lock retailer hierarchy | 🔴 P0 |
| `plan/PRD.md §3C.3` | Remove "(atau supplier langsung)" | 🔴 P0 |
| `app/dashboard/partnerships/page.tsx` | Supplier render section | 🔴 P0 |
| `lib/mocks/orders.ts:159,178` | Fix buyer IDs for orders 007-008 | 🟠 P1 |
| `components/orders/order-card.tsx` | Verify/remove old "Mark as" button | 🟠 P1 |
| `app/dashboard/orders/page.tsx` | Verify tracking dialog + "Terima Barang" | 🟠 P1 |
| `app/dashboard/analytics/page.tsx:95-97,64` | 3-way role-aware labels | 🟡 P2 |
| `plan/CONTEXT.md` | Update role count, gap list | 🟡 P2 |
| `hooks/usePartnerships.ts` | P6.1 distributor insights 3-way | 🟢 P3 |
| `plan/api-contract.md` (blockchain section) | Add generic partnership-nft endpoint | 🟢 P3 |
