"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, AlertCircle, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/hooks/useAuth";
import { api } from "@/lib/api";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const { login, isLoading, error } = useLogin();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await login({ email, password });
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError("");
    setForgotSent(false);
    try {
      await api.post("/auth/forgot-password", { email: forgotEmail });
      setForgotSent(true);
    } catch {
      setForgotError("Failed to send reset link. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md rounded-2xl">
      <CardHeader className="space-y-2 pb-4">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="AUTOSUP icon" width={36} height={36} className="h-9 w-9" />
          <Image src="/styletulisan.png" alt="AUTOSUP" width={120} height={28} className="h-7 w-auto" />
        </div>
        <CardTitle className="text-xl">Sign in to AUTOSUP</CardTitle>
        <CardDescription>
          One workspace. Your inventory, orders, and partners.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {resetEmailSent && (
          <div className="flex items-start gap-2 rounded-lg border border-[#86EFAC] bg-[#F0FDF4] px-3 py-2.5 text-sm text-[#16A34A]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Password reset link has been sent to your email. Please check your inbox.</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#0F172A]" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="nama@bisnis.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-[#0F172A]" htmlFor="password">
                Password
              </label>
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="text-xs font-medium text-[#3B82F6] hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2.5 text-sm text-[#DC2626]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button className="w-full gap-2" type="submit" disabled={isLoading || !email || !password}>
            {isLoading ? "Signing in..." : "Sign In"}
            {!isLoading && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>

        <p className="text-center text-sm text-[#64748B]">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="font-medium text-[#3B82F6] hover:underline">
            Sign up
          </Link>
        </p>
      </CardContent>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[#0F172A]">Forgot Password</h3>
            <p className="mt-1 text-sm text-[#64748B]">
              Enter your email and we&apos;ll send you a password reset link.
            </p>
            {forgotSent ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-start gap-2 rounded-lg border border-[#86EFAC] bg-[#F0FDF4] px-3 py-2.5 text-sm text-[#16A34A]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>A password reset link has been sent to your email.</span>
                </div>
                <Button onClick={() => { setForgotOpen(false); setResetEmailSent(true); }} className="w-full">
                  Back to Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="mt-4 space-y-4">
                <Input
                  type="email"
                  placeholder="nama@bisnis.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  disabled={forgotLoading}
                />
                {forgotError && (
                  <p className="text-sm text-[#EF4444]">{forgotError}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => { setForgotOpen(false); setForgotSent(false); setForgotError(""); }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={forgotLoading || !forgotEmail} className="flex-1">
                    {forgotLoading ? "Sending..." : "Send Reset"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
