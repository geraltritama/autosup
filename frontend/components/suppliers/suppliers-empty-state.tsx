import { Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = { onExplore?: () => void };

export function SuppliersEmptyState({ onExplore }: Props) {
  return (
    <Card className="rounded-2xl border-dashed">
      <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
          <Network className="h-6 w-6" />
        </div>
        <h3 className="mt-5 text-lg font-semibold text-[#0F172A]">
          No suppliers found
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#64748B]">
          Try changing your search filter or explore new suppliers to start your supply chain partnership.
        </p>
        <Button className="mt-6" onClick={onExplore}>Explore Suppliers</Button>
      </CardContent>
    </Card>
  );
}
