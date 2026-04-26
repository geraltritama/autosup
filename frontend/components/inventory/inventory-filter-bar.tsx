import { Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function InventoryFilterBar() {
  return (
    <Card className="rounded-2xl">
      <CardContent className="grid gap-3 p-4 lg:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input className="pl-10" placeholder="Search item name..." />
        </div>

        <select className="h-11 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE]">
          <option>All categories</option>
          <option>Bahan baku</option>
          <option>Packaging</option>
          <option>Produk jadi</option>
        </select>

        <select className="h-11 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE]">
          <option>All status</option>
          <option>in_stock</option>
          <option>low_stock</option>
          <option>out_of_stock</option>
        </select>

        <Button className="gap-2" variant="secondary">
          <Filter className="h-4 w-4" />
          Filters
        </Button>
      </CardContent>
    </Card>
  );
}
