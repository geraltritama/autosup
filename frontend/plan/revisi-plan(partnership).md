  # Revisi Plan — Distributor Partnership Dual View

## Konteks

Distributor adalah **hub** dengan partnership di **dua arah**:
- **Upstream:** Supplier partners (sudah ditampilkan di Partnerships page ✅)
- **Downstream:** Retailer partners (TIDAK ditampilkan ❌)

Ini penting karena Credit Line hanya bisa dibuka untuk retailer yang sudah bermitra, dan distributor perlu lihat NFT/trust layer untuk retailer partners.

---

## Checklist

### P1 — Tambah `type` filter ke `useRetailers`

- [x] **P1.1** `hooks/useRetailers.ts` — Tambah `type?: "partner" | "all"` ke `RetailerFilters`

  ```ts
  // Sebelum:
  type RetailerFilters = {
    segment?: RetailerSegment;
    status?: RetailerStatus;
    search?: string;
    page?: number;
    limit?: number;
  };

  // Sesudah:
  type RetailerFilters = {
    segment?: RetailerSegment;
    status?: RetailerStatus;
    search?: string;
    page?: number;
    limit?: number;
    type?: "partner" | "all";
  };
  ```

- [x] **P1.2** `hooks/useRetailers.ts` — Update `useRetailers` mock: ketika `type === "partner"`, filter hanya retailer dengan `status === "active"`

  ```ts
  // Di dalam useRetailers mock, tambahkan setelah segment/status/search filter:
  if (filters.type === "partner") {
    list = list.filter((r) => r.status === "active");
  }
  ```

- [x] **P1.3** `hooks/useRetailers.ts` — Update `useRetailers` API call: tambah `type` ke query params

  ```ts
  // Di dalam useRetailers API call section, tambahkan:
  if (filters.type) params.set("type", filters.type);
  ```

---

### P2 — Tambah `useRetailerPartnershipNFT` hook

- [x] **P2.1** `hooks/usePartnerships.ts` — Tambah hook `useRetailerPartnershipNFT(retailerId)`

  Dipanggil dari **distributor** perspective. Re-use `DistributorPartnershipNFT` type (strukturnya sama: retailer_id + distributor_id).

  ```ts
  export function useRetailerPartnershipNFT(retailerId: string | null) {
    const userId = useAuthStore((s) => s.user?.user_id ?? "me");
    return useQuery({
      queryKey: ["partnership-nft", "retailer", retailerId],
      enabled: !!retailerId,
      queryFn: async (): Promise<DistributorPartnershipNFT | null> => {
        if (USE_MOCK) {
          await new Promise((r) => setTimeout(r, 300));
          return {
            retailer_id: retailerId!,
            distributor_id: userId,
            mint_address: `${retailerId!.slice(0, 8)}...${retailerId!.slice(-4)}`,
            explorer_url: `https://explorer.solana.com/address/${retailerId}`,
            token_name: "AutoSup Partnership NFT",
            issued_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          };
        }
        const { data } = await api.get<ApiResponse<DistributorPartnershipNFT>>(
          `/blockchain/partnership-nft/distributor/${userId}/${retailerId}`,
        );
        return data.data;
      },
      staleTime: 5 * 60 * 1000,
    });
  }
  ```

---

### P3 — Buat `RetailerCard` component

- [x] **P3.1** `components/retailers/retailer-card.tsx` — Buat component baru

  Mirip `SupplierCard` dan `DistributorCard`. Menampilkan:
  - Nama retailer, kota, segment badge
  - Status (active/inactive/high_risk)
  - Monthly order volume
  - Last order date
  - Props: `retailer: Retailer`, optional `onViewDetail`

  ```tsx
  // Skema component:
  import { Building2 } from "lucide-react";
  import { Badge } from "@/components/ui/badge";
  import type { Retailer } from "@/hooks/useRetailers";

  type Props = {
    retailer: Retailer;
    onViewDetail?: (retailer: Retailer) => void;
  };

  export function RetailerCard({ retailer, onViewDetail }: Props) {
    // Badge tone berdasarkan status
    // Badge tone berdasarkan segment
    // Format monthly_order_volume dan total_purchase_amount
    // Format last_order_at
    // Card layout mirip SupplierCard/DistributorCard
  }
  ```

---

### P4 — Tambah `RetailerNFTBadge` dan `DistributorTrustPanel` di Partnerships Page

- [x] **P4.1** `app/dashboard/partnerships/page.tsx` — Tambah `RetailerNFTBadge` inline component

  ```tsx
  function RetailerNFTBadge({ retailerId }: { retailerId: string }) {
    const { data: nft, isLoading } = useRetailerPartnershipNFT(retailerId);
    if (isLoading || !nft) return null;
    return (
      <div className="flex items-start gap-3 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3">
        <Gem className="mt-0.5 h-4 w-4 shrink-0 text-[#7C3AED]" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[#7C3AED]">{nft.token_name}</p>
          <p className="mt-0.5 font-mono text-xs text-[#64748B] truncate">{nft.mint_address}</p>
        </div>
        <a
          href={nft.explorer_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-medium text-[#7C3AED] hover:underline shrink-0"
        >
          Explorer <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }
  ```

- [x] **P4.2** `app/dashboard/partnerships/page.tsx` — Tambah `DistributorTrustPanel` inline component

  ```tsx
  function DistributorTrustPanel() {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 space-y-4">
          <Badge tone="info" className="w-fit">Trust and partnership</Badge>
          <h3 className="text-lg font-semibold text-[#0F172A]">Partnership trust layer</h3>
          <p className="text-sm leading-6 text-[#64748B]">
            Kemitraan dengan supplier dan retailer dilindungi trust layer on-chain. Partnership NFT diterbitkan saat kemitraan disetujui di kedua arah.
          </p>
        </div>
      </div>
    );
  }
  ```

---

### P5 — Tab view untuk Distributor di Partnerships Page

- [ ] **P5.1** `app/dashboard/partnerships/page.tsx` — Tambah `partnerView` state dan `useRetailers` hook

  ```tsx
  const isDistributor = role === "distributor";
  const [partnerView, setPartnerView] = useState<"suppliers" | "retailers">("suppliers");

  // Fetch retailer partners juga untuk distributor
  const {
    data: retailersData,
    isLoading: isRetailersLoading,
    isError: isRetailersError,
    refetch: refetchRetailers,
  } = useRetailers({ type: "partner" });
  ```

  Import `useRetailers` dan `type Retailer` dari `@/hooks/useRetailers`.
  Import `RetailerCard` dari `@/components/retailers/retailer-card`.
  Import `cn` dari `@/lib/utils`.

- [ ] **P5.2** `app/dashboard/partnerships/page.tsx` — Tab UI untuk distributor

  Tambahkan setelah badge/description section:

  ```tsx
  {isDistributor && (
    <div className="flex gap-2 rounded-lg border border-[#E2E8F0] bg-slate-50 p-1">
      <button
        onClick={() => setPartnerView("suppliers")}
        className={cn(
          "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
          partnerView === "suppliers"
            ? "bg-white text-[#0F172A] shadow-sm"
            : "text-[#64748B] hover:text-[#0F172A]"
        )}
      >
        Supplier Partners
      </button>
      <button
        onClick={() => setPartnerView("retailers")}
        className={cn(
          "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
          partnerView === "retailers"
            ? "bg-white text-[#0F172A] shadow-sm"
            : "text-[#64748B] hover:text-[#0F172A]"
        )}
      >
        Retailer Partners
      </button>
    </div>
  )}
  ```

- [ ] **P5.3** `app/dashboard/partnerships/page.tsx` — Main content rendering per tab

  Logic untuk menentukan partner list yang ditampilkan:

  ```tsx
  // Tentukan data berdasarkan role dan tab
  const isRetailer = role === "retailer";
  const isDistributor = role === "distributor";

  // Retailer: selalu lihat distributor partners
  // Distributor tab "suppliers": lihat supplier partners
  // Distributor tab "retailers": lihat retailer partners

  const displayLoading = isRetailer
    ? isDistributorsLoading
    : isDistributor && partnerView === "retailers"
      ? isRetailersLoading
      : isSuppliersLoading;

  const displayError = isRetailer
    ? isDistributorsError
    : isDistributor && partnerView === "retailers"
      ? isRetailersError
      : isSuppliersError;

  const displayRefetch = isRetailer
    ? refetchDistributors
    : isDistributor && partnerView === "retailers"
      ? refetchRetailers
      : refetchSuppliers;

  const retailers = retailersData?.retailers ?? [];
  ```

  Rendering di main content section:

  ```tsx
  {/* Retailer: lihat distributor partners */}
  {isRetailer && !isLoading && !isError && partners.length > 0 && (
    <div className="grid gap-4">
      {(partners as Distributor[]).map((dist) => (
        <div key={dist.distributor_id} className="space-y-2">
          <DistributorCard
            distributor={dist}
            onViewStock={(d) => { setSelectedDistributor(d); setStockDialogOpen(true); }}
          />
          <DistributorNFTBadge distributorId={dist.distributor_id} />
        </div>
      ))}
    </div>
  )}

  {/* Distributor tab "suppliers": lihat supplier partners */}
  {isDistributor && partnerView === "suppliers" && !isLoading && !isError && suppliers.length > 0 && (
    <div className="grid gap-4">
      {suppliers.map((supplier) => (
        <div key={supplier.supplier_id} className="space-y-2">
          <SupplierCard supplier={supplier} />
          <SupplierNFTBadge supplierId={supplier.supplier_id} />
        </div>
      ))}
    </div>
  )}

  {/* Distributor tab "retailers": lihat retailer partners */}
  {isDistributor && partnerView === "retailers" && !displayLoading && !displayError && retailers.length > 0 && (
    <div className="grid gap-4">
      {retailers.map((retailer) => (
        <div key={retailer.retailer_id} className="space-y-2">
          <RetailerCard retailer={retailer} />
          <RetailerNFTBadge retailerId={retailer.retailer_id} />
        </div>
      ))}
    </div>
  )}

  {/* Empty state */}
  {/* ... handle per role/tab */}
  ```

- [ ] **P5.4** `app/dashboard/partnerships/page.tsx` — Side panel switch

  ```tsx
  // Sebelum:
  {isRetailer ? <RetailerTrustPanel /> : <SuppliersTrustPanel />}

  // Sesudah:
  {isRetailer ? (
    <RetailerTrustPanel />
  ) : isDistributor && partnerView === "retailers" ? (
    <DistributorTrustPanel />
  ) : (
    <SuppliersTrustPanel />
  )}
  ```

- [ ] **P5.5** `app/dashboard/partnerships/page.tsx` — Update header description untuk distributor

  ```tsx
  // Sebelum:
  {isRetailer
    ? "Kelola kemitraan dengan distributor, verifikasi trust layer, dan pantau metrik ekosistem partner."
    : "Kelola lifecycle kemitraan strategis, verifikasi trust layer secara on-chain, dan pantau metrik ekosistem partner secara komprehensif."}

  // Sesudah:
  {isRetailer
    ? "Kelola kemitraan dengan distributor, verifikasi trust layer, dan pantau metrik ekosistem partner."
    : "Kelola kemitraan dengan supplier dan retailer, verifikasi trust layer secara on-chain, dan pantau metrik ekosistem partner secara komprehensif."}
  ```

- [ ] **P5.6** `app/dashboard/partnerships/page.tsx` — Update KPI meta label untuk distributor

  ```tsx
  // Sebelum:
  const partnerLabel = isRetailer ? "Distributor partner aktif" : "Supplier partner aktif";

  // Sesudah:
  const partnerLabel = isRetailer
    ? "Distributor partner aktif"
    : isDistributor && partnerView === "retailers"
      ? "Retailer partner aktif"
      : "Supplier partner aktif";
  ```

- [ ] **P5.7** `app/dashboard/partnerships/page.tsx` — Update empty state text

  ```tsx
  // Sebelum:
  const emptyText = isRetailer
    ? "Cari distributor di halaman Distributors."
    : "Cari supplier di halaman Suppliers.";

  // Sesudah:
  const emptyText = isRetailer
    ? "Cari distributor di halaman Distributors."
    : isDistributor && partnerView === "retailers"
      ? "Belum ada retailer partner. Kelola retailer di halaman Retailers."
      : "Cari supplier di halaman Suppliers.";
  ```

---

### P6 — Update `usePartnershipsSummary` mock untuk Distributor

- [ ] **P6.1** `hooks/usePartnerships.ts` — Update mock insights agar distributor mendapat insights kedua arah

  ```ts
  // Sebelum (untuk non-retailer):
  : [
      { type: "strategic_partner", message: "Supplier X ...", supplier_id: "supp-x-123", urgency: "low" },
      { type: "expiring_contract", message: "Kontrak dengan CV Maju Bersama ...", supplier_id: "supp-maju-123", urgency: "medium" },
    ]

  // Sesudah:
  const isDistributor = role === "distributor";
  const insights = isRetailer
    ? [/* retailer insights - unchanged */]
    : isDistributor
      ? [
          { type: "strategic_partner", message: "CV Maju Bersama adalah supplier andalan dengan tingkat fulfillment 98%.", supplier_id: "supplier-uuid-001", urgency: "low" as const },
          { type: "strategic_partner", message: "Toko Sumber Rejeki adalah retailer terbesar dengan order konsisten setiap minggu.", urgency: "low" as const },
          { type: "expiring_contract", message: "Kontrak partnership dengan Warung Bu Tini akan berakhir dalam 14 hari.", urgency: "medium" as const },
        ]
      : [
          { type: "strategic_partner", message: "Distributor X adalah partner strategis...", distributor_id: "dist-x-123", urgency: "low" as const },
          { type: "expiring_contract", message: "Kontrak dengan PT Distributor Jaya akan berakhir dalam 30 hari.", distributor_id: "dist-jaya-123", urgency: "medium" as const },
        ];
  ```

  Catatan: Insight type sekarang 3-way: retailer, distributor, supplier.

---

## Prioritas Eksekusi

| Batch | Item | Alasan |
|-------|------|--------|
| 1 | P1, P2 | Fondasi — hook & data layer |
| 2 | P3 | Component — RetailerCard |
| 3 | P4, P5, P6 | Integrasi — Partnerships page update |

---

## Summary

| Item | File | Deskripsi |
|------|------|-----------|
| P1.1 | `hooks/useRetailers.ts` | Tambah `type` filter ke RetailerFilters |
| P1.2 | `hooks/useRetailers.ts` | Mock filter partner retailers |
| P1.3 | `hooks/useRetailers.ts` | API query param `type` |
| P2.1 | `hooks/usePartnerships.ts` | Tambah `useRetailerPartnershipNFT` hook |
| P3.1 | `components/retailers/retailer-card.tsx` | Buat RetailerCard component |
| P4.1 | `app/dashboard/partnerships/page.tsx` | Tambah RetailerNFTBadge |
| P4.2 | `app/dashboard/partnerships/page.tsx` | Tambah DistributorTrustPanel |
| P5.1 | `app/dashboard/partnerships/page.tsx` | Tambah tab state & useRetailers hook |
| P5.2 | `app/dashboard/partnerships/page.tsx` | Tab UI untuk distributor |
| P5.3 | `app/dashboard/partnerships/page.tsx` | Main content rendering per tab |
| P5.4 | `app/dashboard/partnerships/page.tsx` | Side panel switch |
| P5.5 | `app/dashboard/partnerships/page.tsx` | Header description mention kedua arah |
| P5.6 | `app/dashboard/partnerships/page.tsx` | KPI meta label per tab |
| P5.7 | `app/dashboard/partnerships/page.tsx` | Empty state text per tab |
| P6.1 | `hooks/usePartnerships.ts` | Update mock insights 3-way |