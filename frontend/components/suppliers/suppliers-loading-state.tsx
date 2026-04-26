import { Card, CardContent } from "@/components/ui/card";

export function SuppliersLoadingState() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="rounded-2xl">
          <CardContent className="space-y-4 p-5">
            <div className="flex animate-pulse items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="h-5 w-40 rounded bg-slate-200" />
                <div className="h-4 w-28 rounded bg-slate-200" />
              </div>
              <div className="h-12 w-16 rounded-xl bg-slate-200" />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((__, itemIndex) => (
                <div key={itemIndex} className="h-20 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
            <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
            <div className="flex gap-3">
              <div className="h-11 w-36 animate-pulse rounded-lg bg-slate-200" />
              <div className="h-11 w-28 animate-pulse rounded-lg bg-slate-200" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
