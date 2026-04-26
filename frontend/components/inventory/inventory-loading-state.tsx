import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function InventoryLoadingState() {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="grid animate-pulse gap-3 rounded-xl border border-[#E2E8F0] p-4 md:grid-cols-8"
            >
              {Array.from({ length: 8 }).map((__, cellIndex) => (
                <div
                  key={cellIndex}
                  className="h-4 rounded bg-slate-200"
                />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
