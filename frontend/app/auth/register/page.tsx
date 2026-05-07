import { ShieldEllipsis, Building2, TrendingUp, UserPlus } from "lucide-react";
import { RegisterForm } from "@/components/auth/register-form";

const highlights = [
  {
    icon: TrendingUp,
    title: "Demand-first operations",
    description: "See what your partners need, what's running low, and what's coming — all in one view.",
  },
  {
    icon: Building2,
    title: "Multi-role workspace",
    description: "Your dashboard knows your role. Supplier, distributor, or retailer — you'll see what matters to you.",
  },
  {
    icon: ShieldEllipsis,
    title: "Trust layer ready",
    description: "Verified partners and secure transactions built right in. No tech setup needed.",
  },
];

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-white to-[#EFF6FF]">
      <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-16 px-6 py-12 lg:grid-cols-[1fr_448px] lg:px-10">
        {/* ── Left: Hero + Features ────────────────────────────────────── */}
        <section className="space-y-14">
          {/* Headline */}
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#2563EB]">
              <UserPlus className="h-3.5 w-3.5" />
              AUTOSUP Operations
            </span>

            <div className="max-w-2xl space-y-5">
              <h1 className="text-[2.75rem] font-bold leading-[1.15] tracking-tight text-[#0F172A] md:text-[3.5rem]">
                Bergabung dan mulai kelola supply chain kamu dengan{" "}
                <span className="text-[#2563EB]">lebih cerdas</span>.
              </h1>
              <p className="max-w-xl text-lg leading-8 text-[#64748B]">
                Daftar sebagai distributor, supplier, atau retailer dan langsung akses workspace yang dirancang untuk operasional harian yang lebih efisien.
              </p>
            </div>
          </div>

          {/* Feature cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="group rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB] transition-colors group-hover:bg-[#2563EB] group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-sm font-semibold text-[#0F172A]">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#64748B]">{item.description}</p>
                </div>
              );
            })}
          </div>

        </section>

        {/* ── Right: Register Form ─────────────────────────────────────── */}
        <div className="flex justify-center lg:justify-end">
          <RegisterForm />
        </div>
      </div>
    </main>
  );
}