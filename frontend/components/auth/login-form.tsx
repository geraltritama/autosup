"use client";

import { useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
        <div className="space-y-2">
          <label className="text-sm font-medium text-[#0F172A]" htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="nama@bisnis.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-[#0F172A]" htmlFor="password">
              Password
            </label>
            <button className="text-xs font-medium text-[#3B82F6]" type="button">
              Lupa password?
            </button>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Masukkan password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <div className="rounded-xl border border-dashed border-[#BFDBFE] bg-[#F8FBFF] p-3">
          <p className="text-sm font-medium text-[#0F172A]">reCAPTCHA v3 placeholder</p>
          <p className="mt-1 text-xs leading-5 text-[#64748B]">
            Area ini disiapkan untuk flow `recaptcha_token` sebelum integrasi auth nyata.
          </p>
        </div>

        <Button className="w-full gap-2" type="submit">
          Masuk
          <ArrowRight className="h-4 w-4" />
        </Button>

        <p className="text-center text-xs leading-5 text-[#64748B]">
          Mock UI only. Belum terhubung ke Supabase Auth atau FastAPI.
        </p>
      </CardContent>
    </Card>
  );
}
