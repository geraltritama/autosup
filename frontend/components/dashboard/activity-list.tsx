import { ArrowUpRight, PackageCheck, ScanSearch, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const iconMap = {
  order: PackageCheck,
  demand: ArrowUpRight,
  shipment: Truck,
  partner: ScanSearch,
};

export function ActivityList({
  items,
}: {
  items: Array<{
    id: string;
    type: keyof typeof iconMap;
    title: string;
    description: string;
    time: string;
  }>;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Distributor activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => {
          const Icon = iconMap[item.type];

          return (
            <div key={item.id} className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl bg-slate-100 p-2 text-[#0F172A]">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#0F172A]">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-[#64748B]">{item.description}</p>
              </div>
              <span className="whitespace-nowrap text-xs text-[#94A3B8]">{item.time}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
