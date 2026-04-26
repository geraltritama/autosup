import { Card, CardContent } from "@/components/ui/card";

export function OrdersLoadingState() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="rounded-2xl">
          <CardContent className="space-y-5 p-5">
            <div className="flex animate-pulse items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="h-5 w-32 rounded bg-slate-200" />
                <div className="h-4 w-44 rounded bg-slate-200" />
              </div>
              <div className="h-14 w-28 rounded-xl bg-slate-200" />
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((__, stepIndex) => (
                <div key={stepIndex} className="space-y-2">
                  <div className="h-2 animate-pulse rounded-full bg-slate-200" />
                  <div className="h-3 animate-pulse rounded bg-slate-200" />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <div className="h-11 w-32 animate-pulse rounded-lg bg-slate-200" />
              <div className="h-11 w-36 animate-pulse rounded-lg bg-slate-200" />
              <div className="h-11 w-32 animate-pulse rounded-lg bg-slate-200" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
