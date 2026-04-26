import { cn } from "@/lib/utils";

export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[#0F172A]">{title}</h2>
        {description ? (
          <p className="text-sm text-[#64748B]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
