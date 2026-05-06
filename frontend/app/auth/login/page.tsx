import { ShieldEllipsis, Building2, TrendingUp, ArrowRight } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

const highlights = [
  {
    icon: TrendingUp,
    title: "Demand-first operations",
    description: "Pantau demand, fulfillment, dan readiness partner dari satu workspace yang terintegrasi.",
  },
  {
    icon: Building2,
    title: "Multi-role workspace",
    description: "Dashboard yang mengenali peran kamu — supplier, distributor, atau retailer — dengan data yang relevan.",
  },
  {
    icon: ShieldEllipsis,
    title: "Trust layer ready",
    description: "Partnership, escrow, dan reputasi partner ditampilkan sebagai hasil sistem. Tanpa kerumitan crypto.",
  },
];

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-white to-[#EFF6FF]">
      <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-16 px-6 py-12 lg:grid-cols-[1fr_448px] lg:px-10">
        {/* ── Left: Hero + Features ────────────────────────────────────── */}
        <section className="space-y-14">
          {/* Headline */}
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#2563EB]">
              <span className="h-2 w-2 rounded-full bg-[#3B82F6] animate-pulse" />
              AUTOSUP Operations
            </span>

            <div className="max-w-2xl space-y-5">
              <h1 className="text-[2.75rem] font-bold leading-[1.15] tracking-tight text-[#0F172A] md:text-[3.5rem]">
                Supply chain workspace yang dibuat untuk{" "}
                <span className="text-[#2563EB]">keputusan operasional</span> harian.
              </h1>
              <p className="max-w-xl text-lg leading-8 text-[#64748B]">
                Mulai dari login yang bersih dan cepat, lalu lanjut ke dashboard yang data-driven, terstruktur, dan siap berkembang ke seluruh flow AUTOSUP.
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

          {/* CTA section */}
          <div className="rounded-2xl border border-[#BFDBFE] bg-gradient-to-r from-[#EFF6FF] to-[#DBEAFE] p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold text-[#0F172A]">Enter AUTOSUP</h2>
                <p className="text-sm leading-6 text-[#475569] max-w-md">
                  Akses dashboard operasional yang dirancang untuk supplier, distributor, dan retailer. Satu platform untuk seluruh supply chain kamu.
                </p>
              </div>
              <div className="hidden sm:block">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2563EB] text-white">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Right: Login Form ────────────────────────────────────────── */}
        <div className="flex justify-center lg:justify-end">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}