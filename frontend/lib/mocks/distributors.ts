export type Distributor = {
  distributor_id: string;
  name: string;
  business_name: string;
  region: string;
  partnership_status: "partner" | "pending" | "none";
  order_volume: number;
  payment_punctuality: number;
  reputation_score: number;
  total_transactions: number;
  is_active: boolean;
};

export type DistributorPartnershipRequest = {
  request_id: string;
  distributor: {
    id: string;
    name: string;
    business_name: string;
  };
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

export const mockDistributors: Distributor[] = [
  {
    distributor_id: "dist-001",
    name: "PT Nusantara Distribusi",
    business_name: "Nusantara Distribusi",
    region: "Jawa Barat",
    partnership_status: "partner",
    order_volume: 342,
    payment_punctuality: 96,
    reputation_score: 92,
    total_transactions: 1850,
    is_active: true,
  },
  {
    distributor_id: "dist-002",
    name: "CV Maju Bersama",
    business_name: "Maju Bersama",
    region: "Jawa Timur",
    partnership_status: "partner",
    order_volume: 215,
    payment_punctuality: 89,
    reputation_score: 85,
    total_transactions: 920,
    is_active: true,
  },
  {
    distributor_id: "dist-003",
    name: "PT Sumber Makmur",
    business_name: "Sumber Makmur",
    region: "DKI Jakarta",
    partnership_status: "pending",
    order_volume: 0,
    payment_punctuality: 0,
    reputation_score: 78,
    total_transactions: 0,
    is_active: true,
  },
  {
    distributor_id: "dist-004",
    name: "UD Sejahtera Abadi",
    business_name: "Sejahtera Abadi",
    region: "Bali",
    partnership_status: "partner",
    order_volume: 128,
    payment_punctuality: 94,
    reputation_score: 88,
    total_transactions: 640,
    is_active: true,
  },
];

export const mockDistributorRequests: DistributorPartnershipRequest[] = [
  {
    request_id: "dreq-001",
    distributor: { id: "dist-003", name: "PT Sumber Makmur", business_name: "Sumber Makmur" },
    status: "pending",
    created_at: "2026-04-25T10:30:00Z",
  },
  {
    request_id: "dreq-002",
    distributor: { id: "dist-005", name: "CV Logistik Prima", business_name: "Logistik Prima" },
    status: "pending",
    created_at: "2026-04-28T14:00:00Z",
  },
];

type DistributorFilters = {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
};

export function getMockDistributors(filters: DistributorFilters = {}) {
  let result = [...mockDistributors];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.business_name.toLowerCase().includes(q) ||
        d.region.toLowerCase().includes(q),
    );
  }

  if (filters.status && filters.status !== "all") {
    result = result.filter((d) => d.partnership_status === filters.status);
  }

  const partners = mockDistributors.filter((d) => d.partnership_status === "partner");
  const pending = mockDistributors.filter((d) => d.partnership_status === "pending");

  return {
    distributors: result,
    summary: {
      partner_count: partners.length,
      pending_count: pending.length,
      total_order_volume: partners.reduce((sum, d) => sum + d.order_volume, 0),
      avg_punctuality: Math.round(
        partners.reduce((sum, d) => sum + d.payment_punctuality, 0) / (partners.length || 1),
      ),
    },
    pagination: { page: 1, limit: 20, total: result.length },
  };
}

export function getMockDistributorRequests(status?: string) {
  let result = [...mockDistributorRequests];
  if (status) {
    result = result.filter((r) => r.status === status);
  }
  return {
    requests: result,
    pagination: { page: 1, limit: 20, total: result.length },
  };
}
