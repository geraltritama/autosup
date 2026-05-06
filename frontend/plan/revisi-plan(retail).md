# Revisi Plan — Supply Chain Flow Fix

## Masalah Utama

Flow saat ini salah: Retailer berinteraksi langsung dengan Supplier.  
Flow yang benar: **Supplier → Distributor → Retailer → Konsumen**

Retailer **hanya** boleh berinteraksi dengan Distributor, bukan Supplier.

---

## Batch Eksekusi

### Batch 1 — Data Model & Hooks (Step 1)
Fondasi — semua perubahan UI bergantung pada ini.

### Batch 2 — Halaman Distributor untuk Retailer + Navigation Fix (Step 2 + 3)
Harus bareng — kalau navigasi sudah diubah tapi halaman belum ada = 404.

### Batch 3 — Order Form Role-Aware (Step 4)
Setelah seller type model benar.

### Batch 4 — Partnerships Page Role-Aware (Step 5)
Setelah distributor hook ada.

### Batch 5 — Dashboard, Payment, Analytics, Inventory Labels (Step 6)
Quick fixes — konsistensi UX.

### Batch 6 — Mock Data Update (Step 7)
Data mendukung flow baru.

### Batch 7 — Residual Fix (HIGH/MEDIUM/LOW)
Fix issue tersisa setelah Batch 1-6.

---

## Checklist

### Step 1 — Data Model & Hooks

- [x] **1.1** `hooks/useOrders.ts` — Ubah `OrderParty.role` dari `"distributor" | "supplier"` menjadi `"supplier" | "distributor" | "retailer"`
  - File: `hooks/useOrders.ts` baris 18
  - Ubah: `role: "distributor" | "supplier"` → `role: "supplier" | "distributor" | "retailer"`

- [x] **1.2** `hooks/useOrders.ts` — Ubah `CreateOrderPayload.supplier_id` menjadi `seller_id` + `seller_type`
  - File: `hooks/useOrders.ts` baris 66-76
  - Ubah: `supplier_id: string` → `seller_id: string; seller_type: "supplier" | "distributor"`
  - Update semua referensi `payload.supplier_id` di `useCreateOrder` (baris 155)

- [x] **1.3** `hooks/useOrders.ts` — Update `useCreateOrder` mock
  - File: `hooks/useOrders.ts` baris 136-187
  - `buyer.role`: gunakan `user?.role` langsung (bukan cast ke `"distributor" | "supplier"`)
  - `seller.role`: sesuai `payload.seller_type`
  - `seller.name`: lookup dari seller data (bukan hardcoded "Supplier")
  - Tambah mock order retailer→distributor di `lib/mocks/orders.ts`

- [x] **1.4** `hooks/useDashboard.ts` — Ubah `RetailerSummaryData.suppliers` menjadi `distributors`
  - File: `hooks/useDashboard.ts` baris 52-57
  - Ubah field name `suppliers` → `distributors` dengan struktur yang sama

- [x] **1.5** `hooks/useInventory.ts` — Ubah `RestockRecommendation.suggested_supplier` menjadi `suggested_seller` yang role-aware
  - File: `hooks/useInventory.ts` baris 42-58
  - Ubah `suggested_supplier` menjadi:
    ```ts
    suggested_seller: {
      seller_id: string;
      name: string;
      seller_type: "supplier" | "distributor";
      reputation_score: number;
      estimated_delivery_days: number;
    } | null;
    ```
  - Update mock restock recommendation di baris 180-185

- [x] **1.6** `hooks/usePartnerships.ts` — Tambah model `DistributorPartnershipNFT` (Opsi B: dua model terpisah)
  - File: `hooks/usePartnerships.ts`
  - Pertahankan `PartnershipNFT` yang ada (distributor↔supplier), rename menjadi `SupplierPartnershipNFT`
  - Tambah `DistributorPartnershipNFT` baru (retailer↔distributor):
    ```ts
    export type DistributorPartnershipNFT = {
      retailer_id: string;
      distributor_id: string;
      mint_address: string;
      explorer_url: string;
      token_name: string;
      issued_at: string;
    };
    ```
  - Tambah `useDistributorPartnershipNFT(distributorId)` hook
  - Update `PartnershipSummary` dan `PartnershipInsight` jika perlu (saat ini `supplier_id` — tambah `distributor_id` opsional)

- [x] **1.7** `hooks/usePayment.ts` — Ubah mock invoice retailer
  - File: `hooks/usePayment.ts` baris 55
  - Ganti `vendor_name: "CV Maju Bersama"` (supplier) dengan nama distributor, misal `"PT Distributor Jaya"`
  - Pastikan `vendor_name` untuk retailer invoices merujuk ke distributor, bukan supplier

---

### Step 2 — Halaman Distributor untuk Retailer

- [x] **2.1** Buat `app/dashboard/distributors/page.tsx` — Halaman discover & cari distributor partners untuk retailer
  - Mirip `app/dashboard/suppliers/page.tsx` tapi untuk distributor
  - Hanya bisa diakses oleh role retailer
  - Menampilkan: KPI distributor partners, list distributor cards, discover distributors
  - Include `DistributorStockDialog` untuk lihat stok distributor

- [x] **2.2** Buat/extend `hooks/useDistributors.ts` — Tambah fungsi partner discovery untuk retailer
  - Hook saat ini (`useDistributors`) hanya untuk Supplier view (CRM)
  - Tambah: `useDistributors({ type: "partner" })` untuk retailer
  - Tambah: `useDistributorStock(distributorId)` untuk retailer lihat stok
  - Tambah: `useRequestDistributorPartnership()` untuk retailer minta partnership ke distributor
  - Endpoint mock: `/distributors`, `/distributors/:id/stock`, `/distributors/partnership-request`

- [x] **2.3** Buat `components/distributors/distributor-card.tsx` — Card component
  - Mirip `components/suppliers/supplier-card.tsx`
  - Menampilkan: nama, lokasi, kategori, reputation score, stok info
  - Tombol: "Lihat Stok", "Minta Partnership"

- [x] **2.4** Buat `components/distributors/distributor-stock-dialog.tsx` — Dialog lihat stok distributor
  - Mirip `components/suppliers/supplier-stock-dialog.tsx` (embedded di `suppliers/page.tsx`)
  - Menampilkan stok distributor partner secara real-time

---

### Step 3 — Navigation Fix

- [x] **3.1** `components/dashboard/dashboard-shell.tsx` — Retailer sidebar
  - Baris 52: ubah `{ href: "/dashboard/suppliers", label: "Vendors", icon: BarChart3 }` → `{ href: "/dashboard/distributors", label: "Distributors", icon: BarChart3 }`

---

### Step 4 — Order Form Role-Aware

- [x] **4.1** `components/orders/order-form-dialog.tsx` — Role-aware seller selection
  - Import: tambah `useDistributors` untuk retailer
  - Role check: jika retailer → fetch distributor partners, label "Pilih distributor"; jika distributor → fetch supplier partners (seperti sekarang)
  - State: `supplierId` → `sellerId`
  - Payload: kirim `seller_id` + `seller_type` (bukan `supplier_id`)

- [x] **4.2** `app/dashboard/inventory/page.tsx` — Prefill order untuk retailer
  - Baris 37-38, 59: ubah `supplierId` → `sellerId`, untuk retailer gunakan `distributorId`
  - Update `OrderPrefill` type untuk mendukung `sellerType`

- [x] **4.3** `components/inventory/restock-panel.tsx` — Role-aware suggested seller label
  - Baris 57-64: retailer → "Suggested distributor", distributor → "Suggested supplier"
  - Update referensi `rec.suggested_supplier` → `rec.suggested_seller`

---

### Step 5 — Partnerships Page Role-Aware

- [x] **5.1** `app/dashboard/partnerships/page.tsx` — Retailer view
  - Untuk retailer: fetch distributor partners (bukan supplier), label "Distributor partner aktif"
  - Untuk retailer: empty state text "Cari distributor di halaman Distributors"
  - Role check: retailer → gunakan `useDistributors`, distributor → gunakan `useSuppliers`

- [x] **5.2** `app/dashboard/partnerships/page.tsx` — PartnershipNFT untuk retailer
  - Retailer: gunakan `useDistributorPartnershipNFT(distributorId)`
  - Distributor: tetap gunakan `usePartnershipNFT(supplierId)` (yang sekarang `SupplierPartnershipNFT`)
  - Render card yang sesuai per role

---

### Step 6 — Dashboard, Payment, Analytics, Inventory Labels

- [x] **6.1** `app/dashboard/dashboard/page.tsx` (RetailerDashboard)
  - Baris 411-573: ubah `data.suppliers.*` → `data.distributors.*`
  - Label "vendor" → "distributor"
  - Link `/dashboard/suppliers` → `/dashboard/distributors`

- [x] **6.2** `app/dashboard/orders/page.tsx`
  - Baris 72: role-aware text — retailer→"distributor partner", distributor→"supplier partner"
  - Baris 100: "Waiting supplier response" → role-aware

- [x] **6.3** `app/dashboard/payment/page.tsx`
  - Baris 80, 118, 176: retailer → "distributor" bukan "vendor"

- [x] **6.4** `app/dashboard/analytics/page.tsx`
  - Baris 64, 95-98: retailer → "Distributors Perf." bukan "Supplier Perf."

- [x] **6.5** `app/dashboard/inventory/page.tsx`
  - Pastikan AI restock recommendation untuk retailer refer ke `distributor`

- [x] **6.6** `components/auth/register-form.tsx`
  - Baris 29: retailer description → "beli dari distributor pilihan"

- [x] **6.7** `hooks/useAiAgents.ts`
  - Baris 72-78: retailer → `distributor_recommendation` bukan `supplier_recommendation`

---

### Step 7 — Mock Data Update

- [x] **7.1** `lib/mocks/orders.ts`
  - Tambah 1-2 mock order dengan buyer=retailer, seller=distributor
  - Contoh:
    ```ts
    {
      order_id: "order-uuid-007",
      order_number: "ORD-2026-007",
      buyer: { id: "user-uuid-ret-001", name: "Toko Sinar Abadi", role: "retailer" },
      seller: { id: "dist-uuid-001", name: "PT Distributor Jaya", role: "distributor" },
      // ...
    }
    ```

- [x] **7.2** `lib/mocks/dashboard.ts`
  - Ubah `mockRetailerSummary.suppliers` → `distributors` dengan data yang sesuai:
    ```ts
    distributors: {
      active_partnered: 4,
      pending_requests: 1,
      average_reliability_score: 91,
      avg_delivery_time: 2,
    },
    ```

---

### Step 8 — Residual Fix (HIGH/MEDIUM/LOW)

#### HIGH — Flow salah, harus pertama

- [x] **H1** `app/dashboard/dashboard/page.tsx:568` — Link "Lihat distributor" di RetailerDashboard masih ke `/dashboard/suppliers`. Ganti ke `/dashboard/distributors`.

- [x] **H2** `hooks/useInventory.ts:180-185` — Mock `useRestockRecommendation` selalu return `seller_type: "supplier"` dan `seller_id: "supplier-uuid-001"`. Buat role-aware: ambil role dari `useAuthStore`, jika retailer → return `seller_type: "distributor"` dengan distributor ID dan nama.

- [x] **H3** `components/orders/order-card.tsx:57` — `canUpdateStatus = userRole === "supplier"` hanya izinkan supplier update status. Distributor sebagai seller untuk retailer order juga harus bisa update. Ubah logic: seller (sesuai `order.seller.role`) bisa advance status, bukan hanya supplier.
  ```tsx
  // Sebelum:
  const canUpdateStatus = userRole === "supplier" && !isTerminal && !!nextStatus;
  // Sesudah:
  const canUpdateStatus = (userRole === "supplier" || userRole === "distributor") && !isTerminal && !!nextStatus;
  // Atau lebih tepat:
  const canUpdateStatus = order.seller.role === userRole && !isTerminal && !!nextStatus;
  ```

#### MEDIUM — Data model & semantic

- [x] **M1** `hooks/useAnalytics.ts:11` — Field `supplier_performance` di `AnalyticsSummary` type. Rename ke `partner_performance` (netral untuk semua role).

- [x] **M2** `hooks/useAnalytics.ts:39` — Retailer mock data `supplier_performance: 92` → `partner_performance: 92`

- [x] **M3** `hooks/useAnalytics.ts:134` — Supplier mock data juga rename `supplier_performance` → `partner_performance`

- [x] **M4** `app/dashboard/analytics/page.tsx:95-98` — Ubah `summary.supplier_performance` → `summary.partner_performance`. Label role-aware sudah benar, data field yang perlu diupdate.

- [x] **M5** `hooks/usePayment.ts:13` — Field `vendor_name` di `Invoice` type. Rename ke `seller_name`. Update referensi di `app/dashboard/payment/page.tsx:185` dari `inv.vendor_name` → `inv.seller_name`.

- [x] **M6** `hooks/useAiAgents.ts:15,73-78` — Agent key `supplier_recommendation` → `partner_recommendation` (netral). Agent name "Vendor Recommendation" → "Partner Recommendation" (netral). Description dan recent_action ganti "vendor" → "partner".

- [x] **M7** `app/dashboard/partnerships/page.tsx:14-15,40` — `useSuppliers` dipanggil unconditionally padahal retailer tidak butuh. Catatan: React hooks tidak boleh conditional, tapi data-nya sudah tidak dipakai oleh retailer (sudah di-switch lewat `isRetailer`). Tidak perlu diubah secara functional, tapi bisa di-optimasi nanti jika perlu.

- [x] **M8** `app/dashboard/dashboard/page.tsx:315` — SupplierDashboard CTA "Partnership requests" link ke `/dashboard/suppliers` → ganti ke `/dashboard/distributors` (supplier manage distributor partners)

- [x] **M9** `app/dashboard/dashboard/page.tsx:394` — SupplierDashboard "Distributor partner" stats card link ke `/dashboard/suppliers` → ganti ke `/dashboard/distributors`

- [x] **M10** `app/auth/register/page.tsx:8,18` — Highlight text "readiness supplier" → "readiness partner", "reputasi supplier" → "reputasi partner"

#### LOW — Label "vendor" ambigu

- [x] **L1** `app/dashboard/analytics/page.tsx:64` — Description "kecepatan pengiriman vendor" untuk distributor context → ganti "vendor" ke "supplier"

- [x] **L2** `app/dashboard/analytics/page.tsx:97` — Meta text "Indeks kinerja vendor" untuk distributor context → ganti ke "Indeks kinerja supplier"

- [x] **L3** `app/dashboard/payment/page.tsx:80` — "invoice ke vendor" untuk distributor context → ganti ke "invoice ke supplier"

- [x] **L4** `app/dashboard/payment/page.tsx:176` — "tagihan vendor" untuk distributor context → ganti ke "tagihan supplier"

---

## Prioritas Eksekusi (Revisi Plan 2)

| Batch | Item | Alasan |
|-------|------|--------|
| 1 | H1, H2, H3 | Flow salah — langsung impact user |
| 2 | M1-M10 | Data model & semantic consistency |
| 3 | L1-L4 | Label cleanup — low impact tapi good to have |

---

## Flow Yang Benar (Per Role)

### Supplier
- Melihat incoming orders dari distributor
- Proses/produksi → kirim ke distributor
- Solo supplier — tidak order ke siapapun

### Distributor (Hub)
- Order ke supplier (upstream) → stok kurang
- Terima order dari retailer (downstream)
- Receive barang dari supplier → update stok gudang
- Fulfillment ke retailer → kirim barang
- Payment: bayar ke supplier, terima dari retailer

### Retailer
- Order ke **distributor** (bukan supplier!)
- Terima barang dari distributor → update stok toko
- Payment: bayar ke distributor
- Tidak ada akses ke supplier langsung

---

## Keputusan Desain

- **Partnership model**: Opsi B — dua model terpisah (`SupplierPartnershipNFT` dan `DistributorPartnershipNFT`)
- **Order seller type**: `seller_id` + `seller_type` (bukan `supplier_id`)
- **Restock recommendation**: `suggested_seller` (role-aware) menggantikan `suggested_supplier`
- **Retailer navigation**: `/dashboard/distributors` menggantikan `/dashboard/suppliers` (label "Vendors")
- **MVP Constraint**: Retailer hanya beli dari distributor (tidak langsung dari supplier)

---

## Detail H2 — Restock Recommendation Role-Aware

Mock data `useRestockRecommendation` saat ini:
```ts
suggested_seller: {
  seller_id: "supplier-uuid-001",
  name: "CV Maju Bersama",
  seller_type: "supplier" as const,
  reputation_score: 92,
  estimated_delivery_days: 2,
}
```

Perlu dibuat role-aware:
```ts
// Di dalam useRestockRecommendation:
const user = useAuthStore.getState().user;
const isRetailer = user?.role === "retailer";

// Jika retailer:
suggested_seller: {
  seller_id: "dist-001",
  name: "PT Nusantara Distribusi",
  seller_type: "distributor" as const,
  reputation_score: 91,
  estimated_delivery_days: 2,
}

// Jika distributor (default):
suggested_seller: {
  seller_id: "supplier-uuid-001",
  name: "CV Maju Bersama",
  seller_type: "supplier" as const,
  ...
}
```

---

## Detail H3 — Order Status Update Logic

Saat ini hanya supplier bisa update order status. Dengan flow baru:

```
Retailer → Distributor (seller = distributor)
Distributor → Supplier (seller = supplier)
```

Distributor sebagai seller untuk retailer order juga harus bisa advance status.

**Logika baru:**
```tsx
// Sebelum:
const canUpdateStatus = userRole === "supplier" && !isTerminal && !!nextStatus;

// Sesudah (opsi A — simple):
const canUpdateStatus = (userRole === "supplier" || userRole === "distributor") && !isTerminal && !!nextStatus;

// Sesudah (opsi B — lebih tepat, cek seller role):
const canUpdateStatus = order.seller.role === userRole && !isTerminal && !!nextStatus;
```

Opsi B lebih tepat karena hanya seller di order tersebut yang bisa update, bukan semua role secara umum.

---

## Additional Notes

### API Contract Constraint (MVP)

Di `api-contract.md:685` tertulis:
```
> - `retailer` sebagai buyer → seller = `distributor` (atau `supplier` jika beli langsung)
```

MVP constraint: **Retailer hanya beli dari distributor** (tidak langsung dari supplier). Ini adalah keputusan desain Opsi A (3-tier strict flow). Jika di masa depan ingin support beli langsung dari supplier, perlu implementasi ulang sebagai fitur v2.0+.

---

## Summary

| Total Items | Completed |
|------------|-----------|
| Step 1-7 | 25 items |
| Step 8 (Residual) | 17 items |
| **TOTAL** | **42 items** |

Build passes dengan 0 errors.