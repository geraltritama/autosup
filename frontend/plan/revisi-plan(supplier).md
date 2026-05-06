# Revisi Plan — Supplier-Specific Fixes

## Konteks

Setelah audit menyeluruh dari perspektif user **Supplier**, ditemukan 4 issue yang perlu diperbaiki.
Flow yang benar: **Supplier → Distributor → Retailer → Konsumen**

Supplier **tidak order ke siapapun** — mereka menerima order dari distributor dan memproduksi/fulfill.

---

## Checklist

### S1 — HIGH: Restock recommendation untuk Supplier menyarankan order dari supplier lain

**Masalah:** Mock `useRestockRecommendation` saat ini return `seller_type: "supplier"` untuk non-retailer (termasuk supplier). Supplier tidak seharusnya diberi rekomendasi order dari supplier lain karena mereka adalah pihak paling hulu (upstream).

- [ ] **S1.1** `hooks/useInventory.ts:174-189` — Ubah logic `suggestedSeller` jadi role-aware 3-way:
  ```ts
  // Sebelum:
  const isRetailer = useAuthStore.getState().user?.role === "retailer";
  const suggestedSeller = isRetailer
    ? { seller_id: "dist-001", name: "PT Nusantara Distribusi", seller_type: "distributor" as const, ... }
    : { seller_id: "supplier-uuid-001", name: "CV Maju Bersama", seller_type: "supplier" as const, ... };

  // Sesudah:
  const role = useAuthStore.getState().user?.role;
  const suggestedSeller = role === "retailer"
    ? { seller_id: "dist-001", name: "PT Nusantara Distribusi", seller_type: "distributor" as const, reputation_score: 91, estimated_delivery_days: 2 }
    : role === "distributor"
      ? { seller_id: "supplier-uuid-001", name: "CV Maju Bersama", seller_type: "supplier" as const, reputation_score: 92, estimated_delivery_days: 2 }
      : null; // Supplier tidak order dari siapapun
  ```

- [ ] **S1.2** `components/inventory/restock-panel.tsx:21` — Ubah `sellerLabel` jadi 3-way role-aware:
  ```tsx
  // Sebelum:
  const sellerLabel = role === "retailer" ? "Suggested distributor" : "Suggested supplier";

  // Sesudah:
  const sellerLabel = role === "retailer" ? "Suggested distributor" : role === "distributor" ? "Suggested supplier" : "Suggested partner";
  ```
  Catatan: Saat `suggested_seller === null` untuk supplier, UI otomatis menyembunyikan blok suggested seller dan tombol "Buat Order" karena `{rec.suggested_seller && ...}` guard. Tambah label defensive saja.

### S2 — MEDIUM: Analytics KPI label salah untuk Supplier

**Masalah:** Saat ini logic-nya hanya 2-way: `retailer → "Distributor Perf."`, `else → "Supplier Perf."`. Untuk supplier, partner-nya adalah distributor, bukan supplier. Menampilkan "Supplier Perf." ke supplier ambigu.

- [ ] **S2.1** `app/dashboard/analytics/page.tsx:95-97` — Ubah logic jadi 3-way:
  ```tsx
  // Sebelum:
  label={role === "retailer" ? "Distributor Perf." : "Supplier Perf."}
  meta={role === "retailer" ? "Indeks kinerja distributor" : "Indeks kinerja supplier"}

  // Sesudah:
  label={role === "distributor" ? "Supplier Perf." : "Distributor Perf."}
  meta={role === "distributor" ? "Indeks kinerja supplier" : "Indeks kinerja distributor"}
  ```

  Logika:
  - Distributor → partner = supplier → "Supplier Perf."
  - Retailer → partner = distributor → "Distributor Perf."
  - Supplier → partner = distributor → "Distributor Perf."

### S3 — MEDIUM: `canUpdateStatus` menggunakan logic terlalu broad (Op A)

**Masalah:** Revisi plan H3 merekomendasikan Op B yang lebih tepat — hanya seller di order tersebut yang bisa advance status, bukan semua supplier/distributor secara umum. Op A memungkinkan distributor untuk advance status pada order yang dia buat (sebagai buyer), bukan hanya order yang dia terima (sebagai seller).

- [ ] **S3.1** `components/orders/order-card.tsx:57` — Ganti dari Op A ke Op B:
  ```tsx
  // Sebelum (Op A):
  const canUpdateStatus = (userRole === "supplier" || userRole === "distributor") && !isTerminal && !!nextStatus;

  // Sesudah (Op B):
  const canUpdateStatus = order.seller.role === userRole && !isTerminal && !!nextStatus;
  ```
  Mengapa ini benar:
  - Supplier sebagai seller di order distributor→supplier → bisa advance ✅
  - Distributor sebagai seller di order retailer→distributor → bisa advance ✅
  - Distributor sebagai buyer di order distributor→supplier → TIDAK bisa advance ✅
  - Retailer sebagai buyer → tidak bisa advance ✅

### S4 — LOW: Analytics description untuk Supplier ambigu

**Masalah:** Description "kecepatan pengiriman supplier" untuk supplier context terdengar aneh karena supplier sendiri yang disebut "supplier".

- [ ] **S4.1** `app/dashboard/analytics/page.tsx:64` — Buat 3-way role-aware description:
  ```tsx
  // Sebelum:
  Pantau performa bisnis, kesehatan inventory, kecepatan pengiriman {role === "retailer" ? "distributor" : "supplier"}, dan pertumbuhan pendapatan dari waktu ke waktu.

  // Sesudah:
  Pantau performa bisnis, kesehatan inventory, {role === "retailer" ? "kecepatan pengiriman distributor" : role === "distributor" ? "kecepatan pengiriman supplier" : "kecepatan fulfillment Anda"}, dan pertumbuhan pendapatan dari waktu ke waktu.
  ```

---

## Prioritas Eksekusi

| Batch | Item | Alasan |
|-------|------|--------|
| 1 | S1 | Flow salah — supplier disarankan order dari supplier lain |
| 2 | S2, S3 | Label salah + logic broad |
| 3 | S4 | Label cleanup — low impact tapi good to have |

---

## Summary

| Item | Severity | File | Deskripsi |
|------|----------|------|-----------|
| S1 | HIGH | `hooks/useInventory.ts`, `components/inventory/restock-panel.tsx` | Restock suggestion untuk supplier harus `null` |
| S2 | MEDIUM | `app/dashboard/analytics/page.tsx` | KPI label "Distributor Perf." untuk supplier |
| S3 | MEDIUM | `components/orders/order-card.tsx` | `canUpdateStatus` pakai Op B (seller-specific) |
| S4 | LOW | `app/dashboard/analytics/page.tsx` | Description 3-way role-aware |