# Revisi Plan — Partnerships Page untuk Supplier

## Konteks

### Masalah Saat Ini
1. **Supplier diblokir** dari akses Partnerships page (ada check yang menolak role "supplier")
2. **Tidak ada tampilan** untuk melihat Distributor Partners saat login sebagai supplier
3. **Tombol "Lihat Detail"** yang ditambahkan sebelumnya hanya untuk retailer, bukan supplier

### Flow yang Benar
| Role | Melihat Partner |
|------|-----------------|
| **Supplier** | Distributor Partners (yang membeli dari supplier) |
| **Distributor** | Supplier Partners + Retailer Partners |
| **Retailer** | Distributor Partners |

---

## Checklist

### S1 — Hapus Pembatasan Akses untuk Supplier

- [ ] **S1.1** `app/dashboard/partnerships/page.tsx` — Hapus/modifikasi check role yang memblokir supplier

  Ubah:
  ```ts
  // Sebelum:
  if (role !== "distributor" && role !== "retailer") {
    return (/* akses ditolak */);
  }

  // Sesudah:
  // Hapus check ini atau modifikasi agar supplier bisa akses
  ```

---

### S2 — Tambah Tampilan Distributor Partners untuk Supplier

- [ ] **S2.1** `app/dashboard/partnerships/page.tsx` — Tambah header description untuk supplier

  ```ts
  // Tambahkan di header description:
  : role === "supplier"
    ? "Kelola kemitraan dengan distributor partner, verifikasi trust layer, dan pantau metrik distribusi."
  ```

- [ ] **S2.2** `app/dashboard/partnerships/page.tsx` — Fetch Distributor Partners untuk supplier

  ```ts
  // Supplier view: fetch distributor partners (sudah ada dari sebelumnya)
  //useDistributors({ type: "partner" }) sudah di-fetch
  ```

- [ ] **S2.3** `app/dashboard/partnerships/page.tsx` — Tambah render section untuk supplier melihat distributor partners

  ```tsx
  {/* Supplier: distributor partners */}
  {role === "supplier" && !isDistributorsLoading && !isDistributorsError && distributors.length > 0 && (
    <div className="grid gap-4">
      {(distributors as Distributor[]).map((dist) => (
        <div key={dist.distributor_id} className="space-y-2">
          <DistributorCard
            distributor={dist}
            onViewDetail={(d) => { setSelectedDistributor(d); setDistributorDetailOpen(true); }}
          />
          <DistributorNFTBadge distributorId={dist.distributor_id} />
        </div>
      ))}
    </div>
  )}
  ```

- [ ] **S2.4** `app/dashboard/partnerships/page.tsx` — Tambah empty state untuk supplier

  ```tsx
  {role === "supplier" && !isDistributorsLoading && !isDistributorsError && distributors.length === 0 && (
    <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white">
      <span className="text-sm font-medium text-[#0F172A]">Belum ada distributor partner</span>
      <span className="mt-1 text-xs text-[#64748B]">Cari distributor di halaman Distributors.</span>
    </div>
  )}
  ```

---

### S3 — Update Side Panel untuk Supplier

- [ ] **S3.1** `app/dashboard/partnerships/page.tsx` — Update side panel condition untuk supplier

  ```tsx
  // Ubah condition:
  {isRetailer ? (
    <RetailerTrustPanel />
  ) : role === "supplier" ? (
    <SuppliersTrustPanel /> // Reuse, karena sama-sama supplier-related
  ) : isDistributor && partnerView === "retailers" ? (
    <DistributorTrustPanel />
  ) : (
    <SuppliersTrustPanel />
  )}
  ```

---

### S4 — Update KPIs dan Label untuk Supplier

- [ ] **S4.1** `app/dashboard/partnerships/page.tsx` — Update KPI meta label untuk supplier

  ```ts
  const partnerLabel = isRetailer
    ? "Distributor partner aktif"
    : role === "supplier"
      ? "Distributor partner aktif"
      : isDistributor && partnerView === "retailers"
        ? "Retailer partner aktif"
        : "Supplier partner aktif";
  ```

- [ ] **S4.2** `app/dashboard/partnerships/page.tsx` — Update empty text untuk supplier

  ```ts
  const emptyText = isRetailer
    ? "Cari distributor di halaman Distributors."
    : role === "supplier"
      ? "Belum ada distributor partner. Cari distributor di halaman Distributors."
      : isDistributor && partnerView === "retailers"
        ? "Belum ada retailer partner. Kelola retailer di halaman Retailers."
        : "Cari supplier di halaman Suppliers.";
  ```

---

## Affected Files

| File | Perubahan |
|------|-----------|
| `app/dashboard/partnerships/page.tsx` | Hapus restrict, tambah view distributor partners untuk supplier |
| `components/distributors/distributor-card.tsx` | (Sudah ada) onViewDetail prop |
| `components/distributors/distributor-detail-dialog.tsx` | (Sudah ada) Dialog untuk lihat detail |
| `components/orders/distributor-nft-badge.tsx` | (Sudah ada) NFT badge |

---

## Summary

| Item | File | Deskripsi |
|------|------|-----------|
| S1.1 | `app/dashboard/partnerships/page.tsx` | Hapus blokir akses untuk supplier |
| S2.1 | `app/dashboard/partnerships/page.tsx` | Tambah header description untuk supplier |
| S2.2 | `app/dashboard/partnerships/page.tsx` | (Sudah ada) useDistributors sudah di-fetch |
| S2.3 | `app/dashboard/partnerships/page.tsx` | Render distributor cards di supplier view |
| S2.4 | `app/dashboard/partnerships/page.tsx` | Tambah empty state untuk supplier |
| S3.1 | `app/dashboard/partnerships/page.tsx` | Update side panel untuk supplier |
| S4.1 | `app/dashboard/partnerships/page.tsx` | Update KPI label untuk supplier |
| S4.2 | `app/dashboard/partnerships/page.tsx` | Update empty text untuk supplier |

---

## Notes

- Distributor Partners yang ditampilkan adalah yang sudah berstatus "partner" di mock data
- Tombol "Lihat Detail" menggunakan DistributorDetailDialog yang sudah dibuat sebelumnya
- Trust layer NFT badge juga ditampilkan untuk setiap distributor partner