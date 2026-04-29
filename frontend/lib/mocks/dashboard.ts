import type { DashboardSummary } from "@/hooks/useDashboard";

export const mockDistributorSummary: DashboardSummary = {
  role: "distributor",
  inventory: { total_items: 24, low_stock_count: 3, out_of_stock_count: 1 },
  orders: { active_orders: 5, pending_orders: 2, completed_this_month: 18 },
  suppliers: { partner_count: 8, pending_requests: 1 },
  ai_insights: [
    {
      type: "restock_alert",
      message: "Tepung Terigu hampir habis. Disarankan restock 100 kg dari CV Maju Bersama.",
      urgency: "high",
      item_id: "item-uuid-001",
    },
    {
      type: "demand_forecast",
      message: "Permintaan Gula Pasir diprediksi naik 20% minggu depan.",
      urgency: "medium",
      item_id: "item-uuid-002",
    },
  ],
};

export const mockSupplierSummary: DashboardSummary = {
  role: "supplier",
  products: { total_active: 45, low_stock_count: 2, out_of_stock_count: 0 },
  orders: { incoming_orders: 12, processing: 5, completed_this_month: 30 },
  partners: { distributor_count: 15, pending_requests: 3 },
  ai_insights: [
    {
      type: "demand_alert",
      message: "Permintaan Tepung Terigu meningkat 20% minggu ini dari distributor partner.",
      urgency: "medium",
      item_id: "item-uuid-001",
    },
  ],
};
