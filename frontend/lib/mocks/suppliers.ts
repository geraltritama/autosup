import type { Supplier, PartnershipRequest, SuppliersResponse, PartnershipRequestsResponse } from "@/hooks/useSuppliers";

export const mockSuppliers: Supplier[] = [
  {
    supplier_id: "supplier-uuid-001",
    name: "CV Maju Bersama",
    category: "bahan_makanan",
    type: "partner",
    reputation_score: 92,
    total_transactions: 48,
    on_time_delivery_rate: 95,
    wallet_address: "So1ana...xyz",
    is_active: true,
  },
  {
    supplier_id: "supplier-uuid-002",
    name: "PT Sejahtera Abadi",
    category: "packaging",
    type: "discover",
    reputation_score: 88,
    total_transactions: 31,
    on_time_delivery_rate: 91,
    wallet_address: "So1ana...ab2",
    is_active: true,
  },
  {
    supplier_id: "supplier-uuid-003",
    name: "Nusantara Supply Co.",
    category: "bahan_produksi",
    type: "partner",
    reputation_score: 90,
    total_transactions: 63,
    on_time_delivery_rate: 93,
    wallet_address: "So1ana...pn7",
    is_active: true,
  },
  {
    supplier_id: "supplier-uuid-004",
    name: "Prima Kitchen Goods",
    category: "bahan_makanan",
    type: "discover",
    reputation_score: 79,
    total_transactions: 12,
    on_time_delivery_rate: 84,
    wallet_address: "So1ana...zt4",
    is_active: false,
  },
  {
    supplier_id: "supplier-uuid-005",
    name: "Indo Packaging Utama",
    category: "packaging",
    type: "discover",
    reputation_score: 85,
    total_transactions: 20,
    on_time_delivery_rate: 88,
    wallet_address: "So1ana...kp9",
    is_active: true,
  },
];

export const mockPartnershipRequests: PartnershipRequest[] = [
  {
    request_id: "req-uuid-001",
    distributor: {
      id: "user-uuid-001",
      name: "Budi Santoso",
      business_name: "Toko Budi Jaya",
    },
    status: "pending",
    created_at: "2025-07-10T11:00:00Z",
  },
  {
    request_id: "req-uuid-002",
    distributor: {
      id: "user-uuid-002",
      name: "Siti Rahayu",
      business_name: "UD Makmur Sejahtera",
    },
    status: "pending",
    created_at: "2025-07-09T08:30:00Z",
  },
  {
    request_id: "req-uuid-003",
    distributor: {
      id: "user-uuid-003",
      name: "Agus Wibowo",
      business_name: "CV Mitra Tani",
    },
    status: "accepted",
    created_at: "2025-07-05T14:00:00Z",
  },
];

type SupplierFilters = { search?: string; type?: string; page?: number; limit?: number };

export function getMockSuppliers(filters: SupplierFilters = {}): SuppliersResponse {
  let items = [...mockSuppliers];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    items = items.filter((s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
  }
  if (filters.type) {
    items = items.filter((s) => s.type === filters.type);
  }

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 10;
  const total = items.length;
  const paginated = items.slice((page - 1) * limit, page * limit);

  const partnerCount = mockSuppliers.filter((s) => s.type === "partner").length;
  const discoverCount = mockSuppliers.filter((s) => s.type === "discover").length;
  const pendingCount = mockPartnershipRequests.filter((r) => r.status === "pending").length;

  return {
    suppliers: paginated,
    summary: {
      partner_count: partnerCount,
      discover_count: discoverCount,
      pending_requests: pendingCount,
    },
    pagination: { page, limit, total },
  };
}

export function getMockPartnershipRequests(status?: string): PartnershipRequestsResponse {
  const items = status
    ? mockPartnershipRequests.filter((r) => r.status === status)
    : mockPartnershipRequests;

  return {
    requests: items,
    pagination: { page: 1, limit: 10, total: items.length },
  };
}
