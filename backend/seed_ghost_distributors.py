"""
Register ghost distributors as real auth users, update their orders, create partnerships.
Run: cd backend && python seed_ghost_distributors.py
"""
import os, hashlib, uuid, time, requests as req
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
SUPA_URL = os.getenv("SUPABASE_URL")
SUPA_KEY = os.getenv("SUPABASE_KEY")

GHOST_DISTRIBUTORS = [
    {"name": "CV Maju Jaya Bandung", "city": "Bandung", "region": "Jawa Barat", "email": "distributor-bandung@autosup.demo"},
    {"name": "PT Logistik Bekasi Mandiri", "city": "Bekasi", "region": "Jabodetabek", "email": "distributor-bekasi@autosup.demo"},
    {"name": "CV Tangerang Sejahtera", "city": "Tangerang", "region": "Jabodetabek", "email": "distributor-tangerang@autosup.demo"},
    {"name": "PT Bogor Makmur Distribusi", "city": "Bogor", "region": "Jabodetabek", "email": "distributor-bogor@autosup.demo"},
    {"name": "CV Semarang Niaga Utama", "city": "Semarang", "region": "Jawa Tengah", "email": "distributor-semarang2@autosup.demo"},
    {"name": "PT Yogyakarta Supply Chain", "city": "Yogyakarta", "region": "DIY", "email": "distributor-yogya@autosup.demo"},
]

PASSWORD = "Autosup123!"


def create_user(dist):
    """Create auth user via Supabase Admin API."""
    headers = {"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}", "Content-Type": "application/json"}
    payload = {
        "email": dist["email"],
        "password": PASSWORD,
        "email_confirm": True,
        "user_metadata": {
            "full_name": dist["name"],
            "business_name": dist["name"],
            "role": "distributor",
            "city": dist["city"],
            "phone": f"+6281{hash(dist['name']) % 100000000:08d}",
        },
    }
    resp = req.post(f"{SUPA_URL}/auth/v1/admin/users", headers=headers, json=payload, timeout=10)
    if resp.status_code in (200, 201):
        user_id = resp.json().get("id", "")
        print(f"  [USER] Created: {dist['name']} → {user_id[:8]}...")
        return user_id
    elif "already been registered" in resp.text:
        # User exists, find their ID
        all_resp = req.get(f"{SUPA_URL}/auth/v1/admin/users", headers=headers, timeout=10)
        for u in all_resp.json().get("users", []):
            if u.get("email") == dist["email"]:
                print(f"  [USER] Already exists: {dist['name']} → {u['id'][:8]}...")
                return u["id"]
    print(f"  [USER ERR] {resp.status_code}: {resp.text[:100]}")
    return None


def update_orders(old_name, new_user_id):
    """Update orders buyer_id from name-based to real UUID."""
    orders = supabase.table("orders").select("id,buyer_name,buyer_id").eq("buyer_name", old_name).execute().data or []
    updated = 0
    for o in orders:
        if o.get("buyer_id") != new_user_id:
            supabase.table("orders").update({"buyer_id": new_user_id}).eq("id", o["id"]).execute()
            updated += 1
    print(f"  [ORDERS] Updated {updated}/{len(orders)} orders")
    return updated


def create_partnership(dist, user_id):
    """Create accepted partnership with MOU + NFT."""
    # Check if already exists
    existing = supabase.table("partnerships").select("id").eq("requester_id", user_id).eq("approver_id", SUPPLIER_GERAL).eq("type", "supplier_distributor").in_("status", ["pending", "accepted"]).execute()
    if existing.data:
        print(f"  [PARTNERSHIP] Already exists, skip")
        return

    terms = (
        f"{dist['name']} ditunjuk sebagai distributor resmi produk Toko Geral untuk wilayah {dist['region']}. "
        f"Minimum order Rp 500.000 per transaksi. Pembayaran net-30. "
        f"Distributor bertanggung jawab atas distribusi produk sesuai standar kualitas."
    )
    h = hashlib.sha256(terms.encode()).hexdigest()
    pid = str(uuid.uuid4())
    valid_until = (datetime.utcnow() + timedelta(days=365)).isoformat()
    now = datetime.utcnow().isoformat()

    # Mint NFT
    nft_mint, nft_url = None, None
    if BC:
        try:
            time.sleep(2)
            wa = bc.get_or_create_wallet(supabase, SUPPLIER_GERAL)
            wr = bc.get_or_create_wallet(supabase, user_id)
            result = bc.mint_partnership_nft(
                distributor_pubkey_str=wr["pubkey"],
                supplier_pubkey_str=wa["pubkey"],
                terms=f"Partnership {pid[:8]}",
                legal_contract_hash=h,
                distribution_region=dist["region"],
            )
            nft_mint = result.get("mint") or result.get("mint_address", "")
            nft_url = f"https://explorer.solana.com/address/{nft_mint}?cluster=devnet" if nft_mint else ""
            print(f"  [NFT] Minted: {nft_mint[:16]}...")
        except Exception as e:
            print(f"  [NFT ERR] {e}")

    row = {
        "id": pid,
        "type": "supplier_distributor",
        "requester_id": user_id,
        "approver_id": SUPPLIER_GERAL,
        "status": "accepted",
        "mou_terms": terms,
        "mou_region": dist["region"],
        "mou_valid_until": valid_until,
        "mou_hash": h,
        "nft_mint_address": nft_mint,
        "nft_token_name": f"Partnership #{pid[:8].upper()}" if nft_mint else None,
        "nft_explorer_url": nft_url,
        "created_at": now,
        "updated_at": now,
    }
    supabase.table("partnerships").insert(row).execute()
    print(f"  [PARTNERSHIP] Created (accepted)")


print("=" * 60)
print("REGISTERING GHOST DISTRIBUTORS")
print("=" * 60)

for dist in GHOST_DISTRIBUTORS:
    print(f"\n--- {dist['name']} ---")
    user_id = create_user(dist)
    if not user_id:
        continue
    update_orders(dist["name"], user_id)
    create_partnership(dist, user_id)

print(f"\n{'=' * 60}")
print(f"ALL DONE! Password for all: {PASSWORD}")
print(f"{'=' * 60}")
