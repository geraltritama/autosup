# Revisi Plan — Perbaiki Mock Data Orders untuk Flow yang Benar

## Konteks

Flow yang benar: **Supplier → Distributor → Retailer**

- **Distributor**: PT Indomarco, PT Kalbe Farma, PT Unilever, dll (perusahaan besar)
- **Retailer**: Alfamart, Indomaret, Matahari, Gramedia, Warung, Toko Buku, dll

### Masalah
Mock data saat ini salah:
- Orders 001-006 buyer menggunakan nama "Toko/Warung" tapi role "distributor" - seharusnya distributor yang membeli dari supplier
- Tidak ada orders yang menunjukkan distributor sebagai buyer (dari supplier)

---

## Checklist

### M1 — Update Orders 001-006 (Supplier → Distributor)

- [ ] **M1.1** `lib/mocks/orders.ts` — Update orders 001-006 buyer: distributor membeli dari supplier

  Nama distributor yang akan dipakai:
  - `PT Nusantara Distribusi`
  - `UD Sejahtera Abadi`
  - `PT Indo Logistic`

  ```ts
  // Sebelum:
  buyer: { id: "user-uuid-dist-001", name: "Toko Budi Jaya", role: "distributor" },
  seller: { id: "supplier-uuid-001", name: "CV Maju Bersama", role: "supplier" },

  // Sesudah (distributor buying from supplier):
  buyer: { id: "dist-001", name: "PT Nusantara Distribusi", role: "distributor" },
  seller: { id: "supplier-uuid-001", name: "CV Maju Bersama", role: "supplier" },
  ```

- [ ] **M1.2** `lib/mocks/orders.ts` — Update orders 004 buyer name yang sesuai

  ```ts
  // Sebelum:
  buyer: { id: "user-uuid-dist-002", name: "Warung Sumber Rejeki", role: "distributor" },

  // Sesudah:
  buyer: { id: "dist-002", name: "UD Sejahtera Abadi", role: "distributor" },
  ```

---

### M2 — Tambah Orders Baru (Distributor sebagai Buyer)

- [ ] **M2.1** `lib/mocks/orders.ts` — Tambah 2-3 orders baru dengan buyer=distributor, seller=supplier

  Ini agar saat login sebagai supplier, ada order masuk dari distributor:

  ```ts
  {
    order_id: "order-uuid-009",
    order_number: "ORD-2026-009",
    buyer: { id: "dist-003", name: "PT Indo Logistic", role: "distributor" },
    seller: { id: "supplier-uuid-001", name: "CV Maju Bersama", role: "supplier" },
    items: [
      { item_name: "Kopi Bubuk", qty: 50, unit: "kg", price_per_unit: 45000, subtotal: 2250000 },
    ],
    total_amount: 2250000,
    status: "processing",
    escrow_status: "held",
    delivery_address: "Jl. Industri Raya No.15, Jakarta",
    notes: "Mohon cepat kirim",
    estimated_delivery: "2026-05-03",
    status_history: [
      { status: "pending", changed_at: "2026-04-29T10:00:00Z" },
      { status: "processing", changed_at: "2026-04-29T14:00:00Z" },
    ],
    created_at: "2026-04-29T10:00:00Z",
    updated_at: "2026-04-29T14:00:00Z",
  },
  {
    order_id: "order-uuid-010",
    order_number: "ORD-2026-010",
    buyer: { id: "dist-001", name: "PT Nusantara Distribusi", role: "distributor" },
    seller: { id: "supplier-uuid-002", name: "Nusantara Supply Co.", role: "supplier" },
    items: [
      { item_name: "Minuman Ringan", qty: 200, unit: "box", price_per_unit: 12000, subtotal: 2400000 },
    ],
    total_amount: 2400000,
    status: "shipped",
    escrow_status: "held",
    delivery_address: "Jl. Lodan Raya No.8, Jakarta",
    notes: null,
    estimated_delivery: "2026-05-02",
    shipping_info: {
      courier: "JNE",
      tracking_number: "JNE987654321",
      shipped_at: "2026-04-30T09:00:00Z",
      tracking_url: "https://jne.co.id/tracking/JNE987654321",
    },
    status_history: [
      { status: "pending", changed_at: "2026-04-28T11:00:00Z" },
      { status: "processing", changed_at: "2026-04-28T15:00:00Z" },
      { status: "shipped", changed_at: "2026-04-30T09:00:00Z" },
    ],
    created_at: "2026-04-28T11:00:00Z",
    updated_at: "2026-04-30T09:00:00Z",
  },
  ```

---

### M3 — Update Orders 007-008 (Distributor → Retailer)

- [ ] **M3.1** `lib/mocks/orders.ts` — Update order-007 buyer: gunakan retailer dari useRetailers

  ```ts
  // Sebelum:
  buyer: { id: "user-uuid-ret-001", name: "Toko Sinar Abadi", role: "retailer" },

  // Sesudah (pakai retailer yang sudah ada di useRetailers):
  buyer: { id: "retailer-uuid-001", name: "Toko Sumber Rejeki", role: "retailer" },
  seller: { id: "dist-001", name: "PT Nusantara Distribusi", role: "distributor" },
  ```

- [ ] **M3.2** `lib/mocks/orders.ts` — Update order-008 buyer: gunakan retailer yang sudah ada

  ```ts
  // Sebelum:
  buyer: { id: "user-uuid-ret-001", name: "Toko Sinar Abadi", role: "retailer" },

  // Sesudah:
  buyer: { id: "retailer-uuid-002", name: "Warung Bu Tini", role: "retailer" },
  seller: { id: "dist-001", name: "PT Nusantara Distribusi", role: "distributor" },
  ```

---

### M4 — Tambah Orders Baru (Distributor → Retailer)

- [ ] **M4.1** `lib/mocks/orders.ts` — Tambah order-011: Restoran Padang Jaya (delivered)

  ```ts
  {
    order_id: "order-uuid-011",
    order_number: "ORD-2026-011",
    buyer: { id: "retailer-uuid-003", name: "Restoran Padang Jaya", role: "retailer" },
    seller: { id: "dist-001", name: "PT Nusantara Distribusi", role: "distributor" },
    items: [
      { item_name: "Mie Instant", qty: 100, unit: "dus", price_per_unit: 25000, subtotal: 2500000 },
      { item_name: "Minyak Goreng", qty: 50, unit: "liter", price_per_unit: 16000, subtotal: 800000 },
    ],
    total_amount: 3300000,
    status: "delivered",
    escrow_status: "released",
    delivery_address: "Jl. Braga No.45, Bandung",
    notes: "Terima kasih",
    estimated_delivery: "2026-04-22",
    shipping_info: {
      courier: "JNE",
      tracking_number: "JNE111222333",
      shipped_at: "2026-04-20T08:00:00Z",
      tracking_url: "https://jne.co.id/tracking/JNE111222333",
    },
    status_history: [
      { status: "pending", changed_at: "2026-04-18T09:00:00Z" },
      { status: "processing", changed_at: "2026-04-18T11:00:00Z" },
      { status: "shipped", changed_at: "2026-04-20T08:00:00Z" },
      { status: "delivered", changed_at: "2026-04-22T14:00:00Z" },
    ],
    created_at: "2026-04-18T09:00:00Z",
    updated_at: "2026-04-22T14:00:00Z",
  },
  ```

- [ ] **M4.2** `lib/mocks/orders.ts` — Tambah order-012: Bakery Sweet Corner (shipped)

  ```ts
  {
    order_id: "order-uuid-012",
    order_number: "ORD-2026-012",
    buyer: { id: "retailer-uuid-004", name: "Bakery Sweet Corner", role: "retailer" },
    seller: { id: "dist-002", name: "UD Sejahtera Abadi", role: "distributor" },
    items: [
      { item_name: "Tepung Terigu", qty: 30, unit: "karung", price_per_unit: 180000, subtotal: 5400000 },
    ],
    total_amount: 5400000,
    status: "shipped",
    escrow_status: "held",
    delivery_address: "Jl. Pemuda No.12, Surabaya",
    notes: "Mohon prioritas",
    estimated_delivery: "2026-05-02",
    shipping_info: {
      courier: "J&T Express",
      tracking_number: "JT999888777",
      shipped_at: "2026-04-30T10:00:00Z",
      tracking_url: "https://jtexpress.id/track/JT999888777",
    },
    status_history: [
      { status: "pending", changed_at: "2026-04-28T08:00:00Z" },
      { status: "processing", changed_at: "2026-04-28T10:00:00Z" },
      { status: "shipped", changed_at: "2026-04-30T10:00:00Z" },
    ],
    created_at: "2026-04-28T08:00:00Z",
    updated_at: "2026-04-30T10:00:00Z",
  },
  ```

---

### M5 — Update Order Detail Dialog (Buyer/Seller Display)

- [ ] **M5.1** `app/dashboard/orders/page.tsx` — Update description display agar lebih jelas

  ```tsx
  // Sebelum:
  description={orderDetail ? `${orderDetail.order_number} — ${orderDetail.buyer.name} → ${orderDetail.seller.name}` : "Memuat detail order..."}

  // Sesudah:
  description={orderDetail ? `${orderDetail.order_number} — ${orderDetail.buyer.name} (${orderDetail.buyer.role}) → ${orderDetail.seller.name} (${orderDetail.seller.role})` : "Memuat detail order..."}
  ```

---

## Distributor Names yang Dipakai

| ID | Nama |
|----|------|
| dist-001 | PT Nusantara Distribusi |
| dist-002 | UD Sejahtera Abadi |
| dist-003 | PT Indo Logistic |
| dist-004 | CV Nusantara Makmur |

## Retailer Names yang Dipakai

| ID | Nama |
|----|------|
| retailer-001 | Toko Sinar Abadi |
| retailer-002 | Alfamart Pondok Indah |
| retailer-003 | Indomaret Tanah Abang |
| retailer-004 | Gramedia Jakarta |
| retailer-005 | Warung Sumber Rejeki |

---

## Summary

| Item | File | Deskripsi |
|------|------|-----------|
| M1.1 | `lib/mocks/orders.ts` | Update orders 001-003 buyer (distributor) |
| M1.2 | `lib/mocks/orders.ts` | Update orders 004 buyer (distributor) |
| M2.1 | `lib/mocks/orders.ts` | Tambah orders baru (distributor → supplier) |
| M3.1 | `lib/mocks/orders.ts` | Update order-007 buyer (Toko Sumber Rejeki) |
| M3.2 | `lib/mocks/orders.ts` | Update order-008 buyer (Warung Bu Tini) |
| M4.1 | `lib/mocks/orders.ts` | Tambah order-011 (Restoran Padang Jaya - delivered) |
| M4.2 | `lib/mocks/orders.ts` | Tambah order-012 (Bakery Sweet Corner - shipped) |
| M5.1 | `app/dashboard/orders/page.tsx` | Update detail display dengan role |