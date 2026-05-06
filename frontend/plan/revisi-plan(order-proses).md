# Revisi Plan — Order Shipping Flow with Tracking

## Konteks

Sistem saat ini menggunakan `shipping` sebagai status yang diupdate manual oleh user. Ini tidak mencerminkan flow nyata di mana:
- Shipping dilakukan oleh ekspedisi, bukan user
- User hanya perlu mengisi tracking info dan track posisi barang

Flow yang dimaksud: **supplier → distributor → retailer**
- **Seller** (supplier/distributor): Kirim → isi tracking info → selesai
- **Buyer** (distributor/retailer): Track posisi barang → klik "terima" → selesai

---

## Checklist

### T1 — Tambah Shipping Info Type di `useOrders`

- [ ] **T1.1** `hooks/useOrders.ts` — Tambah `ShippingInfo` type

  ```ts
  export type ShippingInfo = {
    courier: string;
    tracking_number: string;
    shipped_at: string;
    tracking_url?: string; // optional, untuk link tracking
  };
  ```

- [ ] **T1.2** `hooks/useOrders.ts` — Update `Order` type, tambahkan `shipping_info`

  ```ts
  // Sebelum:
  status: OrderStatus;
  escrow_status: EscrowStatus;
  delivery_address: string;

  // Sesudah:
  status: OrderStatus;
  escrow_status: EscrowStatus;
  delivery_address: string;
  shipping_info?: ShippingInfo;
  ```

- [ ] **T1.3** `hooks/useOrders.ts` — Update mock data: tambahkan shipping_info ke beberapa order

  Tambahkan ke order yang statusnya "shipping" atau "delivered":
  ```ts
  shipping_info: {
    courier: "JNE",
    tracking_number: "JNE123456789",
    shipped_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    tracking_url: "https://jne.co.id/tracking/JNE123456789",
  }
  ```

---

### T2 — Update Update Status Hook untuk Requires Shipping Info

- [ ] **T2.1** `hooks/useOrders.ts` — Tambah `UpdateOrderStatusPayload` type

  ```ts
  export type UpdateOrderStatusPayload = {
    status: OrderStatus;
    shipping_info?: ShippingInfo; // wajib saat update ke "shipped"
  };
  ```

- [ ] **T2.2** `hooks/useOrders.ts` — Update `useUpdateOrderStatus` mock untuk handle shipping_info

  ```ts
  // Di dalam mock:
  if (status === "shipped" && !shipping_info) {
    throw new Error("Tracking info wajib saat mengirim barang");
  }
  if (shipping_info) {
    mockOrders[idx].shipping_info = shipping_info;
  }
  ```

- [ ] **T2.3** `hooks/useOrders.ts` — Update API call section untuk kirim shipping_info

  ```ts
  // Di dalam API call section:
  await api.put(`/orders/${orderId}/status`, {
    status,
    ...(shipping_info && { shipping_info }),
  });
  ```

---

### T3 — Update OrderCard Tampilkan Tracking Badge

- [ ] **T3.1** `components/orders/order-card.tsx` — Import `Truck` icon dari lucide

  ```ts
  import { ..., Truck } from "lucide-react";
  ```

- [ ] **T3.2** `components/orders/order-card.tsx` — Tambah shipping badge setelah status badge

  ```tsx
  {order.shipping_info && (
    <div className="flex items-center gap-1.5 rounded-lg bg-[#F0F9FF] px-2.5 py-1.5 text-xs font-medium text-[#0284C7]">
      <Truck className="h-3.5 w-3.5" />
      <span>{order.shipping_info.courier}</span>
      <span className="text-[#94A3B8]">·</span>
      <span className="font-mono">{order.shipping_info.tracking_number}</span>
    </div>
  )}
  ```

---

### T4 — Update Order Detail Dialog Tampilkan Full Tracking Info

- [ ] **T4.1** `components/orders/order-detail-dialog.tsx` — Import icons yang diperlukan

  ```ts
  import { Truck, ExternalLink, Package, CheckCircle } from "lucide-react";
  ```

- [ ] **T4.2** `components/orders/order-detail-dialog.tsx` — Tambah shipping info section

  ```tsx
  {order.shipping_info && (
    <div className="rounded-xl border border-[#E2E8F0] bg-slate-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-[#0284C7]" />
        <span className="text-sm font-semibold text-[#0F172A]">Informasi Pengiriman</span>
      </div>
      <div className="grid gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-[#64748B]">Ekspedisi</span>
          <span className="font-medium text-[#0F172A]">{order.shipping_info.courier}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#64748B]">No. Resi</span>
          <span className="font-mono text-[#0F172A]">{order.shipping_info.tracking_number}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#64748B]">Dikirim</span>
          <span className="text-[#0F172A]">
            {new Date(order.shipping_info.shipped_at).toLocaleDateString("id-ID", {
              day: "numeric", month: "long", year: "numeric"
            })}
          </span>
        </div>
        {order.shipping_info.tracking_url && (
          <a
            href={order.shipping_info.tracking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium text-[#0284C7] hover:underline mt-1"
          >
            Lacak paket <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  )}
  ```

---

### T5 — Rename Status `shipping` → `shipped` (atau `in_transit`)

- [ ] **T5.1** `hooks/useOrders.ts` — Update `OrderStatus` type

  ```ts
  // Sebelum:
  export type OrderStatus = "pending" | "processing" | "shipping" | "delivered" | "cancelled";

  // Sesudah:
  export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  ```

- [ ] **T5.2** `hooks/useOrders.ts` — Update semua referensi "shipping" di mock data

  Ganti `status: "shipping"` → `status: "shipped"` di mock orders.

- [ ] **T5.3** `components/orders/order-status-badge.tsx` — Update display label

  ```ts
  // Sebelum:
  shipping: "Shipping",

  // Sesudah:
  shipped: "Shipped",
  ```

- [ ] **T5.4** `app/dashboard/orders/page.tsx` — Update status filter options

  Ganti "shipping" → "shipped" di filter options.

- [ ] **T5.5** `app/dashboard/inventory/page.tsx` — Update prefill sellerType jika ada

  Cek dan update jika ada referensi ke "shipping" di inventory.

---

### T6 — Update Update Status Modal/Form untuk Requires Tracking Info

- [ ] **T6.1** `components/orders/order-status-update-dialog.tsx` — Tambah form shipping_info

  Saat user akan update ke "shipped", muncul form untuk isi:
  - Nama ekspedisi (dropdown atau text)
  - Nomor resi
  - Tanggal kirim (auto atau manual)

  ```tsx
  {newStatus === "shipped" && (
    <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-slate-50 p-4">
      <p className="text-sm font-medium text-[#0F172A]">Informasi Pengiriman</p>
      <div className="space-y-2">
        <Input
          placeholder="Nama ekspedisi (cth: JNE, Grab, Gojek)"
          value={shippingInfo.courier}
          onChange={(e) => setShippingInfo({...shippingInfo, courier: e.target.value})}
          required
        />
        <Input
          placeholder="Nomor resi"
          value={shippingInfo.tracking_number}
          onChange={(e) => setShippingInfo({...shippingInfo, tracking_number: e.target.value})}
          required
        />
      </div>
    </div>
  )}
  ```

- [ ] **T6.2** `components/orders/order-status-update-dialog.tsx` — Validasi shipping_info required saat shipped

  ```ts
  const canUpdate = newStatus === "shipped"
    ? !!shippingInfo.courier && !!shippingInfo.tracking_number
    : true;
  ```

---

### T7 — Update Buyer Flow: "Terima Barang"

- [ ] **T7.1** `components/orders/order-detail-dialog.tsx` — Tambah tombol "Terima Barang" untuk buyer

  Kondisi:
  - Status saat ini adalah "shipped"
  - User adalah buyer (bukan seller)
  - Escrow sudah "released" (opsional, tergantung flow)

  ```tsx
  {isBuyer && order.status === "shipped" && (
    <Button
      onClick={() => handleTerimaBarang()}
      className="w-full"
    >
      <CheckCircle className="h-4 w-4" />
      Terima Barang
    </Button>
  )}
  ```

- [ ] **T7.2** `components/orders/order-detail-dialog.tsx` — Implement handleTerimaBarang

  Panggil `updateOrderStatus({ orderId: order.order_id, status: "delivered" })`.

---

## Prioritas Eksekusi

| Batch | Item | Alasan |
|-------|------|--------|
| 1 | T1, T5 | Type definition & status rename |
| 2 | T2 | Update status hook with shipping info |
| 3 | T3, T4 | UI - Card & Detail display |
| 4 | T6 | UI - Update status form |
| 5 | T7 | UI - Buyer receive flow |

---

## Summary

| Item | File | Deskripsi |
|------|------|-----------|
| T1.1 | `hooks/useOrders.ts` | Tambah ShippingInfo type |
| T1.2 | `hooks/useOrders.ts` | Tambah shipping_info ke Order type |
| T1.3 | `hooks/useOrders.ts` | Update mock data |
| T2.1 | `hooks/useOrders.ts` | Tambah UpdateOrderStatusPayload |
| T2.2 | `hooks/useOrders.ts` | Update mock handle shipping_info |
| T2.3 | `hooks/useOrders.ts` | Update API call |
| T3.1 | `components/orders/order-card.tsx` | Import Truck icon |
| T3.2 | `components/orders/order-card.tsx` | Tambah tracking badge |
| T4.1 | `components/orders/order-detail-dialog.tsx` | Import icons |
| T4.2 | `components/orders/order-detail-dialog.tsx` | Tambah shipping info section |
| T5.1 | `hooks/useOrders.ts` | Rename shipping → shipped |
| T5.2 | `hooks/useOrders.ts` | Update mock references |
| T5.3 | `components/orders/order-status-badge.tsx` | Update label |
| T5.4 | `app/dashboard/orders/page.tsx` | Update filter options |
| T5.5 | `app/dashboard/inventory/page.tsx` | Update jika diperlukan |
| T6.1 | `components/orders/order-status-update-dialog.tsx` | Form shipping_info |
| T6.2 | `components/orders/order-status-update-dialog.tsx` | Validasi |
| T7.1 | `components/orders/order-detail-dialog.tsx` | Tombol terima barang |
| T7.2 | `components/orders/order-detail-dialog.tsx` | Implement handler |