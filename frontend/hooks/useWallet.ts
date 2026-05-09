import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { api } from "@/lib/api";

export function useWallet() {
  return {
    wallet: null,
    connectWallet: async () => {},
    isConnected: false,
  };
}

export function useMyWallet() {
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ["wallet", "my", userId],
    queryFn: async () => {
      const res = await api.get(`/wallet/my?user_id=${userId}`);
      return res.data.data;
    },
    enabled: !!userId,
  });
}

export function useRequestAirdrop() {
  const userId = useAuthStore((s) => s.user?.user_id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post(`/wallet/airdrop?user_id=${userId}`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wallet", "my"] }),
  });
}

export function useBrowserWalletDetection() {
  const phantomAvailable = typeof window !== "undefined" && !!(window as any).solana?.isPhantom;
  const metamaskAvailable = typeof window !== "undefined" && !!(window as any).ethereum?.isMetaMask;
  return { phantomAvailable, metamaskAvailable };
}

export function useConnectPhantom() {
  const userId = useAuthStore((s) => s.user?.user_id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const solana = (window as any).solana;
      const resp = await solana.connect();
      const pubkey = resp.publicKey.toString();
      const res = await api.post(`/wallet/connect?user_id=${userId}`, { pubkey, wallet_type: "phantom" });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wallet", "my"] }),
  });
}

export function useConnectMetaMask() {
  const userId = useAuthStore((s) => s.user?.user_id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const eth = (window as any).ethereum;
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const pubkey = accounts[0];
      const res = await api.post(`/wallet/connect?user_id=${userId}`, { pubkey, wallet_type: "metamask" });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wallet", "my"] }),
  });
}

export function useDisconnectBrowserWallet() {
  const userId = useAuthStore((s) => s.user?.user_id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (walletType: string) => {
      const res = await api.delete(`/wallet/connect?user_id=${userId}`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wallet", "my"] }),
  });
}