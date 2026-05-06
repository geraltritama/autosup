"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, type ApiResponse } from "@/lib/api";
import { useAuthStore, type AuthUser, type UserRole } from "@/store/useAuthStore";

type LoginPayload = {
  email: string;
  password: string;
  recaptcha_token: string;
};

type RegisterPayload = {
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
  business_name: string;
  phone: string;
};

type LoginResponseData = AuthUser & {
  access_token: string;
  refresh_token: string;
};

type RegisterResponseData = {
  user_id: string;
  email: string;
  role: UserRole;
  access_token: string;
};

export function useLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAuth } = useAuthStore();
  const router = useRouter();

  async function login(payload: LoginPayload) {
    setIsLoading(true);
    setError(null);
    try {
      const { data: res } = await api.post<ApiResponse<LoginResponseData>>("/auth/login", payload);
      const { access_token, refresh_token, ...user } = res.data;
      // Backend login doesn't return email — inject from payload
      setAuth({ ...user, email: payload.email }, access_token, refresh_token);
      router.push("/dashboard/dashboard");
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: ApiResponse } };
      const code = apiError.response?.data?.error_code;
      if (code === "CAPTCHA_FAILED" || code === "CAPTCHA_MISSING") {
        setError("Verifikasi gagal, coba lagi.");
      } else {
        setError(apiError.response?.data?.message ?? "Login gagal. Periksa email dan password kamu.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return { login, isLoading, error };
}

export function useRegister() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { setAuth } = useAuthStore();
  const router = useRouter();

  async function register(payload: RegisterPayload) {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const { data: res } = await api.post<ApiResponse<RegisterResponseData>>("/auth/register", payload);
      if (!res.success) {
        setError(res.message ?? "Registrasi gagal. Coba lagi.");
        return;
      }
      if (!res.data?.access_token) {
        // Email confirmation required — not an error
        setSuccessMessage("Registrasi berhasil! Cek email untuk konfirmasi, lalu login.");
        return;
      }
      setAuth(
        {
          user_id: res.data.user_id,
          email: res.data.email,
          role: res.data.role,
          full_name: payload.full_name,
          business_name: payload.business_name,
        },
        res.data.access_token,
        "",
      );
      router.push("/dashboard/dashboard");
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: ApiResponse } };
      const msg = apiError.response?.data?.message;
      setError(msg ?? "Registrasi gagal. Periksa koneksi atau coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }

  return { register, isLoading, error, successMessage };
}

export function useLogout() {
  const { clearAuth, refreshToken } = useAuthStore();
  const router = useRouter();

  async function logout() {
    try {
      await api.post("/auth/logout");
      void refreshToken; // kept in scope for clearAuth below
    } catch {
      // silently fail — clear local state regardless
    } finally {
      clearAuth();
      router.push("/auth/login");
    }
  }

  return { logout };
}
