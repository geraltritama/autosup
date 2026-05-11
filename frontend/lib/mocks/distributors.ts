export type Distributor = {
  distributor_id: string;
  name: string;
  business_name: string;
  region: string;
  partnership_status: "partner" | "pending" | "none";
  order_volume: number;
  payment_punctuality: number;
  avg_delivery_days: number;
  on_time_delivery_rate: number;
  reputation_score: number;
  total_transactions: number;
  is_active: boolean;
  address?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  joined_at?: string;
};

export type DistributorPartnershipRequest = {
  request_id: string;
  distributor: {
    id: string;
    name: string;
    business_name: string;
    region?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    reputation_score?: number;
  };
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  terms?: string;
  proposed_start_date?: string;
  proposed_end_date?: string;
};

export const mockDistributors: Distributor[] = [
  {
    distributor_id: "dist-001",
    name: "PT Nusantara Distribusi",
    business_name: "Nusantara Distribusi",
    address: "Jl. Sudirman No.123, Jakarta Selatan, DKI Jakarta 12160",
    contact_person: "Bpk. Ahmad Wijaya",
    phone: "021-7654321",
    email: "info@nusantara-distribusi.co.id",
    region: "Jawa Barat",
    partnership_status: "partner",
    order_volume: 342,
    payment_punctuality: 96,
    avg_delivery_days: 2,
    on_time_delivery_rate: 95,
    reputation_score: 92,
    total_transactions: 1850,
    is_active: true,
    joined_at: "2025-12-01",
  },
  {
    distributor_id: "dist-002",
    name: "CV Maju Bersama",
    business_name: "Maju Bersama",
    address: "Jl. Pemuda No.45, Surabaya, Jawa Timur 60251",
    contact_person: "Ibu Siti Rahayu",
    phone: "031-1234567",
    email: "marketing@majubersama.co.id",
    region: "Jawa Timur",
    partnership_status: "partner",
    order_volume: 215,
    payment_punctuality: 89,
    avg_delivery_days: 3,
    on_time_delivery_rate: 91,
    reputation_score: 85,
    total_transactions: 920,
    is_active: true,
    joined_at: "2025-10-15",
  },
  {
    distributor_id: "dist-003",
    name: "PT Sumber Makmur",
    business_name: "Sumber Makmur",
    address: "Jl. Thamrin No.78, Jakarta Pusat, DKI Jakarta 10230",
    contact_person: "Pak Budi Santoso",
    phone: "021-9876543",
    email: "budi@sumbermakmur.com",
    region: "DKI Jakarta",
    partnership_status: "pending",
    order_volume: 0,
    payment_punctuality: 0,
    avg_delivery_days: 0,
    on_time_delivery_rate: 0,
    reputation_score: 78,
    total_transactions: 0,
    is_active: true,
    joined_at: undefined,
  },
  {
    distributor_id: "dist-004",
    name: "UD Sejahtera Abadi",
    business_name: "Sejahtera Abadi",
    address: "Jl. Sunset Road No.99, Denpasar, Bali 80361",
    contact_person: "Pak Made Sudira",
    phone: "0361-234567",
    email: "made@sejahteraabadi.com",
    region: "Bali",
    partnership_status: "partner",
    order_volume: 128,
    payment_punctuality: 94,
    avg_delivery_days: 4,
    on_time_delivery_rate: 93,
    reputation_score: 88,
    total_transactions: 640,
    is_active: true,
    joined_at: "2026-01-20",
  },
  {
    distributor_id: "dist-005",
    name: "CV Logistik Prima",
    business_name: "Logistik Prima",
    address: "Jl. Ahmad Yani No.88, Surabaya, Jawa Timur 60231",
    contact_person: "Ibu Dewi Kusuma",
    phone: "031-5551234",
    email: "dewi@logistikprima.co.id",
    region: "Jawa Timur",
    partnership_status: "pending",
    order_volume: 0,
    payment_punctuality: 0,
    avg_delivery_days: 0,
    on_time_delivery_rate: 0,
    reputation_score: 82,
    total_transactions: 0,
    is_active: true,
    joined_at: undefined,
  },
];

export const mockDistributorRequests: DistributorPartnershipRequest[] = [
  {
    request_id: "dreq-001",
    distributor: {
      id: "dist-003",
      name: "PT Sumber Makmur",
      business_name: "Sumber Makmur",
      region: "DKI Jakarta",
      contact_person: "Pak Budi Santoso",
      phone: "021-9876543",
      email: "budi@sumbermakmur.com",
      reputation_score: 78,
    },
    status: "pending",
    created_at: "2026-04-25T10:30:00Z",
    terms: "Supply agreement for automotive parts and components with 30-day payment term. Distributor will handle logistics and last-mile delivery.",
    proposed_start_date: "2026-05-01",
    proposed_end_date: "2027-04-30",
  },
  {
    request_id: "dreq-002",
    distributor: {
      id: "dist-005",
      name: "CV Logistik Prima",
      business_name: "Logistik Prima",
      region: "Jawa Timur",
      contact_person: "Ibu Dewi Kusuma",
      phone: "031-5551234",
      email: "dewi@logistikprima.co.id",
      reputation_score: 82,
    },
    status: "pending",
    created_at: "2026-04-28T14:00:00Z",
    terms: "Partnership for spare parts product distribution in East Java region. Minimum order 50 units per month.",
    proposed_start_date: "2026-06-01",
    proposed_end_date: "2027-05-31",
  },
];

type DistributorFilters = {
  search?: string;
  status?: string;
  type?: string;
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

  if (filters.type === "partner") {
    result = result.filter((d) => d.partnership_status === "partner");
  } else if (filters.status && filters.status !== "all") {
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
      avg_delivery_days: Math.round(
        partners.reduce((sum, d) => sum + d.avg_delivery_days, 0) / (partners.length || 1) * 10,
      ) / 10,
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
