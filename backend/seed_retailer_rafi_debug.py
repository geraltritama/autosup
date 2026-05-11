"""
Seed focused retailer-debug data for:
- Retailer account: Toko Rafi Jaya (geraltritama32@gmail.com)
- Distributor partner: Naufal DIstri

Creates real rows in Supabase using existing tables:
- accepted distributor_retailer partnership with MOU metadata
- distributor inventory for orderable products
- retailer purchase orders across the last 6 months
- current pending/shipping orders so distributor also sees incoming orders
- retailer -> consumer sales using the shared orders table
- retailer inventory net movement so delivered purchases appear in stock

Run:
  cd backend && python3 seed_retailer_rafi_debug.py
"""

import hashlib
import os
import uuid
from collections import defaultdict
from datetime import datetime, timedelta

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

try:
    import blockchain as bc
except Exception:
    bc = None

DIST_NAUFAL = "45cbdf58-c6ef-4a34-a3b5-3d6bdbedea2d"
DIST_PRIMA = "b569e462-b68e-46cd-a6c3-41c5ea3c65cc"
DIST_NUSANTARA = "ee5f0164-7740-4106-b038-bf5b36245024"
DIST_BEKASI = "59cf7214-6082-4887-962e-f790998edb4b"
RETAILER_RAFI = "05fab453-bdd4-4f2d-851a-0407dd830c9d"
RETAILER_NAME = "Toko Rafi Jaya"
RETAILER_CITY = "Jakarta Timur"
DIST_NAME = "Naufal Distri"

DISTRIBUTORS = [
    {
        "id": DIST_NAUFAL,
        "name": "Naufal Distri",
        "city": "Jakarta",
        "region": "Jakarta Timur",
        "prefix": "NAUFAL",
        "credit_limit": 5_000_000,
        "risk_level": "low",
        "billing_cycle_days": 14,
        "next_due_amount": 693_000,
    },
    {
        "id": DIST_PRIMA,
        "name": "PT Prima Rantai Pasok",
        "city": "Semarang",
        "region": "Jawa Tengah",
        "prefix": "PRIMA",
        "credit_limit": 7_500_000,
        "risk_level": "medium",
        "billing_cycle_days": 21,
        "next_due_amount": 884_000,
    },
    {
        "id": DIST_NUSANTARA,
        "name": "PT Distribusi Nusantara Sentosa",
        "city": "Jakarta",
        "region": "DKI Jakarta",
        "prefix": "NUSA",
        "credit_limit": 4_500_000,
        "risk_level": "low",
        "billing_cycle_days": 30,
        "next_due_amount": 0,
    },
    {
        "id": DIST_BEKASI,
        "name": "PT Logistik Bekasi Mandiri",
        "city": "Bekasi",
        "region": "Bekasi",
        "prefix": "BEKASI",
        "credit_limit": 3_500_000,
        "risk_level": "high",
        "billing_cycle_days": 14,
        "next_due_amount": 512_000,
    },
]

PRODUCTS = [
    {"name": "Kopi ABC", "price": 8500, "unit": "pcs", "category": "Beverages", "min_threshold": 24},
    {"name": "Mie Goreng Indomie", "price": 3200, "unit": "pcs", "category": "Instant Food", "min_threshold": 60},
    {"name": "Gula Pasir 1kg", "price": 14500, "unit": "kg", "category": "Staples", "min_threshold": 18},
    {"name": "Cooking Oil 1L", "price": 18000, "unit": "btl", "category": "Staples", "min_threshold": 16},
    {"name": "Teh Celup Sariwangi 25s", "price": 8500, "unit": "box", "category": "Beverages", "min_threshold": 12},
    {"name": "Saus Sambal ABC 340ml", "price": 9500, "unit": "btl", "category": "Condiments", "min_threshold": 10},
]

PURCHASE_PLANS = {
    5: [
        {"status": "delivered", "items": {"Kopi ABC": 48, "Mie Goreng Indomie": 72, "Gula Pasir 1kg": 20}},
        {"status": "delivered", "items": {"Cooking Oil 1L": 24, "Teh Celup Sariwangi 25s": 18}},
    ],
    4: [
        {"status": "delivered", "items": {"Kopi ABC": 60, "Mie Goreng Indomie": 80}},
        {"status": "delivered", "items": {"Gula Pasir 1kg": 22, "Cooking Oil 1L": 20}},
    ],
    3: [
        {"status": "delivered", "items": {"Kopi ABC": 66, "Mie Goreng Indomie": 96, "Saus Sambal ABC 340ml": 12}},
        {"status": "delivered", "items": {"Teh Celup Sariwangi 25s": 20, "Gula Pasir 1kg": 20}},
    ],
    2: [
        {"status": "delivered", "items": {"Kopi ABC": 72, "Mie Goreng Indomie": 110}},
        {"status": "delivered", "items": {"Cooking Oil 1L": 28, "Gula Pasir 1kg": 24, "Saus Sambal ABC 340ml": 16}},
    ],
    1: [
        {"status": "delivered", "items": {"Kopi ABC": 76, "Mie Goreng Indomie": 120, "Teh Celup Sariwangi 25s": 24}},
        {"status": "delivered", "items": {"Cooking Oil 1L": 32, "Gula Pasir 1kg": 26}},
    ],
    0: [
        {"status": "delivered", "items": {"Kopi ABC": 80, "Mie Goreng Indomie": 130, "Teh Celup Sariwangi 25s": 26}},
        {"status": "pending", "items": {"Cooking Oil 1L": 24, "Gula Pasir 1kg": 18}},
        {"status": "shipping", "items": {"Kopi ABC": 40, "Saus Sambal ABC 340ml": 14}},
    ],
}

CONSUMER_SALES_PLANS = {
    5: [{"Kopi ABC": 42, "Mie Goreng Indomie": 55}, {"Gula Pasir 1kg": 14, "Teh Celup Sariwangi 25s": 8}],
    4: [{"Kopi ABC": 50, "Mie Goreng Indomie": 62}, {"Cooking Oil 1L": 12, "Gula Pasir 1kg": 16}],
    3: [{"Kopi ABC": 58, "Mie Goreng Indomie": 74}, {"Saus Sambal ABC 340ml": 10, "Teh Celup Sariwangi 25s": 10}],
    2: [{"Kopi ABC": 64, "Mie Goreng Indomie": 82}, {"Cooking Oil 1L": 14, "Gula Pasir 1kg": 18}],
    1: [{"Kopi ABC": 72, "Mie Goreng Indomie": 92}, {"Teh Celup Sariwangi 25s": 12, "Saus Sambal ABC 340ml": 12}],
    0: [{"Kopi ABC": 78, "Mie Goreng Indomie": 108}, {"Cooking Oil 1L": 16, "Gula Pasir 1kg": 20, "Teh Celup Sariwangi 25s": 14}],
}

CONSUMER_SALES_BOOST_PLANS = {
    5: [{"Kopi ABC": 90, "Mie Goreng Indomie": 130, "Cooking Oil 1L": 24}],
    4: [{"Kopi ABC": 96, "Mie Goreng Indomie": 144, "Gula Pasir 1kg": 28}],
    3: [{"Kopi ABC": 104, "Mie Goreng Indomie": 156, "Teh Celup Sariwangi 25s": 26}],
    2: [{"Kopi ABC": 112, "Mie Goreng Indomie": 170, "Saus Sambal ABC 340ml": 24}],
    1: [{"Kopi ABC": 120, "Mie Goreng Indomie": 182, "Cooking Oil 1L": 30}],
    0: [{"Kopi ABC": 128, "Mie Goreng Indomie": 196, "Gula Pasir 1kg": 34, "Teh Celup Sariwangi 25s": 20}],
}

CONSUMER_SALES_BOOST_V2 = [
    {"order_number": "DBG-RAFI-SBX-202512-1", "created_at": "2025-12-24T18:30:00Z", "items": {"Kopi ABC": 160, "Mie Goreng Indomie": 220, "Cooking Oil 1L": 40}},
    {"order_number": "DBG-RAFI-SBX-202601-1", "created_at": "2026-01-25T18:30:00Z", "items": {"Kopi ABC": 168, "Mie Goreng Indomie": 236, "Gula Pasir 1kg": 48}},
    {"order_number": "DBG-RAFI-SBX-202602-1", "created_at": "2026-02-24T18:30:00Z", "items": {"Kopi ABC": 176, "Mie Goreng Indomie": 250, "Teh Celup Sariwangi 25s": 34}},
    {"order_number": "DBG-RAFI-SBX-202603-1", "created_at": "2026-03-25T18:30:00Z", "items": {"Kopi ABC": 184, "Mie Goreng Indomie": 266, "Saus Sambal ABC 340ml": 36}},
    {"order_number": "DBG-RAFI-SBX-202604-1", "created_at": "2026-04-24T18:30:00Z", "items": {"Kopi ABC": 192, "Mie Goreng Indomie": 280, "Cooking Oil 1L": 44}},
    {"order_number": "DBG-RAFI-SBX-202605-1", "created_at": "2026-05-24T18:30:00Z", "items": {"Kopi ABC": 210, "Mie Goreng Indomie": 310, "Gula Pasir 1kg": 60, "Teh Celup Sariwangi 25s": 40}},
]

PARTNER_PURCHASES = {
    DIST_PRIMA: [
        {"order_number": "DBG-RAFI-PRIMA-202604-1", "seller_name": "PT Prima Rantai Pasok", "created_at": "2026-04-11T09:00:00Z", "status": "delivered", "items": {"Teh Celup Sariwangi 25s": 24, "Cooking Oil 1L": 18, "Saus Sambal ABC 340ml": 12}},
        {"order_number": "DBG-RAFI-PRIMA-202605-1", "seller_name": "PT Prima Rantai Pasok", "created_at": "2026-05-05T11:00:00Z", "status": "processing", "items": {"Teh Celup Sariwangi 25s": 18, "Gula Pasir 1kg": 14, "Kopi ABC": 20}},
    ],
    DIST_NUSANTARA: [
        {"order_number": "DBG-RAFI-NUSA-202603-1", "seller_name": "PT Distribusi Nusantara Sentosa", "created_at": "2026-03-17T13:00:00Z", "status": "delivered", "items": {"Mie Goreng Indomie": 64, "Kopi ABC": 36}},
        {"order_number": "DBG-RAFI-NUSA-202605-1", "seller_name": "PT Distribusi Nusantara Sentosa", "created_at": "2026-05-09T08:30:00Z", "status": "pending", "items": {"Mie Goreng Indomie": 40, "Saus Sambal ABC 340ml": 10}},
    ],
    DIST_BEKASI: [
        {"order_number": "DBG-RAFI-BEKASI-202604-1", "seller_name": "PT Logistik Bekasi Mandiri", "created_at": "2026-04-23T10:00:00Z", "status": "delivered", "items": {"Cooking Oil 1L": 20, "Gula Pasir 1kg": 16}},
        {"order_number": "DBG-RAFI-BEKASI-202605-1", "seller_name": "PT Logistik Bekasi Mandiri", "created_at": "2026-05-10T14:00:00Z", "status": "shipping", "items": {"Cooking Oil 1L": 16, "Teh Celup Sariwangi 25s": 10}},
    ],
}


def iso(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat() + "Z"


def month_anchor(months_ago: int, day: int, hour: int) -> datetime:
    now = datetime.utcnow()
    first_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    approx = first_this_month - timedelta(days=months_ago * 30)
    safe_day = min(day, 28)
    return approx.replace(day=safe_day, hour=hour, minute=0, second=0, microsecond=0)


def product_map():
    return {p["name"]: p for p in PRODUCTS}


def build_items(item_map: dict[str, int]) -> tuple[list[dict], int]:
    lookup = product_map()
    rows = []
    total = 0
    for name, qty in item_map.items():
        prod = lookup[name]
        subtotal = qty * prod["price"]
        total += subtotal
        rows.append(
            {
                "name": name,
                "product_name": name,
                "qty": qty,
                "quantity": qty,
                "price_per_unit": prod["price"],
                "subtotal": subtotal,
                "unit": prod["unit"],
            }
        )
    return rows, total


def upsert_inventory_row(user_id: str, prod: dict, current_stock: int):
    existing = (
        supabase.table("inventories")
        .select("id")
        .eq("user_id", user_id)
        .eq("product_name", prod["name"])
        .execute()
        .data
        or []
    )
    payload = {
        "product_name": prod["name"],
        "current_stock": current_stock,
        "user_id": user_id,
        "price": prod["price"],
        "min_threshold": prod["min_threshold"],
        "category": prod["category"],
        "unit": prod["unit"],
    }
    minimal_payload = {
        "product_name": prod["name"],
        "current_stock": current_stock,
        "user_id": user_id,
    }
    try:
        if existing:
            supabase.table("inventories").update(payload).eq("id", existing[0]["id"]).execute()
        else:
            supabase.table("inventories").insert({"id": str(uuid.uuid4()), **payload}).execute()
    except Exception as exc:
        if "schema cache" not in str(exc) and "column" not in str(exc):
            raise
        if existing:
            supabase.table("inventories").update(minimal_payload).eq("id", existing[0]["id"]).execute()
        else:
            supabase.table("inventories").insert({"id": str(uuid.uuid4()), **minimal_payload}).execute()


def ensure_distributor_inventory():
    print("\n--- Ensuring distributor inventory ---")
    stock_multipliers = {
        DIST_NAUFAL: 6,
        DIST_PRIMA: 4,
        DIST_NUSANTARA: 5,
        DIST_BEKASI: 3,
    }
    for dist in DISTRIBUTORS:
        print(f"  {dist['name']}")
        for prod in PRODUCTS:
            stock = max(prod["min_threshold"] * stock_multipliers.get(dist["id"], 4), 24)
            upsert_inventory_row(dist["id"], prod, stock)
            print(f"    [OK] {prod['name']}: stock {stock}")


def ensure_partnership():
    print("\n--- Ensuring retailer partnerships ---")
    for idx, dist in enumerate(DISTRIBUTORS, start=1):
        terms = (
            f"{RETAILER_NAME} menjadi retailer partner aktif {dist['name']} untuk area {RETAILER_CITY}. "
            f"Pembelian dilakukan dengan harga grosir, minimum order Rp300.000 per transaksi, "
            f"pembayaran dapat COD atau termin kredit sesuai evaluasi distributor."
        )
        mou_hash = hashlib.sha256(terms.encode()).hexdigest()
        valid_until = iso(datetime.utcnow() + timedelta(days=365))
        existing = (
            supabase.table("partnerships")
            .select("*")
            .eq("type", "distributor_retailer")
            .eq("requester_id", RETAILER_RAFI)
            .eq("approver_id", dist["id"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )

        row = existing[0] if existing else None
        partnership_id = row["id"] if row else str(uuid.uuid4())
        update_payload = {
            "type": "distributor_retailer",
            "requester_id": RETAILER_RAFI,
            "approver_id": dist["id"],
            "status": "accepted",
            "mou_terms": terms,
            "mou_region": dist["region"],
            "mou_valid_until": valid_until,
            "mou_hash": mou_hash,
            "updated_at": iso(datetime.utcnow()),
        }

        if row:
            supabase.table("partnerships").update(update_payload).eq("id", partnership_id).execute()
        else:
            supabase.table("partnerships").insert(
                {
                    "id": partnership_id,
                    **update_payload,
                    "created_at": iso(datetime.utcnow() - timedelta(days=160 - (idx * 12))),
                }
            ).execute()

        refreshed = (
            supabase.table("partnerships").select("*").eq("id", partnership_id).execute().data or [{}]
        )[0]
        nft_mint = refreshed.get("nft_mint_address")

        if not nft_mint and bc:
            try:
                wallet_dist = bc.get_or_create_wallet(supabase, dist["id"])
                wallet_retail = bc.get_or_create_wallet(supabase, RETAILER_RAFI)
                result = bc.mint_partnership_nft(
                    distributor_pubkey_str=wallet_dist["pubkey"],
                    supplier_pubkey_str=wallet_retail["pubkey"],
                    terms=f"Partnership {partnership_id[:8]}",
                    legal_contract_hash=mou_hash,
                    distribution_region=dist["region"],
                )
                nft_mint = result.get("mint") or result.get("mint_address", "")
                nft_url = f"https://explorer.solana.com/address/{nft_mint}?cluster=devnet" if nft_mint else None
                if nft_mint:
                    supabase.table("partnerships").update(
                        {
                            "nft_mint_address": nft_mint,
                            "nft_token_name": f"Partnership #{partnership_id[:8].upper()}",
                            "nft_explorer_url": nft_url,
                            "updated_at": iso(datetime.utcnow()),
                        }
                    ).eq("id", partnership_id).execute()
            except Exception as exc:
                print(f"  [WARN] NFT mint skipped for {dist['name']}: {str(exc)[:120]}")

        ensure_mou_pdf(partnership_id, dist["name"], terms, mou_hash, refreshed.get("nft_mint_address"))
        print(f"  [OK] {dist['name']} partnership {partnership_id}")


def ensure_mou_pdf(partnership_id: str, distributor_name: str, terms: str, mou_hash: str, nft_mint: str | None):
    try:
        supabase.storage.create_bucket("mou-documents", {"public": True})
    except Exception:
        pass

    filename = f"MOU_{RETAILER_NAME.replace(' ', '_')}_{distributor_name.replace(' ', '_')}.pdf"
    file_path = f"mou/{partnership_id}/{filename}"
    pdf_text = (
        f"MOU AUTOSUP\nRetailer: {RETAILER_NAME}\nDistributor: {distributor_name}\n"
        f"Region: {RETAILER_CITY}\nTerms: {terms}\nHash: {mou_hash}\nNFT: {nft_mint or '-'}\n"
    )
    pdf_bytes = pdf_text.encode("utf-8")
    try:
        supabase.storage.from_("mou-documents").upload(
            file_path,
            pdf_bytes,
            {"content-type": "application/pdf", "upsert": "true"},
        )
    except Exception:
        return

    file_url = f"{os.getenv('SUPABASE_URL')}/storage/v1/object/public/mou-documents/{file_path}"
    supabase.table("partnerships").update(
        {"mou_document_url": file_url, "updated_at": iso(datetime.utcnow())}
    ).eq("id", partnership_id).execute()


def insert_order_if_missing(payload: dict) -> bool:
    existing = (
        supabase.table("orders").select("id").eq("order_number", payload["order_number"]).limit(1).execute().data
        or []
    )
    if existing:
        return False
    supabase.table("orders").insert(payload).execute()
    return True


def sync_inventory_delta(deltas: dict[str, int]):
    print("\n--- Syncing retailer inventory ---")
    lookup = product_map()
    for name, delta in deltas.items():
        if delta == 0:
            continue
        prod = lookup[name]
        existing = (
            supabase.table("inventories")
            .select("id,current_stock")
            .eq("user_id", RETAILER_RAFI)
            .eq("product_name", name)
            .execute()
            .data
            or []
        )
        current = int(existing[0].get("current_stock", 0) or 0) if existing else 0
        new_stock = max(0, current + delta)
        payload = {
            "product_name": name,
            "current_stock": new_stock,
            "user_id": RETAILER_RAFI,
            "price": prod["price"],
            "min_threshold": prod["min_threshold"],
            "category": prod["category"],
            "unit": prod["unit"],
        }
        minimal_payload = {
            "product_name": name,
            "current_stock": new_stock,
            "user_id": RETAILER_RAFI,
        }
        if existing:
            try:
                supabase.table("inventories").update(payload).eq("id", existing[0]["id"]).execute()
            except Exception as exc:
                if "schema cache" not in str(exc) and "column" not in str(exc):
                    raise
                supabase.table("inventories").update(minimal_payload).eq("id", existing[0]["id"]).execute()
        else:
            try:
                supabase.table("inventories").insert({"id": str(uuid.uuid4()), **payload}).execute()
            except Exception as exc:
                if "schema cache" not in str(exc) and "column" not in str(exc):
                    raise
                supabase.table("inventories").insert({"id": str(uuid.uuid4()), **minimal_payload}).execute()
        print(f"  [OK] {name}: delta {delta:+d}, stock {new_stock}")


def seed_purchase_orders() -> dict[str, int]:
    print("\n--- Seeding retailer purchase orders ---")
    inventory_deltas: dict[str, int] = defaultdict(int)
    created = 0

    for month_offset, plans in PURCHASE_PLANS.items():
        for idx, plan in enumerate(plans, start=1):
            items, total = build_items(plan["items"])
            created_at = month_anchor(month_offset, 6 + idx * 4, 10 + idx)
            order_number = f"DBG-RAFI-P-{created_at.strftime('%Y%m')}-{idx}"
            shipping_info = None
            if plan["status"] in {"shipping", "delivered"}:
                shipping_info = {
                    "courier": "JNE",
                    "tracking_number": f"RAFI{created_at.strftime('%m%d')}{idx:02d}",
                }
            payload = {
                "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, order_number)),
                "order_number": order_number,
                "buyer_id": RETAILER_RAFI,
                "buyer_name": RETAILER_NAME,
                "buyer_role": "retailer",
                "seller_id": DIST_NAUFAL,
                "seller_name": DIST_NAME,
                "seller_type": "distributor",
                "items": items,
                "total_price": total,
                "delivery_address": f"Jl. Raya Condet No.{20 + idx}, {RETAILER_CITY}",
                "status": plan["status"],
                "escrow_status": "released" if plan["status"] == "delivered" else "held",
                "shipping_info": shipping_info,
                "status_history": [
                    {"status": "pending", "changed_at": iso(created_at)},
                    {"status": plan["status"], "changed_at": iso(created_at + timedelta(days=2 if plan['status'] == 'delivered' else 1))},
                ],
                "created_at": iso(created_at),
                "updated_at": iso(created_at + timedelta(days=2 if plan["status"] == "delivered" else 1)),
                "notes": "Retailer Rafi debug seed purchase order",
            }
            if insert_order_if_missing(payload):
                created += 1
                if plan["status"] == "delivered":
                    for name, qty in plan["items"].items():
                        inventory_deltas[name] += qty
                print(f"  [OK] {order_number} | {plan['status']:9} | Rp {total:,}")
    print(f"  Created {created} purchase orders")
    return inventory_deltas


def seed_consumer_sales() -> dict[str, int]:
    print("\n--- Seeding retailer consumer sales ---")
    inventory_deltas: dict[str, int] = defaultdict(int)
    created = 0

    for month_offset, plans in CONSUMER_SALES_PLANS.items():
        for idx, item_map in enumerate(plans, start=1):
            items, total = build_items(item_map)
            created_at = month_anchor(month_offset, 10 + idx * 3, 16)
            order_number = f"DBG-RAFI-S-{created_at.strftime('%Y%m')}-{idx}"
            payload = {
                "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, order_number)),
                "order_number": order_number,
                "buyer_id": f"consumer-rafi-{created_at.strftime('%Y%m')}-{idx}",
                "buyer_name": f"Pelanggan Retail {idx}",
                "buyer_role": "consumer",
                "seller_id": RETAILER_RAFI,
                "seller_name": RETAILER_NAME,
                "seller_type": "retailer",
                "items": items,
                "total_price": total,
                "delivery_address": f"Walk-in Store {RETAILER_NAME}, {RETAILER_CITY}",
                "status": "delivered",
                "escrow_status": "released",
                "created_at": iso(created_at),
                "updated_at": iso(created_at),
                "notes": "Retailer Rafi debug seed consumer sale",
            }
            if insert_order_if_missing(payload):
                created += 1
                for name, qty in item_map.items():
                    inventory_deltas[name] -= qty
                print(f"  [OK] {order_number} | delivered | Rp {total:,}")
    print(f"  Created {created} consumer sales")
    return inventory_deltas


def seed_consumer_sales_boost() -> dict[str, int]:
    print("\n--- Seeding boosted consumer sales (profitability profile) ---")
    inventory_deltas: dict[str, int] = defaultdict(int)
    created = 0

    for month_offset, plans in CONSUMER_SALES_BOOST_PLANS.items():
        for idx, item_map in enumerate(plans, start=1):
            items, total = build_items(item_map)
            created_at = month_anchor(month_offset, 21 + idx * 2, 19)
            order_number = f"DBG-RAFI-SB-{created_at.strftime('%Y%m')}-{idx}"
            payload = {
                "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, order_number)),
                "order_number": order_number,
                "buyer_id": f"consumer-rafi-boost-{created_at.strftime('%Y%m')}-{idx}",
                "buyer_name": f"Pelanggan Loyal {idx}",
                "buyer_role": "consumer",
                "seller_id": RETAILER_RAFI,
                "seller_name": RETAILER_NAME,
                "seller_type": "retailer",
                "items": items,
                "total_price": total,
                "delivery_address": f"Walk-in Store {RETAILER_NAME}, {RETAILER_CITY}",
                "status": "delivered",
                "escrow_status": "released",
                "created_at": iso(created_at),
                "updated_at": iso(created_at),
                "notes": "Retailer Rafi boosted consumer sale seed",
            }
            if insert_order_if_missing(payload):
                created += 1
                for name, qty in item_map.items():
                    inventory_deltas[name] -= qty
                print(f"  [OK] {order_number} | delivered | Rp {total:,}")

    print(f"  Created {created} boosted consumer sales")
    return inventory_deltas


def seed_consumer_sales_boost_v2() -> dict[str, int]:
    print("\n--- Seeding boosted consumer sales V2 (ensure sales > spending) ---")
    inventory_deltas: dict[str, int] = defaultdict(int)
    created = 0
    for plan in CONSUMER_SALES_BOOST_V2:
        items, total = build_items(plan["items"])
        payload = {
            "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, plan["order_number"])),
            "order_number": plan["order_number"],
            "buyer_id": f"consumer-rafi-ultra-{plan['order_number'][-8:]}",
            "buyer_name": "Pelanggan Corporate",
            "buyer_role": "consumer",
            "seller_id": RETAILER_RAFI,
            "seller_name": RETAILER_NAME,
            "seller_type": "retailer",
            "items": items,
            "total_price": total,
            "delivery_address": f"Outlet Mitra {RETAILER_NAME}, {RETAILER_CITY}",
            "status": "delivered",
            "escrow_status": "released",
            "created_at": plan["created_at"],
            "updated_at": plan["created_at"],
            "notes": "Retailer Rafi boosted consumer sale seed v2",
        }
        if insert_order_if_missing(payload):
            created += 1
            for name, qty in plan["items"].items():
                inventory_deltas[name] -= qty
            print(f"  [OK] {plan['order_number']} | delivered | Rp {total:,}")
    print(f"  Created {created} boosted consumer sales V2")
    return inventory_deltas


def seed_february_gap() -> dict[str, int]:
    print("\n--- Filling February 2026 gap ---")
    inventory_deltas: dict[str, int] = defaultdict(int)

    purchase_items_map = {"Kopi ABC": 68, "Mie Goreng Indomie": 88, "Gula Pasir 1kg": 20}
    purchase_items, purchase_total = build_items(purchase_items_map)
    purchase_payload = {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "DBG-RAFI-P-202602-FEB")),
        "order_number": "DBG-RAFI-P-202602-FEB",
        "buyer_id": RETAILER_RAFI,
        "buyer_name": RETAILER_NAME,
        "buyer_role": "retailer",
        "seller_id": DIST_NAUFAL,
        "seller_name": DIST_NAME,
        "seller_type": "distributor",
        "items": purchase_items,
        "total_price": purchase_total,
        "delivery_address": f"Jl. Raya Condet No.29, {RETAILER_CITY}",
        "status": "delivered",
        "escrow_status": "released",
        "shipping_info": {"courier": "J&T", "tracking_number": "RAFI0226FEB"},
        "created_at": "2026-02-14T10:00:00Z",
        "updated_at": "2026-02-16T10:00:00Z",
        "notes": "Retailer Rafi debug seed purchase order",
    }
    if insert_order_if_missing(purchase_payload):
        for name, qty in purchase_items_map.items():
            inventory_deltas[name] += qty
        print(f"  [OK] {purchase_payload['order_number']} | delivered | Rp {purchase_total:,}")

    sales_items_map = {"Kopi ABC": 61, "Mie Goreng Indomie": 79, "Teh Celup Sariwangi 25s": 11}
    sales_items, sales_total = build_items(sales_items_map)
    sales_payload = {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "DBG-RAFI-S-202602-FEB")),
        "order_number": "DBG-RAFI-S-202602-FEB",
        "buyer_id": "consumer-rafi-202602-feb",
        "buyer_name": "Pelanggan Retail FEB",
        "buyer_role": "consumer",
        "seller_id": RETAILER_RAFI,
        "seller_name": RETAILER_NAME,
        "seller_type": "retailer",
        "items": sales_items,
        "total_price": sales_total,
        "delivery_address": f"Walk-in Store {RETAILER_NAME}, {RETAILER_CITY}",
        "status": "delivered",
        "escrow_status": "released",
        "created_at": "2026-02-20T16:00:00Z",
        "updated_at": "2026-02-20T16:00:00Z",
        "notes": "Retailer Rafi debug seed consumer sale",
    }
    if insert_order_if_missing(sales_payload):
        for name, qty in sales_items_map.items():
            inventory_deltas[name] -= qty
        print(f"  [OK] {sales_payload['order_number']} | delivered | Rp {sales_total:,}")

    return inventory_deltas


def seed_partner_purchase_orders() -> dict[str, int]:
    print("\n--- Seeding additional distributor orders ---")
    inventory_deltas: dict[str, int] = defaultdict(int)
    created = 0

    for distributor_id, orders in PARTNER_PURCHASES.items():
        for order in orders:
            items, total = build_items(order["items"])
            shipping_info = None
            if order["status"] in {"shipping", "delivered"}:
                shipping_info = {
                    "courier": "SiCepat" if distributor_id == DIST_PRIMA else "J&T",
                    "tracking_number": f"{order['order_number'][-8:]}TRK",
                }
            payload = {
                "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, order["order_number"])),
                "order_number": order["order_number"],
                "buyer_id": RETAILER_RAFI,
                "buyer_name": RETAILER_NAME,
                "buyer_role": "retailer",
                "seller_id": distributor_id,
                "seller_name": order["seller_name"],
                "seller_type": "distributor",
                "items": items,
                "total_price": total,
                "delivery_address": f"Jl. Raya Condet No.77, {RETAILER_CITY}",
                "status": order["status"],
                "escrow_status": "released" if order["status"] == "delivered" else "held",
                "shipping_info": shipping_info,
                "created_at": order["created_at"],
                "updated_at": order["created_at"],
                "notes": "Retailer Rafi multi-distributor debug seed",
            }
            if insert_order_if_missing(payload):
                created += 1
                if order["status"] == "delivered":
                    for name, qty in order["items"].items():
                        inventory_deltas[name] += qty
                print(f"  [OK] {order['seller_name'][:24]:24} | {order['status']:10} | {order['order_number']}")
    print(f"  Created {created} additional distributor orders")
    return inventory_deltas


def upsert_credit_account(distributor: dict, utilized_amount: int, next_due_amount: int, status: str, opened_at: str, next_due_date: str):
    existing = (
        supabase.table("credit_accounts")
        .select("id")
        .eq("retailer_id", RETAILER_RAFI)
        .eq("distributor_id", distributor["id"])
        .limit(1)
        .execute()
        .data
        or []
    )
    payload = {
        "retailer_id": RETAILER_RAFI,
        "distributor_id": distributor["id"],
        "credit_limit": distributor["credit_limit"],
        "utilized_amount": utilized_amount,
        "status": status,
        "risk_level": distributor["risk_level"],
        "credit_account_number": f"CRD-{distributor['prefix']}",
        "billing_cycle_days": distributor["billing_cycle_days"],
        "opened_at": opened_at,
        "next_due_date": next_due_date,
        "next_due_amount": next_due_amount,
    }
    if existing:
        supabase.table("credit_accounts").update(payload).eq("id", existing[0]["id"]).execute()
    else:
        supabase.table("credit_accounts").insert({"id": str(uuid.uuid4()), **payload}).execute()


def upsert_invoice(invoice_id: str, payload: dict):
    existing = supabase.table("invoices").select("id").eq("id", invoice_id).limit(1).execute().data or []
    minimal_payload = {
        "order_id": payload.get("order_id"),
        "buyer_id": payload.get("buyer_id"),
        "seller_id": payload.get("seller_id"),
        "seller_name": payload.get("seller_name"),
        "amount": payload.get("amount", 0),
        "status": payload.get("status", "pending"),
        "due_date": payload.get("due_date"),
        "created_at": payload.get("created_at"),
    }
    try:
        if existing:
            supabase.table("invoices").update(payload).eq("id", invoice_id).execute()
        else:
            supabase.table("invoices").insert({"id": invoice_id, **payload}).execute()
    except Exception as exc:
        if "schema cache" not in str(exc) and "column" not in str(exc):
            raise
        if existing:
            supabase.table("invoices").update(minimal_payload).eq("id", invoice_id).execute()
        else:
            supabase.table("invoices").insert({"id": invoice_id, **minimal_payload}).execute()


def upsert_payment(payment_id: str, payload: dict):
    existing = supabase.table("payments").select("id").eq("id", payment_id).limit(1).execute().data or []
    minimal_payload = {
        "order_id": payload.get("order_id"),
        "payer_id": payload.get("payer_id"),
        "payee_id": payload.get("payee_id"),
        "counterpart_name": payload.get("counterpart_name"),
        "amount": payload.get("amount", 0),
        "type": payload.get("type", "receivable"),
        "status": payload.get("status", "pending"),
        "created_at": payload.get("created_at"),
    }
    try:
        if existing:
            supabase.table("payments").update(payload).eq("id", payment_id).execute()
        else:
            supabase.table("payments").insert({"id": payment_id, **payload}).execute()
    except Exception as exc:
        if "schema cache" not in str(exc) and "column" not in str(exc):
            raise
        if existing:
            supabase.table("payments").update(minimal_payload).eq("id", payment_id).execute()
        else:
            supabase.table("payments").insert({"id": payment_id, **minimal_payload}).execute()


def seed_financials():
    print("\n--- Seeding multi-distributor financial data ---")
    all_orders = (
        supabase.table("orders")
        .select("id,order_number,seller_id,seller_name,total_price,status,created_at")
        .eq("buyer_id", RETAILER_RAFI)
        .execute()
        .data
        or []
    )
    by_distributor: dict[str, list[dict]] = defaultdict(list)
    for order in all_orders:
        by_distributor[order.get("seller_id", "")].append(order)

    for idx, distributor in enumerate(DISTRIBUTORS, start=1):
        dist_orders = sorted(by_distributor.get(distributor["id"], []), key=lambda item: item.get("created_at", ""))
        delivered_total = sum(int(order.get("total_price", 0) or 0) for order in dist_orders if order.get("status") == "delivered")
        outstanding_total = sum(int(order.get("total_price", 0) or 0) for order in dist_orders if order.get("status") in {"pending", "processing", "shipping"})
        utilized = min(distributor["credit_limit"], outstanding_total or max(0, delivered_total // 3))
        next_due_amount = distributor["next_due_amount"] or min(utilized, max(0, delivered_total // 4))
        opened_at = iso(datetime.utcnow() - timedelta(days=90 - idx * 10))
        next_due_date = iso(datetime.utcnow() + timedelta(days=7 + idx))
        status = "overdue" if distributor["id"] == DIST_BEKASI else "active"
        if distributor["id"] == DIST_BEKASI:
            next_due_date = iso(datetime.utcnow() - timedelta(days=4))
        upsert_credit_account(distributor, utilized, next_due_amount, status, opened_at, next_due_date)
        print(f"  [OK] credit {distributor['name']}: utilized Rp {utilized:,}")

        for order in dist_orders:
            invoice_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"INV-{order['order_number']}"))
            is_paid = order.get("status") == "delivered"
            invoice_status = "paid" if is_paid else ("overdue" if distributor["id"] == DIST_BEKASI and order.get("status") == "shipping" else "pending")
            due_dt = _safe_invoice_due(order.get("created_at", ""), distributor["billing_cycle_days"], invoice_status == "overdue")
            upsert_invoice(
                invoice_id,
                {
                    "order_id": order.get("id"),
                    "buyer_id": RETAILER_RAFI,
                    "buyer_name": RETAILER_NAME,
                    "seller_id": distributor["id"],
                    "seller_name": distributor["name"],
                    "amount": int(order.get("total_price", 0) or 0),
                    "status": invoice_status,
                    "due_date": due_dt,
                    "created_at": order.get("created_at"),
                    "paid_at": order.get("created_at") if is_paid else None,
                },
            )
            upsert_payment(
                str(uuid.uuid5(uuid.NAMESPACE_DNS, f"PAY-{order['order_number']}")),
                {
                    "order_id": order.get("id"),
                    "payer_id": RETAILER_RAFI,
                    "payee_id": distributor["id"],
                    "counterpart_name": distributor["name"],
                    "amount": int(order.get("total_price", 0) or 0),
                    "type": "receivable",
                    "status": "paid" if invoice_status == "paid" else invoice_status,
                    "created_at": order.get("created_at"),
                },
            )


def _safe_invoice_due(created_at: str, billing_cycle_days: int, overdue: bool = False) -> str:
    try:
        base = datetime.fromisoformat(created_at.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        base = datetime.utcnow()
    due = base + timedelta(days=billing_cycle_days)
    if overdue:
        due = datetime.utcnow() - timedelta(days=4)
    return iso(due)


def main():
    print("=" * 72)
    print("SEED RETAILER RAFI DEBUG DATA")
    print("=" * 72)
    ensure_partnership()
    ensure_distributor_inventory()
    purchase_deltas = seed_purchase_orders()
    partner_purchase_deltas = seed_partner_purchase_orders()
    sales_deltas = seed_consumer_sales()
    boosted_sales_deltas = seed_consumer_sales_boost()
    boosted_sales_deltas_v2 = seed_consumer_sales_boost_v2()
    february_deltas = seed_february_gap()

    combined: dict[str, int] = defaultdict(int)
    for source in (purchase_deltas, partner_purchase_deltas, sales_deltas, boosted_sales_deltas, boosted_sales_deltas_v2, february_deltas):
        for name, qty in source.items():
            combined[name] += qty
    sync_inventory_delta(combined)
    seed_financials()

    orders = (
        supabase.table("orders")
        .select("buyer_id,seller_id,buyer_role,seller_type,status,total_price,created_at")
        .or_(f"buyer_id.eq.{RETAILER_RAFI},seller_id.eq.{RETAILER_RAFI}")
        .execute()
        .data
        or []
    )
    spending = sum(
        int(o.get("total_price", 0) or 0)
        for o in orders
        if o.get("buyer_id") == RETAILER_RAFI and o.get("status") == "delivered"
    )
    consumer_sales = sum(
        int(o.get("total_price", 0) or 0)
        for o in orders
        if o.get("seller_id") == RETAILER_RAFI
        and o.get("seller_type") == "retailer"
        and o.get("buyer_role") == "consumer"
        and o.get("status") == "delivered"
    )
    print("\n--- Retailer economics snapshot ---")
    print(f"  Delivered distributor spending : Rp {spending:,}")
    print(f"  Delivered consumer sales      : Rp {consumer_sales:,}")
    print(f"  Sales minus spending          : Rp {consumer_sales - spending:,}")

    print("\nDone.")


if __name__ == "__main__":
    main()
