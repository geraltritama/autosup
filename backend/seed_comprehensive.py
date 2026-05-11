"""
Seed comprehensive data for distributor Naufal DIstri:
- More inventory items (from supplier Toko Geral products)
- Shipments (various statuses)
- Historical orders (3 months back for analytics)
- Credit line variations (overdue, frozen)
Run: cd backend && python seed_comprehensive.py
"""
import os, uuid, random
from datetime import datetime, timedelta
from dotenv import load_dotenv
load_dotenv()

from supabase import create_client

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

DIST_NAUFAL = "45cbdf58-c6ef-4a34-a3b5-3d6bdbedea2d"
SUPPLIER_GERAL = "eb19df91-cf38-4441-b462-40530ab95d02"
RETAILER_RAFI = "05fab453-bdd4-4f2d-851a-0407dd830c9d"
RETAILER_BUMI = "9bbc6ffc-0d3e-47b7-84c3-2a2d1f30e183"
RETAILER_SEMBAKO = "502bd2dd-6471-406d-b652-80efd297bf5d"

now = datetime.utcnow()
def iso(dt): return dt.isoformat() + "Z"

print("=" * 60)
print("SEEDING COMPREHENSIVE DATA")
print("=" * 60)

# ─── 1. INVENTORY (more items for Naufal) ───
print("\n--- Adding inventory items ---")

new_items = [
    {"product_name": "Saus Sambal ABC 340ml", "category": "Condiments", "current_stock": 45, "min_threshold": 20, "unit": "btl", "price": 9500},
    {"product_name": "Kecap Manis Bango 600ml", "category": "Condiments", "current_stock": 30, "min_threshold": 15, "unit": "btl", "price": 14000},
    {"product_name": "Mie Goreng Indomie", "category": "Instant Food", "current_stock": 200, "min_threshold": 100, "unit": "pcs", "price": 3200},
    {"product_name": "Gula Pasir 1kg", "category": "Staples", "current_stock": 8, "min_threshold": 25, "unit": "kg", "price": 14500},
    {"product_name": "Beras Premium 5kg", "category": "Staples", "current_stock": 15, "min_threshold": 10, "unit": "sak", "price": 72000},
    {"product_name": "Susu UHT Indomilk 1L", "category": "Beverages", "current_stock": 0, "min_threshold": 30, "unit": "pcs", "price": 16000},
    {"product_name": "Teh Celup Sariwangi 25s", "category": "Beverages", "current_stock": 60, "min_threshold": 20, "unit": "box", "price": 8500},
    {"product_name": "Sabun Cuci Sunlight 800ml", "category": "Household", "current_stock": 3, "min_threshold": 15, "unit": "btl", "price": 12000},
]

for item in new_items:
    item["id"] = str(uuid.uuid4())
    item["user_id"] = DIST_NAUFAL
    try:
        supabase.table("inventories").insert(item).execute()
        status = "OUT" if item["current_stock"] == 0 else "LOW" if item["current_stock"] < item["min_threshold"] else "OK"
        print(f"  [{status:3}] {item['product_name']}: {item['current_stock']}/{item['min_threshold']}")
    except Exception as e:
        print(f"  [ERR] {item['product_name']}: {e}")

# ─── 2. SHIPMENTS ───
print("\n--- Creating shipments ---")

retailers_info = [
    {"id": RETAILER_RAFI, "name": "Toko Rafi Jaya", "city": "Jakarta Timur"},
    {"id": RETAILER_BUMI, "name": "Bumi pp", "city": "Bekasi"},
    {"id": RETAILER_SEMBAKO, "name": "Warung Sembako Ibu Sari", "city": "Depok"},
]

shipment_data = [
    {"status": "in_transit", "carrier": "JNE", "days_ago": 1, "retailer_idx": 0},
    {"status": "in_transit", "carrier": "J&T", "days_ago": 0, "retailer_idx": 1},
    {"status": "delivered", "carrier": "SiCepat", "days_ago": 3, "retailer_idx": 2},
    {"status": "delivered", "carrier": "JNE", "days_ago": 5, "retailer_idx": 0},
    {"status": "delayed", "carrier": "J&T", "days_ago": 4, "retailer_idx": 1},
    {"status": "packed", "carrier": "AnterAja", "days_ago": 0, "retailer_idx": 2},
]

for sh in shipment_data:
    r = retailers_info[sh["retailer_idx"]]
    row = {
        "id": str(uuid.uuid4()),
        "order_id": str(uuid.uuid4()),
        "sender_id": DIST_NAUFAL,
        "receiver_id": r["id"],
        "retailer_name": r["name"],
        "destination": f"Jl. Utama No.{random.randint(1,50)}, {r['city']}",
        "carrier": sh["carrier"],
        "status": sh["status"],
        "eta": iso(now + timedelta(days=2 - sh["days_ago"])),
        "created_at": iso(now - timedelta(days=sh["days_ago"])),
    }
    try:
        supabase.table("shipments").insert(row).execute()
        print(f"  [OK] {sh['status']:10} | {sh['carrier']:8} | → {r['name'][:15]}")
    except Exception as e:
        print(f"  [ERR] {e}")

# ─── 3. HISTORICAL ORDERS (for analytics trends) ───
print("\n--- Creating historical orders (3 months) ---")

PRODUCTS = [
    {"name": "Kopi ABC", "price": 8500, "unit": "pcs"},
    {"name": "Mie Goreng Indomie", "price": 3200, "unit": "pcs"},
    {"name": "Gula Pasir 1kg", "price": 14500, "unit": "kg"},
    {"name": "Saus Sambal ABC 340ml", "price": 9500, "unit": "btl"},
    {"name": "Beras Premium 5kg", "price": 72000, "unit": "sak"},
    {"name": "Susu UHT Indomilk 1L", "price": 16000, "unit": "pcs"},
]

historical_orders = []
for month_offset in range(1, 4):  # 1, 2, 3 months ago
    for _ in range(random.randint(4, 7)):
        retailer = random.choice(retailers_info)
        days_ago = month_offset * 30 + random.randint(0, 25)
        items_count = random.randint(1, 3)
        items = []
        for prod in random.sample(PRODUCTS, items_count):
            qty = random.randint(5, 30)
            items.append({
                "name": prod["name"], "product_name": prod["name"],
                "qty": qty, "quantity": qty,
                "price_per_unit": prod["price"],
                "subtotal": qty * prod["price"], "unit": prod["unit"],
            })
        total = sum(i["subtotal"] for i in items)
        created = iso(now - timedelta(days=days_ago))
        order = {
            "id": str(uuid.uuid4()),
            "order_number": f"ORD-{uuid.uuid4().hex[:8].upper()}",
            "buyer_id": retailer["id"],
            "buyer_name": retailer["name"],
            "buyer_role": "retailer",
            "seller_id": DIST_NAUFAL,
            "seller_name": "Naufal DIstri",
            "seller_type": "distributor",
            "items": items,
            "total_price": total,
            "delivery_address": f"Jl. Raya No.{random.randint(1,99)}, {retailer['city']}",
            "status": "delivered",
            "escrow_status": "released",
            "created_at": created,
        }
        historical_orders.append(order)

for o in historical_orders:
    try:
        supabase.table("orders").insert(o).execute()
    except Exception:
        pass

print(f"  [OK] Created {len(historical_orders)} historical orders (delivered)")

# Also add some from Naufal buying from Toko Geral (historical)
print("\n--- Historical orders (Naufal → Toko Geral) ---")
supplier_historical = 0
for month_offset in range(1, 4):
    for _ in range(random.randint(2, 4)):
        days_ago = month_offset * 30 + random.randint(0, 25)
        items_count = random.randint(1, 3)
        items = []
        for prod in random.sample(PRODUCTS, items_count):
            qty = random.randint(20, 100)
            items.append({
                "name": prod["name"], "product_name": prod["name"],
                "qty": qty, "quantity": qty,
                "price_per_unit": prod["price"],
                "subtotal": qty * prod["price"], "unit": prod["unit"],
            })
        total = sum(i["subtotal"] for i in items)
        order = {
            "id": str(uuid.uuid4()),
            "order_number": f"ORD-{uuid.uuid4().hex[:8].upper()}",
            "buyer_id": DIST_NAUFAL,
            "buyer_name": "Naufal DIstri",
            "buyer_role": "distributor",
            "seller_id": SUPPLIER_GERAL,
            "seller_name": "Toko Geral",
            "seller_type": "supplier",
            "items": items,
            "total_price": total,
            "delivery_address": f"Gudang Naufal, Cikarang",
            "status": "delivered",
            "escrow_status": "released",
            "created_at": iso(now - timedelta(days=days_ago)),
        }
        try:
            supabase.table("orders").insert(order).execute()
            supplier_historical += 1
        except Exception:
            pass

print(f"  [OK] Created {supplier_historical} historical orders to supplier")

# ─── 4. CREDIT LINE VARIATIONS ───
print("\n--- Adding credit line variations ---")

# Update Sembako to overdue
try:
    supabase.table("credit_accounts").update({
        "status": "overdue",
        "risk_level": "high",
        "next_due_date": iso(now - timedelta(days=5)),
    }).eq("retailer_id", RETAILER_SEMBAKO).eq("distributor_id", DIST_NAUFAL).execute()
    print("  [OK] Sembako credit → overdue (5 days past due)")
except Exception as e:
    print(f"  [ERR] {e}")

# Add a frozen credit account (for a retailer that defaulted)
try:
    supabase.table("credit_accounts").insert({
        "id": str(uuid.uuid4()),
        "retailer_id": RETAILER_BUMI,
        "distributor_id": DIST_NAUFAL,
        "partnership_id": None,
        "credit_limit": 10000000,
        "utilized_amount": 8500000,
        "status": "frozen",
        "risk_level": "high",
        "credit_account_number": "CRD-0004",
        "billing_cycle_days": 30,
        "opened_at": iso(now - timedelta(days=90)),
        "next_due_date": iso(now - timedelta(days=15)),
        "next_due_amount": 8500000,
    }).execute()
    print("  [OK] Bumi credit #2 → frozen (Rp 8.5M outstanding, 15 days overdue)")
except Exception as e:
    # Might conflict with existing
    print(f"  [SKIP] Bumi frozen: {str(e)[:50]}")

print(f"\n{'=' * 60}")
print("ALL DONE!")
print(f"{'=' * 60}")
