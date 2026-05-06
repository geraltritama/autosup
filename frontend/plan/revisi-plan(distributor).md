# Revisi Plan — Distributor-Specific Fixes

## Konteks

Audit dari perspektif **Distributor** — hub dalam supply chain:
**Supplier → Distributor → Retailer → Konsumen**

Distributor memiliki **dual role**:
- **Upstream (buyer):** Order ke supplier, bayar ke supplier
- **Downstream (seller):** Terima order dari retailer, terima pembayaran dari retailer

---

## Daftar Masalah

| # | Severity | Issue |
|---|----------|-------|
| D1 | CRITICAL | Orders page hanya tampilkan buyer-side orders — distributor tidak bisa lihat incoming order dari retailer |
| D2 | CRITICAL | Orders description hanya mention upstream (ke supplier) |
| D3 | HIGH | Dashboard tidak punya downstream (retailer) metrics |
| D4 | MEDIUM | Dashboard CTA tidak ada link ke Retailers |
| D5 | MEDIUM | Payment description hanya mention "invoice ke supplier" |
| D6 | MEDIUM | Orders KPI meta text tidak lengkap untuk distributor |
| D7 | LOW | Order card comment "Supplier: update..." misleading |

---

## Checklist

### D1 — CRITICAL: Orders page tab view untuk Distributor

**Masalah:** `isBuyer = role === "distributor" || role === "retailer"` → distributor hanya lihat buyer-side orders. Tidak bisa lihat incoming order dari retailer dimana dia seller.

**Solusi:** Tab view — "Outgoing → Supplier" (buyer) dan "Incoming ← Retailer" (seller). Retailer tetap single view (buyer only). Supplier tetap single view (seller only).

- [ ] **D1.1** `lib/mocks/orders.ts` — Tambahkan role-based filtering di `getMockOrders`

  Saat ini `getMockOrders` tidak filter berdasarkan buyer/seller role. Perlu ditambahkan:
  ```ts
  // Di dalam getMockOrders, tambahkan setelah status filter:
  const currentUser = useAuthStore.getState().user;
  if (params.role === "buyer" && currentUser) {
    orders = orders.filter((o) => o.buyer.role === currentUser.role);
  }
  if (params.role === "seller" && currentUser) {
    orders = orders.filter((o) => o.seller.role === currentUser.role);
  }
  ```

  Catatan: Perlu import `useAuthStore` di file ini.

- [ ] **D1.2** `app/dashboard/orders/page.tsx` — Tambahkan tab state dan role-based query untuk distributor

  Tambahkan state:
  ```tsx
  const [orderView, setOrderView] = useState<"outgoing" | "incoming">("outgoing");
  ```

  Tentukan role filter berdasarkan tab:
  ```tsx
  const orderRole = role === "distributor"
    ? (orderView === "outgoing" ? "buyer" : "seller")
    : (role === "retailer" ? "buyer" : "seller");
  ```

  Pass ke `useOrders`:
  ```tsx
  const { data, isLoading, isError, refetch } = useOrders({
    role: orderRole,
    status: statusFilter || undefined,
  });
  ```

  Tab UI hanya muncul untuk distributor:
  ```tsx
  {role === "distributor" && (
    <div className="flex gap-2 rounded-lg border border-[#E2E8F0] bg-slate-50 p-1">
      <button
        onClick={() => setOrderView("outgoing")}
        className={cn(
          "rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors",
          orderView === "outgoing"
            ? "bg-white text-[#0F172A] shadow-sm"
            : "text-[#64748B] hover:text-[#0F172A]"
        )}
      >
        Outgoing → Supplier
      </button>
      <button
        onClick={() => setOrderView("incoming")}
        className={cn(
          "rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors",
          orderView === "incoming"
            ? "bg-white text-[#0F172A] shadow-sm"
            : "text-[#64748B] hover:text-[#0F172A]"
        )}
      >
        Incoming ← Retailer
      </button>
    </div>
  )}
  ```

  "Create Order" button hanya muncul di tab outgoing (atau untuk retailer):
  ```tsx
  {(role === "retailer" || (role === "distributor" && orderView === "outgoing")) && (
    <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
      <Plus className="h-4 w-4" />
      Create Order
    </Button>
  )}
  ```

- [ ] **D1.3** `app/dashboard/orders/page.tsx` — Update header description 3-way role-aware

  ```tsx
  // Sebelum:
  {isBuyer
    ? role === "retailer"
      ? "Pantau semua order ke distributor partner dan buat order baru langsung dari sini."
      : "Pantau semua order ke supplier partner dan buat order baru langsung dari sini."
    : "Kelola incoming order dari partner dan perbarui status fulfillment."}

  // Sesudah:
  {role === "distributor"
    ? orderView === "outgoing"
      ? "Pantau order ke supplier dan buat order baru untuk restock inventory."
      : "Kelola incoming order dari retailer dan perbarui status fulfillment."
    : role === "retailer"
      ? "Pantau semua order ke distributor partner dan buat order baru langsung dari sini."
      : "Kelola incoming order dari partner dan perbarui status fulfillment."}
  ```

- [ ] **D1.4** `app/dashboard/orders/page.tsx` — Update KPI "Pending Orders" meta text

  ```tsx
  // Sebelum:
  meta={role === "retailer" ? "Waiting distributor response" : "Waiting supplier response"}

  // Sesudah:
  meta={role === "retailer"
    ? "Waiting distributor response"
    : role === "distributor" && orderView === "incoming"
      ? "Waiting your response"
      : "Waiting supplier response"}
  ```

---

### D3 — HIGH: Dashboard downstream metrics untuk Distributor

- [ ] **D3.1** `hooks/useDashboard.ts` — Tambahkan `retailers` field ke `DistributorSummaryData`

  ```ts
  // Sebelum:
  type DistributorSummaryData = {
    role: "distributor";
    inventory: { total_items: number; low_stock_count: number; out_of_stock_count: number };
    orders: { active_orders: number; pending_orders: number; completed_this_month: number };
    suppliers: { partner_count: number; pending_requests: number };
    ai_insights: AiInsight[];
  };

  // Sesudah:
  type DistributorSummaryData = {
    role: "distributor";
    inventory: { total_items: number; low_stock_count: number; out_of_stock_count: number };
    orders: { active_orders: number; pending_orders: number; completed_this_month: number };
    suppliers: { partner_count: number; pending_requests: number };
    retailers: { partner_count: number; pending_requests: number };
    ai_insights: AiInsight[];
  };
  ```

- [ ] **D3.2** `lib/mocks/dashboard.ts` — Tambahkan downstream mock data

  ```ts
  // Tambahkan ke mockDistributorSummary:
  retailers: { partner_count: 12, pending_requests: 2 },
  ```

- [ ] **D3.3** `app/dashboard/dashboard/page.tsx` — Update DistributorDashboard

  - Update `isEmpty` check: tambah `&& data.retailers.partner_count === 0`
  - Update header title: "Monitor inventory, orders, dan partner"
  - Update header description: "Pantau stok, kelola pesanan ke supplier dan dari retailer, dan ambil keputusan restock lebih cepat dengan AI."
  - Tambah KPI "Retailer partner" dan pindahkan "Selesai bulan ini" ke stats grid
  - Update stats grid dari 3-col jadi 4-col, tambah "Retailer partners" card dengan link ke `/dashboard/retailers`

- [ ] **D3.4** `app/dashboard/dashboard/page.tsx` — Tambah CTA "Kelola retailer"

  ```tsx
  // Sebelum:
  <Link href="/dashboard/suppliers">
    <Button variant="secondary">Cari supplier</Button>
  </Link>
  <Link href="/dashboard/orders">
    <Button>Buat order</Button>
  </Link>

  // Sesudah:
  <Link href="/dashboard/suppliers">
    <Button variant="secondary">Cari supplier</Button>
  </Link>
  <Link href="/dashboard/retailers">
    <Button variant="secondary">Kelola retailer</Button>
  </Link>
  <Link href="/dashboard/orders">
    <Button>Buat order</Button>
  </Link>
  ```

---

### D5 — MEDIUM: Payment description dual flow

- [ ] **D5.1** `app/dashboard/payment/page.tsx:80` — Update description

  ```tsx
  // Sebelum:
  Lacak invoice ke {role === "retailer" ? "distributor" : "supplier"}, manfaatkan fasilitas credit line, dan optimalkan pengeluaran dengan AI cash flow recommendation.

  // Sesudah:
  {role === "retailer"
    ? "Lacak invoice ke distributor, manfaatkan fasilitas credit line, dan optimalkan pengeluaran dengan AI cash flow recommendation."
    : "Lacak pembayaran masuk dari retailer dan keluar ke supplier, dan optimalkan cash flow dengan AI."}
  ```

---

### D7 — LOW: Order card comment fix

- [ ] **D7.1** `components/orders/order-card.tsx:128` — Update comment

  ```tsx
  // Sebelum:
  {/* Supplier: update ke status berikutnya */}
  // Sesudah:
  {/* Seller: update ke status berikutnya */}
  ```

---

## Implementasi Detail — D1 (Orders Tab View)

### Arsitektur

```
┌─────────────────────────────────────────────────────────┐
│  Orders                                                  │
│  Pantau order ke supplier dan dari retailer...           │
│                                                          │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ Outgoing → Supp. │  │ Incoming ← Ret. │  ← tab      │
│  └──────────────────┘  └──────────────────┘             │
│                                                          │
│  [+ Create Order]  ← hanya di tab Outgoing              │
│                                                          │
│  KPI Cards                                               │
│  ── Pending: "Waiting supplier response" / "Waiting your  │
│              response"                                    │
│                                                          │
│  Order Cards (filtered by tab)                           │
└─────────────────────────────────────────────────────────┘
```

### Mock Data Filtering

Untuk mock, filter berdasarkan `buyer.role` / `seller.role` match dengan `currentUser.role`:
- `role: "buyer"` → return orders dimana `buyer.role === currentUser.role`
- `role: "seller"` → return orders dimana `seller.role === currentUser.role`

### Catatan Penting

- **Summary KPI:** Untuk MVP, summary KPI tetap aggregate (tidak berubah per tab). Bisa di-refine nanti jika backend mendukung separate summaries.
- **Tab state:** Disimpan di local state `orderView`, default "outgoing".
- **React Query caching:** Kedua query (buyer & seller) di-cache terpisah oleh React Query, jadi switching tab tidak menyebabkan refetch jika data masih fresh.
- **Supplier & Retailer:** Tetap single view tanpa tab (supplier = seller only, retailer = buyer only). Hanya distributor yang punya dual view.

---

## Prioritas Eksekusi

| Batch | Item | Alasan |
|-------|------|--------|
| 1 | D1 (semua sub-item) | CRITICAL — distributor tidak bisa lihat incoming orders |
| 2 | D3 (semua sub-item) | HIGH — dashboard tidak punya downstream data |
| 3 | D5, D7 | MEDIUM/LOW — label dan comment fixes |

---

## Summary

| Item | Severity | File | Deskripsi |
|------|----------|------|-----------|
| D1.1 | CRITICAL | `lib/mocks/orders.ts` | Mock filtering by buyer/seller role |
| D1.2 | CRITICAL | `app/dashboard/orders/page.tsx` | Tab view (Outgoing/Incoming) untuk distributor |
| D1.3 | CRITICAL | `app/dashboard/orders/page.tsx` | Header description 3-way role-aware |
| D1.4 | CRITICAL | `app/dashboard/orders/page.tsx` | KPI meta text 3-way |
| D3.1 | HIGH | `hooks/useDashboard.ts` | Tambah `retailers` field ke type |
| D3.2 | HIGH | `lib/mocks/dashboard.ts` | Tambah downstream mock data |
| D3.3 | HIGH | `app/dashboard/dashboard/page.tsx` | DistributorDashboard: retailer KPI, stats, description |
| D3.4 | HIGH | `app/dashboard/dashboard/page.tsx` | CTA link ke retailers |
| D5.1 | MEDIUM | `app/dashboard/payment/page.tsx` | Description mention dual flow |
| D7.1 | LOW | `components/orders/order-card.tsx` | Comment "Supplier" → "Seller" |