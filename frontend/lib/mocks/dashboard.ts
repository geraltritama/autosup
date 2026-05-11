import type { DashboardSummary } from "@/hooks/useDashboard";

export const mockDistributorSummary: DashboardSummary = {
  role: "distributor",
  inventory: { total_items: 24, low_stock_count: 3, out_of_stock_count: 1 },
  orders: { active_orders: 5, pending_orders: 2, completed_this_month: 18 },
  suppliers: { partner_count: 8, pending_requests: 1 },
  retailers: { partner_count: 12, pending_requests: 2 },
  ai_insights: [
    {
      type: "restock_alert",
      message: "Wheat Flour is almost out of stock. Recommended restock 100 kg from CV Maju Bersama.",
      urgency: "high",
      item_id: "item-uuid-001",
    },
    {
      type: "demand_forecast",
      message: "Sugar demand predicted to increase 20% next week.",
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
      message: "Wheat Flour demand increased 20% this week from partner distributors.",
      urgency: "medium",
      item_id: "item-uuid-001",
    },
  ],
};

export const mockRetailerSummary: DashboardSummary = {
  role: "retailer",
  inventory: { total_items: 38, low_stock_count: 5, out_of_stock_count: 2 },
  orders: {
    active_orders: 3,
    pending_approval: 1,
    in_transit: 2,
    completed_this_month: 14,
    order_accuracy_rate: 97,
  },
  spending: {
    total_outstanding: 4800000,
    monthly_spending: 12500000,
    available_credit: 5000000,
    upcoming_due_payments: 1,
    payment_success_rate: 98,
  },
  distributors: {
    active_partnered: 4,
    pending_requests: 1,
    average_reliability_score: 91,
    avg_delivery_time: 2,
  },
  forecast_accuracy_pct: 84,
  ai_insights: [
    {
      type: "restock_alert",
      message: "Arabica Coffee only 2 kg left, below minimum 10 kg. Restock immediately from Distributor Nusantara.",
      urgency: "high",
      item_id: "item-uuid-r01",
    },
    {
      type: "purchasing_optimization",
      message: "Combine detergent + beverage order into one PO to save ~12% shipping costs.",
      urgency: "medium",
      item_id: "item-uuid-r02",
    },
    {
      type: "cash_flow_recommendation",
      message: "Delay non-essential invoice payments by 3 days to maintain cash flow this week.",
      urgency: "low",
      item_id: "item-uuid-r03",
    },
  ],
};
