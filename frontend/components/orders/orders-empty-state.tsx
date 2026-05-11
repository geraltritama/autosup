import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  onCreateOrder?: () => void;
  showCreate?: boolean;
}

export function OrdersEmptyState({ onCreateOrder, showCreate = true }: Props) {
  return (
    <Card className="rounded-2xl border-dashed">
      <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
          <ClipboardList className="h-6 w-6" />
        </div>
        <h3 className="mt-5 text-lg font-semibold text-[#0F172A]">
          No orders to display
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#64748B]">
          When order data is not yet available, this page should still help users understand the next steps to start the ordering workflow.
        </p>
        {showCreate && (
          <Button className="mt-6" onClick={onCreateOrder}>Create Order</Button>
        )}
      </CardContent>
    </Card>
  );
}
