"use client";

import { useState } from "react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/hooks/useAuth";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading, error } = useLogin();
  const { executeRecaptcha } = useGoogleReCaptcha();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!executeRecaptcha) return;

    const recaptcha_token = await executeRecaptcha("login");
    await login({ email, password, recaptcha_token });
  }

  return (
    <Card className="w-full max-w-md rounded-2xl">
      <CardHeader className="space-y-2 pb-4">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#2563EB]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <CardTitle className="text-xl">Masuk ke AUTOSUP</CardTitle>
        <CardDescription>
          Akses dashboard operasional supplier dan distributor dari satu workspace.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
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
            </div>
            <Input
              id="password"
              type="password"
              placeholder="Masukkan password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

          <Button className="w-full gap-2" type="submit" disabled={isLoading || !email || !password}>
            {isLoading ? "Memverifikasi..." : "Masuk"}
            {!isLoading && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>

        <p className="text-center text-sm text-[#64748B]">
          Belum punya akun?{" "}
          <Link href="/auth/register" className="font-medium text-[#3B82F6] hover:underline">
            Daftar sekarang
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
