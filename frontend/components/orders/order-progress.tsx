import { cn } from "@/lib/utils";
import { type OrderStatus } from "@/components/orders/order-status-badge";

const orderSteps: Array<Exclude<OrderStatus, "cancelled">> = [
  "pending",
  "processing",
  "shipping",
  "delivered",
];

const stepLabels: Record<Exclude<OrderStatus, "cancelled">, string> = {
  pending: "Pending",
  processing: "Processing",
  shipping: "Shipping",
  delivered: "Delivered",
};

export function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
        Order cancelled
      </div>
    );
  }

  const activeIndex = orderSteps.indexOf(status);

  return (
    <div className="grid grid-cols-4 gap-2">
      {orderSteps.map((step, index) => {
        const isActive = index <= activeIndex;

        return (
          <div key={step} className="space-y-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "h-2 flex-1 rounded-full",
                  isActive ? "bg-[#3B82F6]" : "bg-slate-200",
                )}
              />
            </div>
            <p
              className={cn(
                "text-xs font-medium",
                isActive ? "text-[#0F172A]" : "text-[#94A3B8]",
              )}
            >
              {stepLabels[step]}
            </p>
          </div>
        );
      })}
    </div>
  );
}
