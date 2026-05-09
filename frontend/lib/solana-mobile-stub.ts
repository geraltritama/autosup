// Stub for @solana-mobile/wallet-adapter-mobile
// Only needed for web builds where Solana Mobile Stack is absent.
export const SolanaMobileWalletAdapterWalletName = "Solana Mobile";
export const createDefaultAuthorizationResultCache = () => ({ get: () => null, set: () => {}, clear: () => {} });
export const createDefaultWalletNotFoundHandler = () => () => {};
export class SolanaMobileWalletAdapter {
  name = SolanaMobileWalletAdapterWalletName;
  url = "https://solanamobile.com";
  icon = "" as const;
  readyState = "Unsupported" as const;
  publicKey = null;
  connecting = false;
  connected = false;
  supportedTransactionVersions = null;
  async connect() { throw new Error("Solana Mobile not available on web."); }
  async disconnect() {}
  async sendTransaction() { throw new Error("Solana Mobile not available on web."); }
  on() { return this; }
  off() { return this; }
  emit() { return false; }
  removeAllListeners() { return this; }
  eventNames() { return []; }
  listeners() { return []; }
  listenerCount() { return 0; }
}
