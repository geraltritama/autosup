import Link from "next/link";
import { BarChart3, Boxes, LayoutDashboard, PackageSearch, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  {
    href: "/dashboard/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/inventory",
    label: "Inventory",
    icon: Boxes,
  },
  {
    href: "/dashboard/orders",
    label: "Orders",
    icon: PackageSearch,
  },
  {
    href: "/dashboard/suppliers",
    label: "Suppliers",
    icon: BarChart3,
  },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-72 border-r border-[#E2E8F0] bg-white px-5 py-6 lg:block">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0F172A] text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#64748B]">
                AUTOSUP
              </p>
              <p className="text-sm font-semibold text-[#0F172A]">Supplier Workspace</p>
            </div>
          </div>

          <nav className="mt-8 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === "/dashboard/dashboard";

              return (
                <Link
                  key={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    isActive
                      ? "bg-[#EFF6FF] text-[#2563EB]"
                      : "text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A]",
                  )}
                  href={item.href}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-10 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <p className="text-sm font-semibold text-[#0F172A]">Automation monitor</p>
            <p className="mt-1 text-sm leading-6 text-[#64748B]">
              AI insights, partnership trust, dan order signals akan hidup di sini saat integrasi data selesai.
            </p>
          </div>

          <button className="mt-auto flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#64748B] transition hover:bg-slate-50 hover:text-[#0F172A]">
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
