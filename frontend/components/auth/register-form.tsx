"use client";

import { useState } from "react";
import { ArrowRight, ArrowLeft, ShieldCheck, AlertCircle, CheckCircle2, Building2, Truck, ShoppingBag, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRegister } from "@/hooks/useAuth";
import type { UserRole } from "@/store/useAuthStore";
import { cn } from "@/lib/utils";

const ROLES: { value: UserRole; label: string; description: string; icon: typeof Building2 }[] = [
  {
    value: "distributor",
    label: "Distributor",
    description: "Buy from suppliers, manage stock and orders to retailers",
    icon: Truck,
  },
  {
    value: "supplier",
    label: "Supplier",
    description: "Sell products, receive and process orders from distributors",
    icon: Building2,
  },
  {
    value: "retailer",
    label: "Retailer",
    description: "Manage operational stock and buy from chosen distributors",
    icon: ShoppingBag,
  },
];

const STEPS = [
  { label: "Details" },
  { label: "Security" },
];

export function RegisterForm() {
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("distributor");
  const { register, isLoading, error, successMessage } = useRegister();

  const stepOneValid = fullName && businessName && email && phone;

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    if (stepOneValid) setStep(1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await register({
      full_name: fullName,
      email,
      password,
      role,
      business_name: businessName,
      phone,
    });
  }

  return (
    <Card className="w-full max-w-md rounded-2xl">
      <CardHeader className="space-y-2 pb-0">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#2563EB]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <CardTitle className="text-xl">Sign up to AUTOSUP</CardTitle>
        <CardDescription>Create an account and choose your business role.</CardDescription>
      </CardHeader>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0 px-6 pt-5 pb-2">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                  step === i
                    ? "bg-[#3B82F6] text-white"
                    : step > i
                      ? "bg-[#DBEAFE] text-[#2563EB]"
                      : "bg-[#F1F5F9] text-[#94A3B8]",
                )}
              >
                {step > i ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  step === i ? "text-[#0F172A]" : "text-[#94A3B8]",
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("mx-3 h-px w-10", step > i ? "bg-[#3B82F6]" : "bg-[#E2E8F0]")} />
            )}
          </div>
        ))}
      </div>

      <CardContent className="space-y-5 pt-4">
        {step === 0 && (
          <form onSubmit={handleNext} className="space-y-4">
            {/* Role selector */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-[#0F172A]">Business role</p>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map(({ value, label, description, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    disabled={isLoading}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      role === value
                        ? "border-[#3B82F6] bg-[#EFF6FF]"
                        : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1]",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        role === value ? "text-[#3B82F6]" : "text-[#94A3B8]",
                      )}
                    />
                    <p className="mt-2 text-xs font-semibold text-[#0F172A]">{label}</p>
                    <p className="mt-0.5 text-xs leading-4 text-[#64748B]">{description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#0F172A]" htmlFor="fullName">
                Full name
              </label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#0F172A]" htmlFor="businessName">
                Business name
              </label>
              <Input
                id="businessName"
                type="text"
                placeholder="Acme Supplies"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#0F172A]" htmlFor="reg-email">
                Email
              </label>
              <Input
                id="reg-email"
                type="email"
                placeholder="name@business.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#0F172A]" htmlFor="phone">
                Phone number
              </label>
              <Input
                id="phone"
                type="tel"
                placeholder="08123456789"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2.5 text-sm text-[#DC2626]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              className="w-full gap-2"
              type="submit"
              disabled={isLoading || !stepOneValid}
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>

            <p className="text-center text-sm text-[#64748B]">
              Already have an account?{" "}
              <Link href="/auth/login" className="font-medium text-[#3B82F6] hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#0F172A]" htmlFor="reg-password">
                Password
              </label>
              <div className="relative">
                <Input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  disabled={isLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#0F172A]" htmlFor="reg-confirm-password">
                Confirm password
              </label>
              <div className="relative">
                <Input
                  id="reg-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-type your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                  disabled={isLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-[#DC2626]">Passwords do not match.</p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2.5 text-sm text-[#DC2626]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="flex items-start gap-2 rounded-lg border border-[#86EFAC] bg-[#F0FDF4] px-3 py-2.5 text-sm text-[#16A34A]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep(0)}
                disabled={isLoading}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                className="flex-1 gap-2"
                type="submit"
                disabled={isLoading || !password || !confirmPassword || password !== confirmPassword}
              >
                {isLoading ? "Registering..." : "Create Account"}
                {!isLoading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>

            <p className="text-center text-sm text-[#64748B]">
              Already have an account?{" "}
              <Link href="/auth/login" className="font-medium text-[#3B82F6] hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
