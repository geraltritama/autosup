"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Building2,
  Check,
  ExternalLink,
  Key,
  Loader2,
  Lock,
  Monitor,
  Plug,
  Save,
  Shield,
  Smartphone,
  User,
  Wallet,
  Zap,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { PageErrorState } from "@/components/dashboard/page-error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useProfileSettings,
  useUpdateProfile,
  useBusinessSettings,
  useUpdateBusiness,
  useNotificationSettings,
  useUpdateNotifications,
  useIntegrationsSettings,
  useSessionsSettings,
  useEnable2FA,
  useDisable2FA,
  useVerify2FA,
} from "@/hooks/useSettings";
import {
  useMyWallet,
  useRequestAirdrop,
  useDisconnectBrowserWallet,
  useConnectPhantom,
  useConnectMetaMask,
  useBrowserWalletDetection,
} from "@/hooks/useWallet";
import { useAuthStore } from "@/store/useAuthStore";

type Tab = "profile" | "business" | "notifications" | "security" | "integrations" | "wallet";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Profil", icon: User },
  { id: "business", label: "Bisnis", icon: Building2 },
  { id: "notifications", label: "Notifikasi", icon: Bell },
  { id: "security", label: "Keamanan", icon: Shield },
  { id: "integrations", label: "Integrasi", icon: Plug },
  { id: "wallet", label: "Wallet", icon: Wallet },
];

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const { data, isLoading, isError, refetch } = useProfileSettings();
  const authEmail = useAuthStore((s) => s.user?.email);
  const updateProfile = useUpdateProfile();
  const [form, setForm] = useState({ full_name: "", phone: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({ full_name: data.full_name, phone: data.phone ?? "" });
    }
  }, [data]);

  if (isError) {
    return <PageErrorState message="Gagal memuat data profil" onRetry={() => refetch()} />;
  }

  if (isLoading || !data) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
      </div>
    );
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateProfile.mutate(
      { full_name: form.full_name, phone: form.phone },
      {
        onSuccess: () => {
          const user = useAuthStore.getState().user;
          if (user && form.full_name) {
            useAuthStore.getState().setAuth(
              { ...user, full_name: form.full_name },
              useAuthStore.getState().accessToken!,
              useAuthStore.getState().refreshToken!,
            );
          }
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        },
      },
    );
  }

  const displayEmail = data.email || authEmail || "";

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Informasi Profil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#DBEAFE] text-[#2563EB]">
              <User className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">{data.full_name}</p>
              <p className="text-xs text-[#64748B]">{displayEmail}</p>
              <Badge tone="info" className="mt-1 capitalize">
                {data.role}
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Nama Lengkap</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="Masukkan nama lengkap"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">No. Telepon</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="Masukkan no. telepon"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={displayEmail} disabled className="text-[#94A3B8]" />
              <p className="text-xs text-[#94A3B8]">Email tidak dapat diubah.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={updateProfile.isPending} className="gap-2">
          {updateProfile.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Simpan Perubahan
        </Button>
        {saved && (
          <span className="text-sm text-[#22C55E]">Profil berhasil diperbarui.</span>
        )}
      </div>
    </form>
  );
}

// ─── Business Tab ─────────────────────────────────────────────────────────────

function BusinessTab() {
  const role = useAuthStore((s) => s.user?.role);
  const { data, isLoading, isError, refetch } = useBusinessSettings(role);
  const updateBusiness = useUpdateBusiness();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    business_name: "",
    business_type: "",
    tax_id: "",
  });

  useEffect(() => {
    if (data) {
      setForm({
        business_name: data.business_name ?? "",
        business_type: data.business_type ?? "",
        tax_id: data.tax_id ?? "",
      });
    }
  }, [data]);

  if (isError) {
    return <PageErrorState message="Gagal memuat data bisnis" onRetry={() => refetch()} />;
  }

  if (isLoading || !data) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
      </div>
    );
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateBusiness.mutate(form, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      },
    });
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Informasi Bisnis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="business_name">Nama Bisnis</Label>
              <Input
                id="business_name"
                value={form.business_name}
                onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
                placeholder="Masukkan nama bisnis"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="business_type">Jenis Bisnis</Label>
              <Input
                id="business_type"
                value={form.business_type}
                onChange={(e) => setForm((f) => ({ ...f, business_type: e.target.value }))}
                placeholder="Masukkan jenis bisnis"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tax_id">NPWP</Label>
              <Input
                id="tax_id"
                value={form.tax_id}
                onChange={(e) => setForm((f) => ({ ...f, tax_id: e.target.value }))}
                placeholder="Masukkan NPWP"
              />
            </div>
            {data.preferred_currency && (
              <div className="space-y-1.5">
                <Label>Mata Uang</Label>
                <Input defaultValue={data.preferred_currency} readOnly className="bg-[#F8FAFC]" />
              </div>
            )}
            {data.operational_timezone && (
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <Input defaultValue={data.operational_timezone} readOnly className="bg-[#F8FAFC]" />
              </div>
            )}
          </div>

          {data.warehouse_locations && data.warehouse_locations.length > 0 && (
            <div className="space-y-2 pt-2">
              <Label>Lokasi Gudang</Label>
              <div className="space-y-2">
                {data.warehouse_locations.map((wh) => (
                  <div
                    key={wh.id}
                    className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3"
                  >
                    <p className="text-sm font-medium text-[#0F172A]">{wh.name}</p>
                    <p className="text-xs text-[#64748B]">{wh.address}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.service_regions && data.service_regions.length > 0 && (
            <div className="space-y-2 pt-2">
              <Label>Area Layanan</Label>
              <div className="flex flex-wrap gap-2">
                {data.service_regions.map((r) => (
                  <Badge key={r} tone="info">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {data.branch_locations && data.branch_locations.length > 0 && (
            <div className="space-y-2 pt-2">
              <Label>Lokasi Cabang</Label>
              <div className="space-y-2">
                {data.branch_locations.map((br) => (
                  <div
                    key={br.id}
                    className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3"
                  >
                    <p className="text-sm font-medium text-[#0F172A]">{br.name}</p>
                    <p className="text-xs text-[#64748B]">{br.address}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.billing_subscription && (
            <div className="space-y-2 pt-2">
              <Label>Langganan</Label>
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">Plan</span>
                  <Badge tone="success">{data.billing_subscription.current_plan}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">Perpanjangan</span>
                  <span className="font-medium text-[#0F172A]">
                    {data.billing_subscription.next_renewal}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">Metode Bayar</span>
                  <span className="font-medium text-[#0F172A]">
                    {data.billing_subscription.payment_method}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={updateBusiness.isPending} className="gap-2">
          {updateBusiness.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Simpan
        </Button>
        {saved && <span className="text-sm text-[#22C55E]">Tersimpan.</span>}
      </div>
    </form>
  );
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

function NotificationsTab() {
  const { data, isLoading, isError, refetch } = useNotificationSettings();
  const updateNotifications = useUpdateNotifications();
  const [saved, setSaved] = useState(false);

  if (isError) {
    return <PageErrorState message="Gagal memuat pengaturan notifikasi" onRetry={() => refetch()} />;
  }

  if (isLoading || !data) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
      </div>
    );
  }

  const channelLabels: Record<keyof typeof data.channels, string> = {
    email: "Email",
    in_app: "In-App",
    sms: "SMS",
  };

  const prefLabels: Record<keyof typeof data.preferences, string> = {
    low_stock_alerts: "Alert Stok Rendah",
    new_order_alerts: "Pesanan Baru",
    partnership_request_alerts: "Request Partnership",
    payment_confirmation: "Konfirmasi Pembayaran",
    overdue_payment_reminder: "Pengingat Jatuh Tempo",
    ai_recommendation_alerts: "Rekomendasi AI",
    weekly_analytics_report: "Laporan Mingguan",
  };

  type ChannelKey = "email" | "in_app" | "sms";
  type PrefKey = "low_stock_alerts" | "new_order_alerts" | "partnership_request_alerts" | "payment_confirmation" | "overdue_payment_reminder" | "ai_recommendation_alerts" | "weekly_analytics_report";

  const notifData = data;

  function handleChannelToggle(key: ChannelKey) {
    const newValue = !notifData.channels[key];
    updateNotifications.mutate(
      { channels: { ...notifData.channels, [key]: newValue } },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      },
    );
  }

  function handlePrefToggle(key: PrefKey) {
    const newValue = !notifData.preferences[key];
    updateNotifications.mutate(
      { preferences: { ...notifData.preferences, [key]: newValue } },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      {saved && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-[#22C55E]">
          Pengaturan notifikasi disimpan.
        </div>
      )}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Saluran Notifikasi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(Object.keys(notifData.channels) as ChannelKey[]).map((key) => (
            <div key={key} className="flex items-center justify-between py-1">
              <Label className="cursor-pointer">{channelLabels[key]}</Label>
              <Switch
                checked={notifData.channels[key]}
                onCheckedChange={() => handleChannelToggle(key)}
                disabled={updateNotifications.isPending}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Preferensi Notifikasi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(Object.keys(notifData.preferences) as PrefKey[]).map(
            (key) => (
              <div key={key} className="flex items-center justify-between py-1">
                <Label className="cursor-pointer">{prefLabels[key]}</Label>
                <Switch
                  checked={notifData.preferences[key]}
                  onCheckedChange={() => handlePrefToggle(key)}
                  disabled={updateNotifications.isPending}
                />
              </div>
            ),
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

function SecurityTab() {
  const { data: sessions, isLoading: loadingSessions, isError: isSessionsError, refetch: refetchSessions } = useSessionsSettings();
  const enable2FA = useEnable2FA();
  const verify2FA = useVerify2FA();
  const disable2FA = useDisable2FA();
  const [totpCode, setTotpCode] = useState("");
  const [qrData, setQrData] = useState<{ secret: string; qr_code_url: string } | null>(null);
  const [verified2FA, setVerified2FA] = useState(false);

  function handleEnable() {
    enable2FA.mutate(undefined, {
      onSuccess: (result) => {
        setQrData(result);
        setVerified2FA(false);
      },
    });
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    verify2FA.mutate(totpCode, {
      onSuccess: () => {
        setTotpCode("");
        setQrData(null);
        setVerified2FA(true);
        setTimeout(() => setVerified2FA(false), 3000);
      },
    });
  }

  function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    disable2FA.mutate(totpCode, {
      onSuccess: () => {
        setTotpCode("");
        setQrData(null);
      },
    });
  }

  return (
    <div className="space-y-6">
      {/* 2FA */}
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-[#3B82F6]" />
            <CardTitle className="text-base">Two-Factor Authentication (2FA)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {verified2FA && (
            <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-[#22C55E]">
              <Check className="h-4 w-4" />
              2FA berhasil diverifikasi dan diaktifkan!
            </div>
          )}

          {!qrData ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#64748B]">
                Tambahkan lapisan keamanan dengan TOTP authenticator (Google Authenticator,
                Authy, dll).
              </p>
              <Button
                variant="outline"
                onClick={handleEnable}
                disabled={enable2FA.isPending}
                className="ml-4 flex-shrink-0"
              >
                {enable2FA.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                Aktifkan 2FA
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
                <p className="text-sm font-medium text-[#0F172A]">
                  Scan QR code ini dengan aplikasi authenticator Anda:
                </p>
                <div className="flex h-48 w-48 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white mx-auto">
                  <QRCodeSVG value={qrData.qr_code_url} size={176} />
                </div>
                <div>
                  <p className="text-xs text-[#64748B] mb-1">Secret key (backup):</p>
                  <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-[#0F172A]">
                    {qrData.secret}
                  </code>
                </div>
              </div>
              <form onSubmit={handleVerify} className="flex gap-2">
                <Input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="Masukkan kode TOTP dari authenticator"
                  className="flex-1"
                />
                <Button
                  type="submit"
                  disabled={verify2FA.isPending || !totpCode}
                  className="gap-2"
                >
                  {verify2FA.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Verifikasi
                </Button>
              </form>
              <form onSubmit={handleDisable}>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={disable2FA.isPending}
                  className="text-[#94A3B8] hover:text-[#EF4444]"
                >
                  Batal & Nonaktifkan
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sessions */}
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-[#3B82F6]" />
            <CardTitle className="text-base">Sesi Aktif</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loadingSessions ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
            </div>
          ) : isSessionsError ? (
            <PageErrorState message="Gagal memuat data sesi" onRetry={() => refetchSessions()} />
          ) : (
            <div className="space-y-3">
              {sessions?.map((s) => (
                <div
                  key={s.session_id}
                  className="flex items-center justify-between rounded-xl border border-[#E2E8F0] px-4 py-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[#0F172A]">{s.device}</p>
                      {s.is_current && (
                        <Badge tone="success" className="text-[10px]">
                          Sesi Ini
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-[#64748B]">
                      {s.ip} · {s.city} · {formatDate(s.last_active_at)}
                    </p>
                  </div>
                  {!s.is_current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#EF4444] hover:text-[#EF4444]"
                    >
                      Logout
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Web3 Wallet Card (inside IntegrationsTab) ────────────────────────────────

function Web3WalletCard() {
  const { phantomAvailable, metamaskAvailable } = useBrowserWalletDetection();
  const { data: backendWallet, isLoading: walletLoading } = useMyWallet();
  const connectPhantom = useConnectPhantom();
  const connectMM = useConnectMetaMask();
  const disconnect = useDisconnectBrowserWallet();
  const [copied, setCopied] = useState(false);

  const isBrowser = backendWallet?.is_browser_wallet ?? false;
  const wType = backendWallet?.wallet_type ?? "";
  const wLabel = wType === "phantom" ? "Phantom" : wType === "metamask" ? "MetaMask" : wType || "Browser";

  function copyPubkey() {
    if (!backendWallet?.pubkey) return;
    navigator.clipboard.writeText(backendWallet.pubkey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#7C3AED]" />
            <CardTitle className="text-base">Web3 Wallet</CardTitle>
          </div>
          <Badge tone={isBrowser ? "success" : "neutral"}>
            {isBrowser ? wLabel : "Auto-generated"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Active pubkey */}
        {walletLoading ? (
          <div className="space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
          </div>
        ) : backendWallet && (
          <div className="rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3 space-y-1.5">
            <p className="text-xs text-[#6D28D9] uppercase tracking-[0.12em]">
              {isBrowser ? `${wLabel} — address` : "Backend wallet — public key"}
            </p>
            <div className="flex items-center gap-2">
              <p className="flex-1 truncate font-mono text-xs text-[#0F172A]">{backendWallet.pubkey}</p>
              <button
                onClick={copyPubkey}
                className="shrink-0 rounded border border-[#DDD6FE] bg-white px-2 py-0.5 text-xs font-medium text-[#7C3AED] hover:bg-[#EDE9FE]"
              >
                {copied ? <Check className="h-3 w-3" /> : "Copy"}
              </button>
              <a href={backendWallet.explorer_url} target="_blank" rel="noopener noreferrer"
                className="text-[#7C3AED] hover:text-[#6D28D9]">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="text-xs text-[#64748B]">
              {isBrowser
                ? "Pubkey disimpan di backend — transaksi on-chain ditandatangani authority keypair backend."
                : "Wallet di-generate otomatis. Hubungkan Phantom atau MetaMask untuk pakai wallet sendiri."}
            </p>
            {isBrowser && (
              <Button
                variant="outline"
                size="sm"
                className="mt-1 text-[#EF4444] border-[#FCA5A5] hover:bg-[#FEF2F2]"
                disabled={disconnect.isPending}
                onClick={() => disconnect.mutate(wType)}
              >
                {disconnect.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Lepas ${wLabel}`}
              </Button>
            )}
          </div>
        )}

        {/* Phantom */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#0F172A]">Phantom (Solana)</p>
          {isBrowser && wType === "phantom" ? (
            <div className="flex items-center gap-2 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-2.5">
              <span className="text-base">👻</span>
              <span className="text-sm font-medium text-[#15803D]">Phantom terhubung</span>
              <Badge tone="success" className="text-[10px] ml-1">Active</Badge>
            </div>
          ) : phantomAvailable ? (
            <Button
              variant="outline"
              className="w-full gap-2 border-[#7C3AED] text-[#7C3AED] hover:bg-[#F5F3FF]"
              disabled={connectPhantom.isPending}
              onClick={() => connectPhantom.mutate()}
            >
              {connectPhantom.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <span className="text-lg leading-none">👻</span>}
              Connect Phantom
            </Button>
          ) : (
            <a href="https://phantom.app" target="_blank" rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#64748B] hover:bg-slate-50">
              <ExternalLink className="h-4 w-4" />
              Install Phantom
            </a>
          )}
          {connectPhantom.isError && (
            <p className="text-xs text-[#DC2626]">
              {(connectPhantom.error as Error)?.message}
            </p>
          )}
        </div>

        {/* MetaMask */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#0F172A]">MetaMask (EVM)</p>
          {isBrowser && wType === "metamask" ? (
            <div className="flex items-center gap-2 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-2.5">
              <span className="text-base">🦊</span>
              <span className="text-sm font-medium text-[#15803D]">MetaMask terhubung</span>
              <Badge tone="success" className="text-[10px] ml-1">Active</Badge>
            </div>
          ) : metamaskAvailable ? (
            <Button
              variant="outline"
              className="w-full gap-2"
              disabled={connectMM.isPending}
              onClick={() => connectMM.mutate()}
            >
              {connectMM.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <span className="text-lg leading-none">🦊</span>}
              Connect MetaMask
            </Button>
          ) : (
            <a href="https://metamask.io" target="_blank" rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#64748B] hover:bg-slate-50">
              <ExternalLink className="h-4 w-4" />
              Install MetaMask
            </a>
          )}
          {connectMM.isError && (
            <p className="text-xs text-[#DC2626]">
              {(connectMM.error as Error)?.message}
            </p>
          )}
        </div>

      </CardContent>
    </Card>
  );
}

// ─── Integrations Tab ─────────────────────────────────────────────────────────

function IntegrationsTab() {
  const { data, isLoading, isError, refetch } = useIntegrationsSettings();

  if (isError) {
    return <PageErrorState message="Gagal memuat data integrasi" onRetry={() => refetch()} />;
  }

  if (isLoading || !data) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
      </div>
    );
  }

  const integrations = [
    {
      key: "erp",
      label: "ERP System",
      desc: "Integrasi dengan sistem ERP untuk sinkronisasi data inventory dan order.",
      data: data.erp,
    },
    {
      key: "payment_gateway",
      label: "Payment Gateway",
      desc: "Xendit / Midtrans untuk pemrosesan pembayaran IDR.",
      data: data.payment_gateway,
    },
    {
      key: "logistics",
      label: "Logistics Partner",
      desc: "Integrasi tracking pengiriman dengan mitra logistik.",
      data: data.logistics,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <Web3WalletCard />

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Sistem Eksternal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {integrations.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-xl border border-[#E2E8F0] px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-[#0F172A]">{item.label}</p>
                <p className="text-xs text-[#64748B]">
                  {item.data.connected
                    ? `Provider: ${item.data.provider}`
                    : item.desc}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={item.data.connected ? "success" : "neutral"}>
                  {item.data.connected ? "Terhubung" : "Tidak Aktif"}
                </Badge>
                {!item.data.connected && (
                  <Button variant="outline" size="sm">
                    Hubungkan
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">API Keys</CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Key className="h-3.5 w-3.5" />
              Generate Key
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.api_keys.length === 0 ? (
            <p className="text-sm text-[#64748B]">Belum ada API key.</p>
          ) : (
            data.api_keys.map((k) => (
              <div
                key={k.key_id}
                className="flex items-center justify-between rounded-xl border border-[#E2E8F0] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">{k.label}</p>
                  <p className="text-xs text-[#64748B]">
                    Dibuat {formatDate(k.created_at)} · Terakhir dipakai{" "}
                    {formatDate(k.last_used_at)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[#EF4444] hover:text-[#EF4444]"
                >
                  Hapus
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Wallet Tab ───────────────────────────────────────────────────────────────

function WalletTab() {
  const { data, isLoading, isError, refetch } = useMyWallet();
  const airdrop = useRequestAirdrop();
  const [copied, setCopied] = useState(false);

  function copyPubkey() {
    if (!data?.pubkey) return;
    navigator.clipboard.writeText(data.pubkey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isError) {
    return <PageErrorState message="Gagal memuat data wallet" onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#7C3AED]" />
            <CardTitle className="text-base">Solana Wallet (Devnet)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading || !data ? (
            <div className="space-y-3">
              <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3 space-y-2">
                <p className="text-xs text-[#6D28D9] uppercase tracking-[0.12em]">Public Key</p>
                <div className="flex items-center gap-2">
                  <p className="flex-1 break-all font-mono text-sm text-[#0F172A]">{data.pubkey}</p>
                  <button
                    onClick={copyPubkey}
                    className="shrink-0 rounded-lg border border-[#DDD6FE] bg-white px-2.5 py-1 text-xs font-medium text-[#7C3AED] hover:bg-[#EDE9FE]"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : "Copy"}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">SOL Balance</p>
                  <p className="text-xs text-[#64748B]">Solana Devnet</p>
                </div>
                <span className="text-lg font-semibold text-[#7C3AED]">
                  {data.sol_balance.toFixed(4)} SOL
                </span>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href={data.explorer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7C3AED] hover:underline"
                >
                  Lihat di Solana Explorer <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#F59E0B]" />
            <CardTitle className="text-base">Devnet Airdrop</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-[#64748B]">
            Minta 2 SOL gratis dari Solana Devnet faucet untuk testing blockchain features.
          </p>
          <Button
            onClick={() => airdrop.mutate()}
            disabled={airdrop.isPending || isLoading}
            variant="outline"
            className="gap-1.5"
          >
            {airdrop.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Requesting…</>
            ) : (
              <><Zap className="h-4 w-4" />Request 2 SOL Airdrop</>
            )}
          </Button>
          {airdrop.isSuccess && (
            <p className="text-xs text-[#16A34A]">
              {airdrop.data?.success ? "Airdrop berhasil! Balance akan update sebentar." : "Airdrop gagal — coba lagi."}
            </p>
          )}
          {airdrop.isError && (
            <p className="text-xs text-[#DC2626]">Airdrop gagal. Pastikan koneksi ke Solana Devnet aktif.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  return (
    <main className="space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="space-y-3">
          <Badge tone="neutral">Pengaturan</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">Settings</h1>
            <p className="max-w-3xl text-sm leading-7 text-[#64748B]">
              Kelola profil, informasi bisnis, notifikasi, keamanan akun, dan integrasi sistem
              Anda.
            </p>
          </div>
        </div>
      </section>

      <div className="flex gap-6 flex-col lg:flex-row">
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:w-52 flex-shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-left transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-[#EFF6FF] text-[#2563EB]"
                    : "text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A]"
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0">
          {activeTab === "profile" && <ProfileTab />}
          {activeTab === "business" && <BusinessTab />}
          {activeTab === "notifications" && <NotificationsTab />}
          {activeTab === "security" && <SecurityTab />}
          {activeTab === "integrations" && <IntegrationsTab />}
          {activeTab === "wallet" && <WalletTab />}
        </div>
      </div>
    </main>
  );
}