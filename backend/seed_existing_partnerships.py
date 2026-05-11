"""
Seed partnerships for ALL distributors that already have orders with Toko Geral.
Skips those that already have a partnership (accepted or pending).
Run: cd backend && python seed_existing_partnerships.py
"""
import os, hashlib, uuid, time
from datetime import datetime, timedelta
from dotenv import load_dotenv
load_dotenv()

from supabase import create_client

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

try:
    import blockchain as bc
    BC = True
except Exception:
    bc = None
    BC = False

SUPPLIER_GERAL = "eb19df91-cf38-4441-b462-40530ab95d02"

# Region mapping based on distributor city
CITY_REGION = {
    "Bandung": "Jawa Barat",
    "Bekasi": "Jabodetabek",
    "Tangerang": "Jabodetabek",
    "Bogor": "Jabodetabek",
    "Jakarta": "DKI Jakarta",
    "Semarang": "Jawa Tengah",
    "Yogyakarta": "DIY",
    "Surabaya": "Jawa Timur",
    "Medan": "Sumatera Utara",
    "Makassar": "Sulawesi Selatan",
    "Denpasar": "Bali",
}


def get_region(city):
    return CITY_REGION.get(city, city or "Indonesia")


def mou_hash(terms):
    return hashlib.sha256(terms.encode()).hexdigest()


def mint_nft(pid, approver_id, requester_id, h, region):
    if not BC:
        return None, None
    try:
        wa = bc.get_or_create_wallet(supabase, approver_id)
        wr = bc.get_or_create_wallet(supabase, requester_id)
        result = bc.mint_partnership_nft(
            distributor_pubkey_str=wr["pubkey"],
            supplier_pubkey_str=wa["pubkey"],
            terms=f"Partnership {pid[:8]}",
            legal_contract_hash=h,
            distribution_region=region,
        )
        mint_addr = result.get("mint") or result.get("mint_address", "")
        explorer = f"https://explorer.solana.com/address/{mint_addr}?cluster=devnet" if mint_addr else ""
        return mint_addr, explorer
    except Exception as e:
        print(f"    [NFT ERR] {e}")
        return None, None


print("=" * 60)
print("SEEDING PARTNERSHIPS FOR EXISTING ORDER DISTRIBUTORS")
print("=" * 60)

# 1. Get all unique buyer_ids from orders where seller = Toko Geral
orders = supabase.table("orders").select("buyer_id").eq("seller_id", SUPPLIER_GERAL).execute().data or []
buyer_ids = list(set(o.get("buyer_id", "") for o in orders if o.get("buyer_id")))
print(f"\nDistributors with orders: {len(buyer_ids)}")

# 2. Get existing partnerships to skip
existing = supabase.table("partnerships").select("requester_id,status").eq("approver_id", SUPPLIER_GERAL).eq("type", "supplier_distributor").execute().data or []
existing_map = {p["requester_id"]: p["status"] for p in existing}
print(f"Existing partnerships: {len(existing_map)}")

# 3. Get distributor user info
import requests as req
headers = {"apikey": os.getenv("SUPABASE_KEY"), "Authorization": f"Bearer {os.getenv('SUPABASE_KEY')}"}
resp = req.get(f"{os.getenv('SUPABASE_URL')}/auth/v1/admin/users", headers=headers, timeout=15)
user_map = {}
for u in resp.json().get("users", []):
    meta = u.get("user_metadata", {}) or {}
    if meta.get("role") == "distributor":
        user_map[u["id"]] = {
            "name": meta.get("business_name", meta.get("full_name", "")),
            "city": meta.get("city", ""),
        }

# 4. Also update PT Distribusi Nusantara pending request with MOU terms
nusantara_id = "ee5f0164-7740-4106-b038-bf5b36245024"
if nusantara_id in existing_map and existing_map[nusantara_id] == "pending":
    print(f"\n  Updating MOU for PT Distribusi Nusantara (pending)...")
    supabase.table("partnerships").update({
        "mou_terms": "PT Distribusi Nusantara Sentosa mengajukan kerjasama sebagai distributor resmi produk Toko Geral untuk wilayah DKI Jakarta dan sekitarnya. Minimum order Rp 1.000.000 per transaksi. Pembayaran net-14. Distributor bertanggung jawab atas pengiriman ke retailer di area cakupan.",
        "mou_region": "DKI Jakarta",
    }).eq("requester_id", nusantara_id).eq("approver_id", SUPPLIER_GERAL).eq("status", "pending").execute()
    print("  [OK] MOU updated")

# 5. Seed new partnerships
created = 0
skipped = 0
for bid in buyer_ids:
    if bid in existing_map:
        skipped += 1
        continue
    if bid not in user_map:
        skipped += 1
        continue

    info = user_map[bid]
    region = get_region(info["city"])
    name = info["name"]

    terms = (
        f"{name} ditunjuk sebagai distributor resmi produk Toko Geral untuk wilayah {region}. "
        f"Minimum order Rp 500.000 per transaksi. Pembayaran net-30. "
        f"Distributor bertanggung jawab atas penyimpanan dan distribusi produk sesuai standar kualitas."
    )

    pid = str(uuid.uuid4())
    h = mou_hash(terms)
    valid_until = (datetime.utcnow() + timedelta(days=365)).isoformat()
    now = datetime.utcnow().isoformat()

    # Mint NFT
    print(f"\n  {name} ({region})...")
    time.sleep(2)  # Rate limit protection
    nft_mint, nft_url = mint_nft(pid, SUPPLIER_GERAL, bid, h, region)
    nft_name = f"Partnership #{pid[:8].upper()}" if nft_mint else None

    row = {
        "id": pid,
        "type": "supplier_distributor",
        "requester_id": bid,
        "approver_id": SUPPLIER_GERAL,
        "status": "accepted",
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
    print(f"    [OK] Partnership created" + (f" + NFT: {nft_mint[:16]}..." if nft_mint else ""))
    created += 1

print(f"\n{'=' * 60}")
print(f"DONE! Created: {created}, Skipped: {skipped} (already exist)")
print(f"{'=' * 60}")
