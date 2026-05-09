export function useWallet() {
  return {
    wallet: null,
    connectWallet: async () => {},
    isConnected: false,
  };
}

export function useMyWallet() {
  return { wallet: null, address: null, balance: 0 };
}

export function useRequestAirdrop() {
  return { requestAirdrop: async () => {}, isLoading: false };
}

export function useDisconnectBrowserWallet() {
  return { disconnect: async () => {} };
}

export function useConnectPhantom() {
  return { connect: async () => {}, isLoading: false };
}

export function useConnectMetaMask() {
  return { connect: async () => {}, isLoading: false };
}

export function useBrowserWalletDetection() {
  return { hasPhantom: false, hasMetaMask: false };
}