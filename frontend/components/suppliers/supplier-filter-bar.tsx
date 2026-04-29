"use client";

import { Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Props = {
  search: string;
  type: string;
  onSearchChange: (v: string) => void;
  onTypeChange: (v: string) => void;
  onReset: () => void;
};

export function SupplierFilterBar({ search, type, onSearchChange, onTypeChange, onReset }: Props) {
  const hasFilter = search || type;

  return (
    <Card className="rounded-2xl">
      <CardContent className="grid gap-3 p-4 lg:grid-cols-[1.6fr_0.8fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            className="pl-10"
            placeholder="Search supplier name or category..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <select
          className="h-11 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE]"
          value={type}
          onChange={(e) => onTypeChange(e.target.value)}
        >
          <option value="">All types</option>
          <option value="partner">Partner</option>
          <option value="discover">Discover</option>
        </select>

        <Button className="gap-2" variant="secondary" onClick={onReset} disabled={!hasFilter}>
          <Filter className="h-4 w-4" />
          Reset
        </Button>
      </CardContent>
    </Card>
  );
}
