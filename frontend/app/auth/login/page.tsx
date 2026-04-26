import { Building2, ShieldEllipsis, TrendingUp } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

const highlights = [
  {
    icon: TrendingUp,
    title: "Demand-first operations",
    description: "Pantau demand, fulfillment, dan readiness supplier dari satu tampilan kerja.",
  },
  {
    icon: Building2,
    title: "Supplier and distributor workspace",
    description: "Role-aware dashboard untuk operasional rantai pasok yang lebih rapi.",
  },
  {
    icon: ShieldEllipsis,
    title: "Trust layer ready",
    description: "UI sudah disiapkan untuk partnership, escrow, dan reputasi tanpa flow crypto yang ribet.",
  },
];

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC]">
      <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.1fr_480px] lg:px-10">
        <section className="space-y-10">
          <div className="space-y-5">
            <div className="inline-flex rounded-full border border-[#E2E8F0] bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-[#64748B]">
              AUTOSUP operations
            </div>
            <div className="max-w-2xl space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-[#0F172A] md:text-5xl">
                Supply chain workspace yang dibuat untuk keputusan operasional harian.
              </h1>
              <p className="text-lg leading-8 text-[#64748B]">
                Mulai dari login yang bersih dan cepat, lalu lanjut ke dashboard supplier yang data-driven, terstruktur, dan siap berkembang ke seluruh flow AUTOSUP.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {highlights.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-[#0F172A]">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#64748B]">{item.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex justify-center lg:justify-end">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
