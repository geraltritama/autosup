import type { Order, OrderDetail, OrderStatus, OrdersResponse } from "@/hooks/useOrders";
import { useAuthStore } from "@/store/useAuthStore";

export const mockOrders: OrderDetail[] = [
  {
    order_id: "order-uuid-001",
    order_number: "ORD-2026-001",
    buyer: { id: "dist-001", name: "PT Nusantara Distribusi", role: "distributor" },
    seller: { id: "supplier-uuid-001", name: "CV Maju Bersama", role: "supplier" },
    items: [
      { item_name: "Wheat Flour", qty: 100, unit: "kg", price_per_unit: 12000, subtotal: 1200000 },
    ],
    total_amount: 1200000,
    status: "processing",
    escrow_status: "held",
    delivery_address: "Jl. Merdeka No.10, Jakarta Pusat",
    notes: "Tolong dibungkus rapi",
    estimated_delivery: "2026-05-02",
    status_history: [
      { status: "pending", changed_at: "2026-04-28T09:00:00Z" },
      { status: "processing", changed_at: "2026-04-28T11:30:00Z" },
    ],
    created_at: "2026-04-28T09:00:00Z",
    updated_at: "2026-04-28T11:30:00Z",
  },
  {
    order_id: "order-uuid-002",
    order_number: "ORD-2026-002",
    buyer: { id: "dist-001", name: "PT Nusantara Distribusi", role: "distributor" },
    seller: { id: "supplier-uuid-003", name: "Nusantara Supply Co.", role: "supplier" },
    items: [
      { item_name: "Cup Packaging 16oz", qty: 500, unit: "pcs", price_per_unit: 800, subtotal: 400000 },
      { item_name: "Sedotan Kertas", qty: 1000, unit: "pcs", price_per_unit: 150, subtotal: 150000 },
    ],
    total_amount: 550000,
    status: "shipping",
    escrow_status: "held",
    delivery_address: "Jl. Sudirman No.5, Jakarta Selatan",
    notes: null,
    estimated_delivery: "2026-05-01",
    shipping_info: {
      courier: "JNE",
      tracking_number: "JNE123456789",
      shipped_at: "2026-04-28T07:00:00Z",
      tracking_url: "https://jne.co.id/tracking/JNE123456789",
    },
    status_history: [
      { status: "pending", changed_at: "2026-04-27T08:00:00Z" },
      { status: "processing", changed_at: "2026-04-27T14:00:00Z" },
      { status: "shipping", changed_at: "2026-04-28T07:00:00Z" },
    ],
    created_at: "2026-04-27T08:00:00Z",
    updated_at: "2026-04-28T07:00:00Z",
  },
  {
    order_id: "order-uuid-003",
    order_number: "ORD-2026-003",
    buyer: { id: "dist-001", name: "PT Nusantara Distribusi", role: "distributor" },
    seller: { id: "supplier-uuid-001", name: "CV Maju Bersama", role: "supplier" },
    items: [
      { item_name: "Sugar", qty: 50, unit: "kg", price_per_unit: 15000, subtotal: 750000 },
      { item_name: "Cooking Oil", qty: 20, unit: "liter", price_per_unit: 18000, subtotal: 360000 },
    ],
    total_amount: 1110000,
    status: "delivered",
    escrow_status: "released",
    delivery_address: "Jl. Merdeka No.10, Jakarta Pusat",
    notes: "Urgent, out of stock",
    estimated_delivery: "2026-04-25",
    shipping_info: {
      courier: "GrabExpress",
      tracking_number: "GRB987654321",
      shipped_at: "2026-04-23T08:00:00Z",
      tracking_url: "https://grab.com/track/GRB987654321",
    },
    status_history: [
      { status: "pending", changed_at: "2026-04-22T10:00:00Z" },
      { status: "processing", changed_at: "2026-04-22T13:00:00Z" },
      { status: "shipping", changed_at: "2026-04-23T08:00:00Z" },
      { status: "delivered", changed_at: "2026-04-25T14:00:00Z" },
    ],
    created_at: "2026-04-22T10:00:00Z",
    updated_at: "2026-04-25T14:00:00Z",
  },
  {
    order_id: "order-uuid-004",
    order_number: "ORD-2026-004",
    buyer: { id: "dist-002", name: "UD Sejahtera Abadi", role: "distributor" },
    seller: { id: "supplier-uuid-001", name: "CV Maju Bersama", role: "supplier" },
    items: [
      { item_name: "Brown Sugar Syrup", qty: 24, unit: "bottle", price_per_unit: 35000, subtotal: 840000 },
    ],
    total_amount: 840000,
    status: "pending",
    escrow_status: "held",
    delivery_address: "Jl. Gatot Subroto No.88, Jakarta",
    notes: null,
    estimated_delivery: "2026-05-03",
    status_history: [
      { status: "pending", changed_at: "2026-04-29T08:00:00Z" },
    ],
    created_at: "2026-04-29T08:00:00Z",
    updated_at: "2026-04-29T08:00:00Z",
  },
  {
    order_id: "order-uuid-005",
    order_number: "ORD-2026-005",
    buyer: { id: "dist-001", name: "PT Nusantara Distribusi", role: "distributor" },
    seller: { id: "supplier-uuid-003", name: "Nusantara Supply Co.", role: "supplier" },
    items: [
      { item_name: "Kotak Dus 30x30", qty: 200, unit: "pcs", price_per_unit: 2500, subtotal: 500000 },
    ],
    total_amount: 500000,
    status: "cancelled",
    escrow_status: "refunded",
    delivery_address: "Jl. Sudirman No.5, Jakarta Selatan",
    notes: "Cancelled due to supplier stock unavailability",
    estimated_delivery: "2026-04-30",
    status_history: [
      { status: "pending", changed_at: "2026-04-26T09:00:00Z" },
      { status: "cancelled", changed_at: "2026-04-26T15:00:00Z" },
    ],
    created_at: "2026-04-26T09:00:00Z",
    updated_at: "2026-04-26T15:00:00Z",
  },
  {
    order_id: "order-uuid-006",
    order_number: "ORD-2026-006",
    buyer: { id: "dist-002", name: "UD Sejahtera Abadi", role: "distributor" },
    seller: { id: "supplier-uuid-001", name: "CV Maju Bersama", role: "supplier" },
    items: [
      { item_name: "Wheat Flour", qty: 200, unit: "kg", price_per_unit: 12000, subtotal: 2400000 },
      { item_name: "Sugar", qty: 100, unit: "kg", price_per_unit: 15000, subtotal: 1500000 },
    ],
    total_amount: 3900000,
    status: "delivered",
    escrow_status: "released",
    delivery_address: "Jl. Gatot Subroto No.88, Jakarta",
    notes: null,
    estimated_delivery: "2026-04-20",
    shipping_info: {
      courier: "J&T Express",
      tracking_number: "JT1234567890",
      shipped_at: "2026-04-18T08:00:00Z",
      tracking_url: "https://jtexpress.id/track/JT1234567890",
    },
    status_history: [
      { status: "pending", changed_at: "2026-04-17T07:00:00Z" },
      { status: "processing", changed_at: "2026-04-17T10:00:00Z" },
      { status: "shipping", changed_at: "2026-04-18T08:00:00Z" },
      { status: "delivered", changed_at: "2026-04-20T13:00:00Z" },
    ],
    created_at: "2026-04-17T07:00:00Z",
    updated_at: "2026-04-20T13:00:00Z",
  },
  {
    order_id: "order-uuid-007",
    order_number: "ORD-2026-007",
    buyer: { id: "retailer-uuid-001", name: "Toko Sumber Rejeki", role: "retailer" },
    seller: { id: "dist-001", name: "PT Nusantara Distribusi", role: "distributor" },
    items: [
      { item_name: "Arabica Coffee", qty: 30, unit: "kg", price_per_unit: 85000, subtotal: 2550000 },
      { item_name: "Sugar", qty: 20, unit: "kg", price_per_unit: 16000, subtotal: 320000 },
    ],
    total_amount: 2870000,
    status: "pending",
    escrow_status: "held",
    delivery_address: "Jl. Hayam Wuruk No.15, Jakarta Barat",
    notes: "Please send today if possible",
    estimated_delivery: "2026-05-04",
    status_history: [
      { status: "pending", changed_at: "2026-04-30T10:00:00Z" },
    ],
    created_at: "2026-04-30T10:00:00Z",
    updated_at: "2026-04-30T10:00:00Z",
  },
  {
    order_id: "order-uuid-008",
    order_number: "ORD-2026-008",
    buyer: { id: "retailer-uuid-002", name: "Warung Bu Tini", role: "retailer" },
    seller: { id: "dist-004", name: "UD Sejahtera Abadi", role: "distributor" },
    items: [
      { item_name: "Sabun Cuci", qty: 100, unit: "pcs", price_per_unit: 5000, subtotal: 500000 },
    ],
    total_amount: 500000,
    status: "shipping",
    escrow_status: "held",
    delivery_address: "Jl. Hayam Wuruk No.15, Jakarta Barat",
    notes: null,
    estimated_delivery: "2026-05-01",
    shipping_info: {
      courier: "Gojek",
      tracking_number: "GOJ12345678",
      shipped_at: "2026-04-29T09:00:00Z",
      tracking_url: "https://gojek.com/track/GOJ12345678",
    },
    status_history: [
      { status: "pending", changed_at: "2026-04-28T14:00:00Z" },
      { status: "processing", changed_at: "2026-04-28T16:00:00Z" },
      { status: "shipping", changed_at: "2026-04-29T09:00:00Z" },
    ],
    created_at: "2026-04-28T14:00:00Z",
    updated_at: "2026-04-29T09:00:00Z",
  },
  // M2.1: Orders from distributor (buyer) to supplier (seller)
  {
    order_id: "order-uuid-009",
    order_number: "ORD-2026-009",
    buyer: { id: "dist-003", name: "PT Indo Logistic", role: "distributor" },
    seller: { id: "supplier-uuid-001", name: "CV Maju Bersama", role: "supplier" },
    items: [
      { item_name: "Ground Coffee", qty: 50, unit: "kg", price_per_unit: 45000, subtotal: 2250000 },
    ],
    total_amount: 2250000,
    status: "processing",
    escrow_status: "held",
    delivery_address: "Jl. Industri Raya No.15, Jakarta",
    notes: "Please send quickly",
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
    status: "shipping",
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
      { status: "shipping", changed_at: "2026-04-30T09:00:00Z" },
    ],
    created_at: "2026-04-28T11:00:00Z",
    updated_at: "2026-04-30T09:00:00Z",
  },
  // M4: Orders from distributor to retailer
  {
    order_id: "order-uuid-011",
    order_number: "ORD-2026-011",
    buyer: { id: "retailer-uuid-003", name: "Restoran Padang Jaya", role: "retailer" },
    seller: { id: "dist-001", name: "PT Nusantara Distribusi", role: "distributor" },
    items: [
      { item_name: "Mie Instant", qty: 100, unit: "dus", price_per_unit: 25000, subtotal: 2500000 },
      { item_name: "Cooking Oil", qty: 50, unit: "liter", price_per_unit: 16000, subtotal: 800000 },
    ],
    total_amount: 3300000,
    status: "delivered",
    escrow_status: "released",
    delivery_address: "Jl. Braga No.45, Bandung",
    notes: "Thank you",
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
      { status: "shipping", changed_at: "2026-04-20T08:00:00Z" },
      { status: "delivered", changed_at: "2026-04-22T14:00:00Z" },
    ],
    created_at: "2026-04-18T09:00:00Z",
    updated_at: "2026-04-22T14:00:00Z",
  },
  {
    order_id: "order-uuid-012",
    order_number: "ORD-2026-012",
    buyer: { id: "retailer-uuid-004", name: "Bakery Sweet Corner", role: "retailer" },
    seller: { id: "dist-002", name: "UD Sejahtera Abadi", role: "distributor" },
    items: [
      { item_name: "Wheat Flour", qty: 30, unit: "karung", price_per_unit: 180000, subtotal: 5400000 },
    ],
    total_amount: 5400000,
    status: "shipping",
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
      { status: "shipping", changed_at: "2026-04-30T10:00:00Z" },
    ],
    created_at: "2026-04-28T08:00:00Z",
    updated_at: "2026-04-30T10:00:00Z",
  },
];

export function getMockOrders(params: {
  status?: OrderStatus;
  role?: "buyer" | "seller";
  search?: string;
  page?: number;
  limit?: number;
}): OrdersResponse {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let orders: Order[] = mockOrders.map(({ status_history: _sh, notes: _n, ...order }) => order);

  if (params.status) {
    orders = orders.filter((o) => o.status === params.status);
  }

  const currentUser = useAuthStore.getState().user;
  if (params.role === "buyer" && currentUser) {
    orders = orders.filter((o) => o.buyer.role === currentUser.role);
  }
  if (params.role === "seller" && currentUser) {
    orders = orders.filter((o) => o.seller.role === currentUser.role);
  }

  const summarySource = params.role && currentUser
    ? orders
    : mockOrders;
  const limit = params.limit ?? 20;
  const page = params.page ?? 1;
  const total = orders.length;
  const start = (page - 1) * limit;
  orders = orders.slice(start, start + limit);

  const summary = {
    total_orders: summarySource.length,
    active_orders: summarySource.filter((o) =>
      ["pending", "processing", "shipping"].includes(o.status)
    ).length,
    pending_orders: summarySource.filter((o) => o.status === "pending").length,
    completed_orders: summarySource.filter((o) => o.status === "delivered").length,
    cancelled_orders: summarySource.filter((o) => o.status === "cancelled").length,
  };

  return { orders, summary, pagination: { page, limit, total } };
}

export function getMockOrderDetail(orderId: string): OrderDetail | null {
  return mockOrders.find((o) => o.order_id === orderId) ?? null;
}
