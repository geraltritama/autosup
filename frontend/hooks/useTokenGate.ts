"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { parsePartnershipPDA, type PartnershipPDA, type RetailerTier } from "@/lib/partnership-metadata";

/**
 * PDA seeds for the partnership-nft program.
 * PROGRAM_ID = 5YNmS1R9nNSCDZB5P7F3YTvGRR1Px2JnyM7FQNHpdYSw
 */
const PROGRAM_ID = new PublicKey("5YNmS1R9nNSCDZB5P7F3YTvGRR1Px2JnyM7FQNHpdYSw");
const PARTNERSHIP_MINT_SEED = Buffer.from("partnership-mint");

function findPDA(distributor: PublicKey, retailer: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [PARTNERSHIP_MINT_SEED, distributor.toBuffer(), retailer.toBuffer(), Buffer.from([2])],
    PROGRAM_ID,
  );
  return pda;
}

export interface TokenGateResult {
  /** Whether the wallet holds an active retailer partnership NFT */
  isPartner: boolean;
  /** The retailer's tier (Bronze, Silver, Gold) — null if not partnered */
  tier: RetailerTier | null;
  /** Full partnership PDA data */
  partnership: PartnershipPDA | null;
  /** Whether we're still fetching on-chain data */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
}

/**
 * Get discount percentage based on retailer tier.
 */
export function getTierDiscount(tier: RetailerTier | null): number {
  switch (tier) {
    case "Gold":   return 20;
    case "Silver": return 10;
    case "Bronze": return 5;
    default:       return 0;
  }
}

/**
 * Token-gating hook: reads Solana PDA to determine retailer partnership tier.
 * 
 * Usage:
 *   const { isPartner, tier, isLoading } = useTokenGate();
 *   const discount = getTierDiscount(tier);
 *   return <ProductCatalog discount={discount} />;
 */
export function useTokenGate(distributorPubkey?: string): TokenGateResult {
  const { publicKey, connected } = useWallet();
  const [result, setResult] = useState<TokenGateResult>({
    isPartner: false,
    tier: null,
    partnership: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!connected || !publicKey || !distributorPubkey) {
      setResult({
        isPartner: false,
        tier: null,
        partnership: null,
        isLoading: false,
        error: null,
      });
      return;
    }

    let cancelled = false;

    async function fetchPDA() {
      setResult((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const distributor = new PublicKey(distributorPubkey!);
        const pda = findPDA(distributor, publicKey!);
        const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getAccountInfo",
            params: [
              pda.toBase58(),
              { encoding: "base64", commitment: "confirmed" },
            ],
          }),
        });

        const json = await response.json();

        if (cancelled) return;

        if (!json.result?.value) {
          setResult({
            isPartner: false,
            tier: null,
            partnership: null,
            isLoading: false,
            error: null,
          });
          return;
        }

        // Decode base64 account data
        const raw = json.result.value.data[0];
        const buffer = Buffer.from(raw, "base64");

        // Parse Anchor discriminator (8 bytes) + account layout
        // PartnershipNFT layout: Pubkey(32)*3 + Role(1) + Status(1+32) + Option<Tier>(1+1) + Terms(4+256) + Hash(32) + i64(8) + Region(4+64) + i64(8) + Option<i64>(1+8) + u8(1)
        let offset = 8; // skip discriminator

        // Pubkey fields (32 bytes each)
        const supplier = buffer.slice(offset, offset + 32); offset += 32;
        const distributor_ = buffer.slice(offset, offset + 32); offset += 32;
        const retailerOpt = buffer[offset]; offset += 1; // Option tag
        const retailer = retailerOpt === 1 ? buffer.slice(offset, offset + 32) : null;
        if (retailerOpt === 1) offset += 32;

        // Role (1 byte)
        const _role = buffer[offset]; offset += 1;

        // Status (2 bytes: discriminant + Option<Pubkey> = 1 + 33)
        const statusDiscriminant = buffer[offset]; offset += 1;
        // skip Option<Pubkey> (33 bytes)
        offset += 33;

        // RetailerTier Option (1 byte tag + optional 1 byte value)
        const tierTag = buffer[offset]; offset += 1;
        let tier: RetailerTier | null = null;
        if (tierTag === 1) {
          const tierVal = buffer[offset]; offset += 1;
          tier = tierVal === 0 ? "Bronze" : tierVal === 1 ? "Silver" : tierVal === 2 ? "Gold" : null;
        }

        // Terms (4 byte length + up to 256 bytes)
        const _termsLen = buffer.readUInt32LE(offset); offset += 4 + 256;

        // Legal contract hash (32 bytes)
        const hashBytes: number[] = [];
        for (let i = 0; i < 32; i++) hashBytes.push(buffer[offset + i]);
        offset += 32;

        // Valid until (8 bytes, little-endian i64)
        const validUntil = Number(buffer.readBigInt64LE(offset)); offset += 8;
        // Handle negative (signed i64)
        const validUntilAbs = validUntil < 0 ? 0 : validUntil;

        // Distribution region (4 + 64)
        const regionLen = buffer.readUInt32LE(offset); offset += 4;
        const regionBuf = buffer.slice(offset, offset + regionLen);
        const region = regionBuf.toString("utf-8").replace(/\0/g, "");
        offset += 64;

        // Issued at (8 bytes)
        const issuedAt = Number(buffer.readBigInt64LE(offset)); offset += 8;

        // Revoked at Option (1 + 8)
        const _revokedTag = buffer[offset]; offset += 1 + 8;

        // Bump (1 byte)
        // offset += 1; // not needed

        const partnership: PartnershipPDA = {
          isActive: statusDiscriminant === 0,
          tier,
          supplier: supplier.toString("base64"), // placeholder — use PublicKey in production
          distributor: distributor_.toString("base64"),
          retailer: retailer?.toString("base64") || null,
          legalContractHash: bytes32ToHex(hashBytes),
          validUntil: validUntilAbs,
          distributionRegion: region,
          issuedAt: issuedAt < 0 ? 0 : issuedAt,
        };

        setResult({
          isPartner: statusDiscriminant === 0 && (tier !== null || true),
          tier,
          partnership,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setResult({
          isPartner: false,
          tier: null,
          partnership: null,
          isLoading: false,
          error: err instanceof Error ? err.message : "Failed to fetch PDA",
        });
      }
    }

    fetchPDA();
    return () => { cancelled = true; };
  }, [connected, publicKey, distributorPubkey]);

  return result;
}

function bytes32ToHex(bytes: number[]): string {
  return bytes.map((b) => (b & 0xFF).toString(16).padStart(2, "0")).join("");
}
