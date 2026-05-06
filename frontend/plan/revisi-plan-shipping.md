# Revisi Plan — Shipping Flow: Hapus Tombol Manual, Auto-Update Status

## Konteks

Di dunia nyata:
- **Seller** (supplier/distributor) memberikan barang ke ekspedisi → input tracking info (kurir, resi) → sistem otomatis status "shipped"
- **Buyer** (distributor/retailer) menerima barang → klik "terima" → status "delivered"

### Masalah Saat Ini
1. Ada tombol "Mark as [status]" yang bisa diklik seller/buyer secara manual
2. Tidak ada dialog untuk input tracking info saat update ke "shipped"
3. Buyer tidak punya tombol "Terima Barang"

---

## Checklist

### O1 — Hapus Tombol "Mark as [status]" di OrderCard

- [ ] **O1.1** `components/orders/order-card.tsx` — Hapus tombol update status

  Hapus bagian seller yang klik "Mark as [nextStatus]":
  ```tsx
  {/* Seller: update ke status berikutnya */}
  {canUpdateStatus && (
    <Button
      variant="secondary"
      className="gap-2"
      disabled={isUpdating}
      onClick={() => onUpdateStatus?.(order.order_id, nextStatus!)}
    >
      <RefreshCcw className={`h-4 w-4 ${isUpdating ? "animate-spin" : ""}`} />
      Mark as {nextStatus}
      <ChevronRight className="h-3 w-3 opacity-60" />
    </Button>
  )}
  ```

---

### O2 — Tambah Dialog Input Tracking Info (untuk Seller)

- [ ] **O2.1** `app/dashboard/orders/page.tsx` — Import komponen dan icons yang diperlukan

  ```ts
  import { OrderStatusUpdateDialog } from "@/components/orders/order-status-update-dialog";
  ```

- [ ] **O2.2** `app/dashboard/orders/page.tsx` — Tambah state untuk tracking dialog

  ```tsx
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [selectedOrderForShipping, setSelectedOrderForShipping] = useState<string | null>(null);
  ```

- [ ] **O2.3** `app/dashboard/orders/page.tsx` — Tambah dialog untuk input shipping info

  Di dalam return, sebelum Order Detail Dialog:
  ```tsx
  {trackingDialogOpen && selectedOrderForShipping && (
    <OrderStatusUpdateDialog
      open={trackingDialogOpen}
      onClose={() => {
        setTrackingDialogOpen(false);
        setSelectedOrderForShipping(null);
      }}
      orderNumber={orders.find(o => o.order_id === selectedOrderForShipping)?.order_number ?? ""}
      newStatus="shipped"
      onUpdate={(shippingInfo) => {
        updateStatus({
          orderId: selectedOrderForShipping,
          status: "shipped",
          shipping_info: shippingInfo
            ? {
                courier: shippingInfo.courier,
                tracking_number: shippingInfo.tracking_number,
                shipped_at: new Date().toISOString(),
              }
            : undefined,
        });
        setTrackingDialogOpen(false);
        setSelectedOrderForShipping(null);
      }}
      isLoading={isUpdating}
    />
  )}
  ```

- [ ] **O2.4** `app/dashboard/orders/page.tsx` — Tambah tombol "Kirim" untuk seller dengan status "processing"

  Di OrderCard props, tambah:
  ```tsx
  onShip={(orderId) => {
    setSelectedOrderForShipping(orderId);
    setTrackingDialogOpen(true);
  }}
  ```

- [ ] **O2.5** `components/orders/order-card.tsx` — Tambah prop `onShip`

  ```tsx
  interface OrderCardProps {
    // ... existing props
    onShip?: (orderId: string) => void;
  }
  ```

- [ ] **O2.6** `components/orders/order-card.tsx` — Tambah tombol "Kirim" untuk seller

  Di dalam flex gap-3 buttons (setelah escrow released button):
  ```tsx
  {isSeller && order.status === "processing" && (
    <Button className="gap-2" onClick={() => onShip?.(order.order_id)}>
      <Truck className="h-4 w-4" />
      Kirim
    </Button>
  )}
  ```

---

### O3 — Tambah Tombol "Terima Barang" (untuk Buyer)

- [ ] **O3.1** `app/dashboard/orders/page.tsx` — Tambah fungsi handleTerimaBarang

  ```tsx
  function handleTerimaBarang(orderId: string) {
    updateStatus({ orderId, status: "delivered" });
  }
  ```

- [ ] **O3.2** `app/dashboard/orders/page.tsx` — Tambah tombol "Terima Barang" di Order Detail Dialog

  Setelah shipping info section, sebelum Notes:
  ```tsx
  {orderDetail.buyer.role === role && orderDetail.status === "shipped" && orderDetail.escrow_status === "held" && (
    <Button
      className="w-full gap-2"
      onClick={() => {
        handleTerimaBarang(orderDetail.order_id);
        setDetailOrderId(null);
      }}
    >
      <CheckCircle className="h-4 w-4" />
      Terima Barang
    </Button>
  )}
  ```

- [ ] **O3.3** `app/dashboard/orders/page.tsx` — Import CheckCircle icon

  ```ts
  import { CheckCheck, Clock3, PackageOpen, Plus, Truck, Loader2, ShieldCheck, ExternalLink, CheckCircle } from "lucide-react";
  ```

---

## Affected Files

| File | Perubahan |
|------|-----------|
| `components/orders/order-card.tsx` | Hapus tombol "Mark as [status]", tambah prop `onShip`, tambah tombol "Kirim" |
| `app/dashboard/orders/page.tsx` | Tambah state, dialog tracking, handler, tombol "Terima Barang" |
| `hooks/useOrders.ts` | (Sudah ada dari plan sebelumnya) Accept shipping_info |

---

## Summary

| Item | File | Deskripsi |
|------|------|-----------|
| O1.1 | `components/orders/order-card.tsx` | Hapus tombol update status |
| O2.1 | `app/dashboard/orders/page.tsx` | Import OrderStatusUpdateDialog |
| O2.2 | `app/dashboard/orders/page.tsx` | Tambah state tracking dialog |
| O2.3 | `app/dashboard/orders/page.tsx` | Tambah tracking dialog component |
| O2.4 | `app/dashboard/orders/page.tsx` | Tambah onShip prop ke OrderCard |
| O2.5 | `components/orders/order-card.tsx` | Tambah prop onShip |
| O2.6 | `components/orders/order-card.tsx` | Tambah tombol "Kirim" |
| O3.1 | `app/dashboard/orders/page.tsx` | Tambah handleTerimaBarang |
| O3.2 | `app/dashboard/orders/page.tsx` | Tambah tombol "Terima Barang" |
| O3.3 | `app/dashboard/orders/page.tsx` | Import CheckCircle |

---

## Catatan

- Tombol "Track Delivery" yang sekarang ada di OrderCard (untuk buyer) tetap bisa digunakan untuk melihat tracking info
- Escrow release otomatis saat status "delivered" (sudah ada di useUpdateOrderStatus mock)