"""
Seed partnerships with MOU hash + NFT mint.
Run: cd backend && python seed_partnerships.py
"""
import os, hashlib, uuid, json
from datetime import datetime, timedelta
from dotenv import load_dotenv
load_dotenv()

from supabase import create_client

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# Try blockchain
try:
    import blockchain as bc
    BC = True
except Exception:
    bc = None
    BC = False

# ─── User IDs ───
SUPPLIER_GERAL = "eb19df91-cf38-4441-b462-40530ab95d02"
DIST_NAUFAL = "45cbdf58-c6ef-4a34-a3b5-3d6bdbedea2d"
DIST_PRIMA = "b569e462-b68e-46cd-a6c3-41c5ea3c65cc"
DIST_NUSANTARA = "ee5f0164-7740-4106-b038-bf5b36245024"
RETAILER_BUMI = "9bbc6ffc-0d3e-47b7-84c3-2a2d1f30e183"
RETAILER_RAFI = "05fab453-bdd4-4f2d-851a-0407dd830c9d"
RETAILER_BERKAH = "fd3403ac-ca02-4bd9-9686-4803ea05ccec"
RETAILER_SEMBAKO = "502bd2dd-6471-406d-b652-80efd297bf5d"


def mou_hash(terms: str) -> str:
    return hashlib.sha256(terms.encode()).hexdigest()


def mint_nft(partnership_id: str, party_a_id: str, party_b_id: str, mou_h: str, region: str = ""):
    """Mint partnership NFT on Solana devnet. Returns mint address or None."""
    if not BC:
        print(f"  [SKIP NFT] blockchain module not available")
        return None, None
    try:
        wallet_a = bc.get_or_create_wallet(supabase, party_a_id)
        wallet_b = bc.get_or_create_wallet(supabase, party_b_id)
        result = bc.mint_partnership_nft(
            distributor_pubkey_str=wallet_b["pubkey"],
            supplier_pubkey_str=wallet_a["pubkey"],
            terms=f"Partnership {partnership_id[:8]}",
            legal_contract_hash=mou_h,
            distribution_region=region,
        )
        mint_addr = result.get("mint") or result.get("mint_address", "")
        explorer = f"https://explorer.solana.com/address/{mint_addr}?cluster=devnet" if mint_addr else ""
        print(f"  [NFT] Minted: {mint_addr[:20]}...")
        return mint_addr, explorer
    except Exception as e:
        print(f"  [NFT ERROR] {e}")
        return None, None


def seed_partnership(p_type, requester_id, approver_id, terms, region, status="accepted"):
    pid = str(uuid.uuid4())
    h = mou_hash(terms)
    valid_until = (datetime.utcnow() + timedelta(days=365)).isoformat()
    now = datetime.utcnow().isoformat()

    nft_mint = None
    nft_url = None
    nft_name = None

    if status == "accepted":
        nft_mint, nft_url = mint_nft(pid, approver_id, requester_id, h, region)
        nft_name = f"Partnership #{pid[:8].upper()}"

    row = {
        "id": pid,
        "type": p_type,
        "requester_id": requester_id,
        "approver_id": approver_id,
        "status": status,
        "mou_terms": terms,
        "mou_region": region,
        "mou_valid_until": valid_until,
        "mou_hash": h,
        "nft_mint_address": nft_mint,
        "nft_token_name": nft_name,
        "nft_explorer_url": nft_url,
        "created_at": now,
        "updated_at": now,
    }
    supabase.table("partnerships").insert(row).execute()
    print(f"  [OK] {p_type} | {status} | requester={requester_id[:8]} approver={approver_id[:8]}")
    return pid


print("=" * 60)
print("SEEDING PARTNERSHIPS")
print("=" * 60)

# ─── Supplier ↔ Distributor (accepted) ───
print("\n--- Supplier Toko Geral ↔ Distributor Naufal ---")
p1 = seed_partnership(
    "supplier_distributor",
    requester_id=DIST_NAUFAL,
    approver_id=SUPPLIER_GERAL,
    terms="Distributor Naufal DIstri berhak mendistribusikan seluruh produk Toko Geral di wilayah Jabodetabek. Minimum order 500rb per transaksi. Pembayaran net-30.",
    region="Jabodetabek",
)

print("\n--- Supplier Toko Geral ↔ Distributor PT Prima ---")
p2 = seed_partnership(
    "supplier_distributor",
    requester_id=DIST_PRIMA,
    approver_id=SUPPLIER_GERAL,
    terms="PT Prima Rantai Pasok ditunjuk sebagai distributor resmi produk Toko Geral untuk wilayah Jawa Tengah. Minimum order 1 juta per transaksi.",
    region="Jawa Tengah",
)

print("\n--- Supplier Toko Geral ↔ Distributor Nusantara (PENDING) ---")
seed_partnership(
    "supplier_distributor",
    requester_id=DIST_NUSANTARA,
    approver_id=SUPPLIER_GERAL,
    terms="PT Distribusi Nusantara Sentosa mengajukan kerjasama distribusi produk Toko Geral untuk wilayah DKI Jakarta dan sekitarnya.",
    region="DKI Jakarta",
    status="pending",
)

# ─── Distributor ↔ Retailer (accepted) ───
print("\n--- Distributor Naufal ↔ Retailer Bumi ---")
p3 = seed_partnership(
    "distributor_retailer",
    requester_id=RETAILER_BUMI,
    approver_id=DIST_NAUFAL,
    terms="Retailer Bumi berhak membeli produk dari Naufal DIstri dengan harga grosir. Credit line tersedia setelah 3 bulan kerjasama aktif.",
    region="Bekasi",
)

print("\n--- Distributor Naufal ↔ Retailer Rafi ---")
p4 = seed_partnership(
    "distributor_retailer",
    requester_id=RETAILER_RAFI,
    approver_id=DIST_NAUFAL,
    terms="Toko Rafi Jaya mendapat akses pembelian grosir dari Naufal DIstri. Pembayaran COD atau credit setelah evaluasi.",
    region="Jakarta Timur",
)

print("\n--- Distributor Naufal ↔ Retailer Berkah (PENDING) ---")
seed_partnership(
    "distributor_retailer",
    requester_id=RETAILER_BERKAH,
    approver_id=DIST_NAUFAL,
    terms="Berkah Mart mengajukan kerjasama pembelian grosir dari Naufal DIstri untuk kebutuhan toko di area Bekasi Selatan.",
    region="Bekasi Selatan",
    status="pending",
)

print("\n--- Distributor Naufal ↔ Retailer Sembako ---")
p5 = seed_partnership(
    "distributor_retailer",
    requester_id=RETAILER_SEMBAKO,
    approver_id=DIST_NAUFAL,
    terms="Warung Sembako Ibu Sari mendapat akses pembelian dari Naufal DIstri dengan syarat minimum order 200rb.",
    region="Depok",
)

print("\n" + "=" * 60)
print("SEEDING COMPLETE")
print("=" * 60)
