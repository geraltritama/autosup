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
  Settings2,
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
import { api, type ApiResponse } from "@/lib/api";

type Tab = "profile" | "business" | "notifications" | "security" | "integrations" | "wallet" | "operations";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "business", label: "Business", icon: Building2 },
  { id: "operations", label: "Operations", icon: Settings2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "wallet", label: "Wallet", icon: Wallet },
];

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
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
    return <PageErrorState message="Failed to load profile data" onRetry={() => refetch()} />;
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
          <CardTitle className="text-base">Profile Informatione</CardTitle>
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
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="Enter full name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="Enter phone number"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={displayEmail} disabled className="text-[#94A3B8]" />
              <p className="text-xs text-[#94A3B8]">Email cannot be changed.</p>
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
          Save Changes
        </Button>
        {saved && (
          <span className="text-sm text-[#22C55E]">Profile updated successfully.</span>
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
    return <PageErrorState message="Failed to load business data" onRetry={() => refetch()} />;
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
          <CardTitle className="text-base">Business Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="business_name">Business Name</Label>
              <Input
                id="business_name"
                value={form.business_name}
                onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
                placeholder="Enter business name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="business_type">Business Type</Label>
              <Input
                id="business_type"
                value={form.business_type}
                onChange={(e) => setForm((f) => ({ ...f, business_type: e.target.value }))}
                placeholder="Enter business type"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tax_id">Tax ID</Label>
              <Input
                id="tax_id"
                value={form.tax_id}
                onChange={(e) => setForm((f) => ({ ...f, tax_id: e.target.value }))}
                placeholder="Masukkan Tax ID"
              />
            </div>
            {data.preferred_currency && (
              <div className="space-y-1.5">
                <Label>Currency</Label>
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
              <Label>Warehouse Locations</Label>
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
              <Label>Service Areas</Label>
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
              <Label>Branch Locations</Label>
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
              <Label>Subscription</Label>
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">Plan</span>
                  <Badge tone="success">{data.billing_subscription.current_plan}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">Renewal</span>
                  <span className="font-medium text-[#0F172A]">
                    {data.billing_subscription.next_renewal}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">Payment Method</span>
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
          Save
        </Button>
        {saved && <span className="text-sm text-[#22C55E]">Saved.</span>}
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
    return <PageErrorState message="Failed to load notification settings" onRetry={() => refetch()} />;
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
    low_stock_alerts: "Low Stock Alerts",
    new_order_alerts: "New Orders",
    partnership_request_alerts: "Request Partnership",
    payment_confirmation: "Payment Confirmation",
    overdue_payment_reminder: "Overdue Payment Reminder",
    ai_recommendation_alerts: "AI Recommendations",
    weekly_analytics_report: "Weekly Report",
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
          Notification settings saved.
        </div>
      )}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Notification Channels</CardTitle>
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
          <CardTitle className="text-base">Notification Preferences</CardTitle>
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
              2FA successfully verified and enabled!
            </div>
          )}

          {!qrData ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#64748B]">
                Add a security layer with a TOTP authenticator (Google Authenticator,
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
                Enable 2FA
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
                <p className="text-sm font-medium text-[#0F172A]">
                  Scan this QR code with your authenticator app:
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
                  placeholder="Enter TOTP code from authenticator"
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
                  Verify
                </Button>
              </form>
              <form onSubmit={handleDisable}>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={disable2FA.isPending}
                  className="text-[#94A3B8] hover:text-[#EF4444]"
                >
                  Cancel & Disable
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
            <CardTitle className="text-base">Active Sessions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loadingSessions ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
            </div>
          ) : isSessionsError ? (
            <PageErrorState message="Failed to load session data" onRetry={() => refetchSessions()} />
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
                          Current Session
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
  const { data: backendWallet, isLoading: walletLoading } = useMyWallet();

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#7C3AED]" />
            <CardTitle className="text-base">Blockchain Wallet</CardTitle>
          </div>
          <Badge tone="success">Auto-generated</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {walletLoading ? (
          <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
        ) : backendWallet?.pubkey ? (
          <>
            <div className="rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3">
              <p className="text-[10px] text-[#6D28D9] uppercase tracking-wider">Solana Address (Devnet)</p>
              <p className="mt-1 break-all font-mono text-xs text-[#0F172A]">{backendWallet.pubkey}</p>
            </div>
            <p className="text-xs text-[#64748B]">
              Wallet dibuat otomatis saat registrasi. Digunakan untuk mint Partnership NFT dan verifikasi on-chain. Tidak perlu install aplikasi wallet.
            </p>
          </>
        ) : (
          <p className="text-sm text-[#64748B]">Wallet akan dibuat otomatis saat partnership pertama di-approve.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Integrations Tab ─────────────────────────────────────────────────────────

function IntegrationsTab() {
  return (
    <div className="space-y-6">
      <Web3WalletCard />

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Platform Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] p-4">
            <div>
              <p className="text-sm font-medium text-[#0F172A]">Payment Gateway</p>
              <p className="text-xs text-[#64748B]">Xendit / Midtrans integration</p>
            </div>
            <Badge tone="neutral">Coming Soon</Badge>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] p-4">
            <div>
              <p className="text-sm font-medium text-[#0F172A]">Logistics API</p>
              <p className="text-xs text-[#64748B]">JNE, J&T, SiCepat tracking</p>
            </div>
            <Badge tone="neutral">Coming Soon</Badge>
          </div>
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
    return <PageErrorState message="Failed to load wallet data" onRetry={() => refetch()} />;
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
                  View on Solana Explorer <ExternalLink className="h-3 w-3" />
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
            Request 2 free SOL from Solana Devnet faucet for testing blockchain features.
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
              {airdrop.data?.success ? "Airdrop successful! Balance will update shortly." : "Airdrop failed — try again."}
            </p>
          )}
          {airdrop.isError && (
            <p className="text-xs text-[#DC2626]">Airdrop failed. Make sure the connection to Solana Devnet is active.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Operations Tab (Supplier) ────────────────────────────────────────────────

function OperationsTab() {
  const [processing, setProcessing] = useState(24);
  const [threshold, setThreshold] = useState(1.0);
  const [carrier, setCarrier] = useState("JNE");
  const [autoAccept, setAutoAccept] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get<ApiResponse<{ default_processing_hours?: number; low_stock_threshold_multiplier?: number; preferred_carrier?: string; auto_accept_orders?: boolean }>>("/settings/preferences")
      .then(({ data }) => {
        const d = data.data;
        if (d.default_processing_hours) setProcessing(d.default_processing_hours);
        if (d.low_stock_threshold_multiplier) setThreshold(d.low_stock_threshold_multiplier);
        if (d.preferred_carrier) setCarrier(d.preferred_carrier);
        if (d.auto_accept_orders != null) setAutoAccept(d.auto_accept_orders);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.put("/settings/preferences", {
        default_processing_hours: processing,
        low_stock_threshold_multiplier: threshold,
        preferred_carrier: carrier,
        auto_accept_orders: autoAccept,
      });
    } catch { /* silent */ }
    setSaving(false);
  }

  if (!loaded) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" /></div>;

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Operational Preferences</CardTitle>
        <p className="text-sm text-[#64748B]">Configure default processing times, stock thresholds, and logistics preferences.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Default Processing Time (hours)</Label>
            <Input type="number" value={processing} onChange={(e) => setProcessing(Number(e.target.value))} min={1} max={168} />
            <p className="text-xs text-[#94A3B8]">Target hours to process incoming orders</p>
          </div>
          <div className="space-y-2">
            <Label>Low Stock Threshold Multiplier</Label>
            <Input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} min={0.5} max={3} step={0.1} />
            <p className="text-xs text-[#94A3B8]">1.0 = use min_stock as-is, 1.5 = alert at 1.5x min_stock</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Preferred Carrier</Label>
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="h-10 w-full rounded-md border border-[#E2E8F0] bg-white px-3 text-sm">
            <option value="JNE">JNE</option>
            <option value="J&T">J&T Express</option>
            <option value="SiCepat">SiCepat</option>
            <option value="AnterAja">AnterAja</option>
            <option value="Ninja">Ninja Xpress</option>
            <option value="GoSend">GoSend</option>
          </select>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-[#0F172A]">Auto-accept orders</p>
            <p className="text-xs text-[#64748B]">Automatically accept incoming orders without manual approval</p>
          </div>
          <Switch checked={autoAccept} onCheckedChange={setAutoAccept} />
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Preferences
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  return (
    <main className="space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="space-y-3">
          <Badge tone="neutral">Settings</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">Settings</h1>
            <p className="max-w-3xl text-sm leading-7 text-[#64748B]">
              Manage profile, business information, notifications, account security, and system integrations.
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
          {activeTab === "operations" && <OperationsTab />}
          {activeTab === "notifications" && <NotificationsTab />}
          {activeTab === "security" && <SecurityTab />}
          {activeTab === "integrations" && <IntegrationsTab />}
          {activeTab === "wallet" && <WalletTab />}
        </div>
      </div>
    </main>
  );
}