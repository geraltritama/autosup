import { cn } from "@/lib/utils";

export function MockBarChart({
  data,
}: {
  data: Array<{ label: string; value: number; active?: boolean }>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex h-48 items-end gap-3">
        {data.map((item) => (
          <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-40 w-full items-end">
              <div
                className={cn(
                  "w-full rounded-t-xl",
                  item.active ? "bg-[#3B82F6]" : "bg-[#CBD5E1]",
                )}
                style={{ height: `${item.value}%` }}
              />
            </div>
            <span className="text-xs text-[#64748B]">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
