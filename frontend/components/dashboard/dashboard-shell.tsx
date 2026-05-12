"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  Boxes,
  CreditCard,
  Handshake,
  LayoutDashboard,
  LineChart,
  LogOut,
  Map,
  Menu,
  PackageSearch,
  Settings,
  TrendingUp,
  TruckIcon,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore, type UserRole } from "@/store/useAuthStore";
import { useLogout } from "@/hooks/useAuth";

function getNavigation(role?: UserRole) {
  const base = [
    { href: "/dashboard/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/inventory", label: "Inventory", icon: Boxes },
    { href: "/dashboard/orders", label: "Orders", icon: PackageSearch },
  ];

  if (role === "distributor") {
    return [
      ...base,
      { href: "/dashboard/suppliers", label: "Suppliers", icon: BarChart3 },
      { href: "/dashboard/partnerships", label: "Partnerships", icon: Handshake },
      { href: "/dashboard/retailers", label: "Retailers", icon: Users },
      { href: "/dashboard/credit", label: "Credit Line", icon: CreditCard },
      { href: "/dashboard/payment", label: "Payment", icon: Wallet },
      { href: "/dashboard/logistics", label: "Logistics", icon: TruckIcon },
      { href: "/dashboard/ai-agents", label: "AI Agents", icon: Bot },
      { href: "/dashboard/analytics", label: "Analytics", icon: LineChart },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ];
  }

  if (role === "retailer") {
    return [
      ...base,
      { href: "/dashboard/distributors", label: "Distributors", icon: BarChart3 },
      { href: "/dashboard/partnerships", label: "Partnership", icon: Handshake },
      { href: "/dashboard/payment", label: "Payment", icon: Wallet },
      { href: "/dashboard/ai-agents", label: "AI Agents", icon: Bot },
      { href: "/dashboard/analytics", label: "Analytics", icon: LineChart },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ];
  }

  // supplier
  return [
    ...base,
    { href: "/dashboard/distributors", label: "Distributors", icon: Handshake },
    { href: "/dashboard/logistics", label: "Logistics", icon: TruckIcon },
    { href: "/dashboard/demand", label: "Demand Intel", icon: TrendingUp },
    { href: "/dashboard/geo", label: "Geo Mapping", icon: Map },
    { href: "/dashboard/ai-agents", label: "AI Agents", icon: Bot },
    { href: "/dashboard/analytics", label: "Analytics", icon: LineChart },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
  ];
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const { logout } = useLogout();
  const [mobileOpen, setMobileOpen] = useState(false);

  const workspaceLabel =
    user?.role === "supplier"
      ? "Supplier Workspace"
      : user?.role === "retailer"
        ? "Retailer Workspace"
        : "Distributor Workspace";

  const navItems = getNavigation(user?.role);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#E2E8F0] bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="AUTOSUP" width={32} height={32} className="rounded-lg" />
          <Image src="/styletulisan.png" alt="AUTOSUP" width={100} height={24} className="h-6 w-auto" />
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-lg p-2 text-[#64748B] hover:bg-slate-50">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile nav overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 top-[57px] z-30 bg-white overflow-y-auto lg:hidden">
          <nav className="space-y-1 px-4 py-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    isActive ? "bg-[#155DFC] text-white" : "text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={() => { setMobileOpen(false); logout(); }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#64748B] hover:bg-red-50 hover:text-[#EF4444]"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </nav>
        </div>
      )}

      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-72 flex-col border-r border-[#E2E8F0] bg-white px-5 py-6 lg:flex">
          {/* Brand */}
          <div className="flex flex-col gap-1">
            <Image src="/styletulisan.png" alt="AUTOSUP" width={140} height={32} className="h-8 w-auto" />
            <p className="text-xs font-medium text-[#64748B]">{workspaceLabel}</p>
          </div>

          {/* Nav */}
          <nav className="mt-8 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    isActive
                      ? "bg-[#155DFC] text-white"
                      : "text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User info */}
          {user && (
            <div className="mt-6 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <p className="text-sm font-semibold text-[#0F172A]">{user.business_name}</p>
              <p className="mt-0.5 text-xs text-[#64748B]">{user.email}</p>
              <span className="mt-2 inline-flex rounded-full bg-[#DBEAFE] px-2 py-0.5 text-xs font-medium text-[#2563EB] capitalize">
                {user.role}
              </span>
            </div>
          )}

          {/* Logout */}
          <div className="mt-auto">
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#64748B] transition hover:bg-red-50 hover:text-[#EF4444]"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 overflow-x-hidden">{children}</div>
      </div>
    </div>
  );
}
