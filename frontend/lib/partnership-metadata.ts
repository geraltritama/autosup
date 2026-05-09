/**
 * AUTOSUP Partnership Metadata Utilities
 * 
 * Generate SHA-256 hash of MoU PDF for on-chain storage.
 * Build IPFS-ready metadata JSON for partnership NFTs.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type RetailerTier = "Bronze" | "Silver" | "Gold";

export interface PartnershipMetadata {
  /** UUID of the partnership record in Supabase */
  partnership_id: string;
  /** SHA-256 hash of the MoU PDF document */
  legal_contract_hash: string;
  /** Unix timestamp (seconds) — 0 = no expiry */
  valid_until: number;
  /** Which region(s) the distributor/retailer may operate in */
  distribution_region: string;
  /** Supplier wallet address (minting authority) */
  supplier_pubkey: string;
  /** Distributor wallet address (NFT recipient) */
  distributor_pubkey: string;
  /** Optional: retailer wallet address (for dist→retail NFTs) */
  retailer_pubkey?: string;
  /** Partnership tier (dist→retail only) */
  tier?: RetailerTier;
  /** ISO timestamp of issuance */
  issued_at: string;
}

// ─── SHA-256 File Hash ───────────────────────────────────────────────────────

/**
 * Generate SHA-256 hash from a File object (browser) or Buffer (Node.js).
 * Returns hex-encoded string.
 */
export async function hashFile(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate SHA-256 hash from a Uint8Array/Buffer.
 */
export async function hashBytes(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Convert hex-encoded hash to [u8; 32] for Anchor instruction arguments.
 */
export function hexToBytes32(hex: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < 64; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }
  return bytes;
}

/**
 * Convert [u8; 32] from on-chain back to hex string.
 */
export function bytes32ToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Metadata Builder ─────────────────────────────────────────────────────────

/**
 * Build IPFS-compatible metadata JSON for partnership NFT.
 * This JSON should be uploaded to IPFS/Pinata and the URI passed
 * as part of the Metaplex metadata (or stored off-chain).
 */
export function buildPartnershipMetadata(params: {
  partnership_id: string;
  legal_contract_hash: string; // 64-char hex
  valid_until: number;          // 0 = no expiry
  distribution_region: string;
  supplier_pubkey: string;
  distributor_pubkey: string;
  retailer_pubkey?: string;
  tier?: RetailerTier;
}): PartnershipMetadata {
  return {
    partnership_id: params.partnership_id,
    legal_contract_hash: params.legal_contract_hash,
    valid_until: params.valid_until,
    distribution_region: params.distribution_region,
    supplier_pubkey: params.supplier_pubkey,
    distributor_pubkey: params.distributor_pubkey,
    retailer_pubkey: params.retailer_pubkey,
    tier: params.tier,
    issued_at: new Date().toISOString(),
  };
}

/**
 * Read partnership NFT PDA state from Solana and determine actionable insights.
 * Used by token-gating logic in the frontend.
 */
export interface PartnershipPDA {
  isActive: boolean;
  tier: RetailerTier | null;
  supplier: string;
  distributor: string;
  retailer: string | null;
  legalContractHash: string;
  validUntil: number;
  distributionRegion: string;
  issuedAt: number;
}

/**
 * Parse raw Anchor PDA data into a typed PartnershipPDA.
 */
export function parsePartnershipPDA(raw: {
  status: { active?: object; revoked?: object };
  retailerTier?: { bronze?: object; silver?: object; gold?: object };
  supplier: Uint8Array;
  distributor: Uint8Array;
  retailer?: Uint8Array | null;
  legalContractHash: number[];
  validUntil: number;
  distributionRegion: string;
  issuedAt: number;
}): PartnershipPDA {
  const tierMap: Record<string, RetailerTier> = {
    bronze: "Bronze",
    silver: "Silver",
    gold: "Gold",
  };

  return {
    isActive: "active" in (raw.status || {}),
    tier: raw.retailerTier
      ? tierMap[Object.keys(raw.retailerTier)[0] || ""] || null
      : null,
    supplier: raw.supplier ? bufferToBase58(raw.supplier) : "",
    distributor: raw.distributor ? bufferToBase58(raw.distributor) : "",
    retailer: raw.retailer ? bufferToBase58(raw.retailer) : null,
    legalContractHash: raw.legalContractHash
      ? bytes32ToHex(raw.legalContractHash)
      : "",
    validUntil: raw.validUntil || 0,
    distributionRegion: raw.distributionRegion || "",
    issuedAt: raw.issuedAt || 0,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bufferToBase58(buf: Uint8Array): string {
  // Simple base58 (for display only — use @solana/web3.js in production)
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const bytes = Array.from(buf);
  let digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] * 256;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = "";
  for (const b of bytes) {
    if (b !== 0) break;
    result += "1";
  }
  return result + digits.reverse().map((d) => ALPHABET[d]).join("");
}
