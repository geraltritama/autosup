"""
Seed orders between Distributor Naufal and partner Retailers.
Run: cd backend && python seed_retailer_orders.py
"""
import os, uuid, random
from datetime import datetime, timedelta
from dotenv import load_dotenv
load_dotenv()

from supabase import create_client

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# ─── IDs ───
DIST_NAUFAL = "45cbdf58-c6ef-4a34-a3b5-3d6bdbedea2d"
RETAILER_BUMI = "9bbc6ffc-0d3e-47b7-84c3-2a2d1f30e183"
RETAILER_RAFI = "05fab453-bdd4-4f2d-851a-0407dd830c9d"
RETAILER_SEMBAKO = "502bd2dd-6471-406d-b652-80efd297bf5d"

PRODUCTS = [
    {"name": "Kopi ABC", "price": 8500, "unit": "pcs"},
    {"name": "Tepung Terigu", "price": 15000, "unit": "kg"},
    {"name": "Granulated Sugar 1kg", "price": 14000, "unit": "kg"},
    {"name": "Instant Noodle Chicken Curry", "price": 3500, "unit": "pcs"},
    {"name": "Cooking Oil 1L", "price": 18000, "unit": "btl"},
    {"name": "Sweet Soy Sauce 600ml", "price": 12000, "unit": "btl"},
    {"name": "Chili Sauce 340ml", "price": 9500, "unit": "btl"},
    {"name": "Ground Coffee 200g", "price": 22000, "unit": "pcs"},
]

RETAILERS = [
    {"id": RETAILER_BUMI, "name": "Bumi pp", "city": "Bekasi"},
    {"id": RETAILER_RAFI, "name": "Toko Rafi Jaya", "city": "Jakarta Timur"},
    {"id": RETAILER_SEMBAKO, "name": "Warung Sembako Ibu Sari", "city": "Depok"},
]

STATUSES = ["delivered", "delivered", "delivered", "delivered", "processing", "shipping", "pending"]


def create_order(retailer, days_ago, status):
    items_count = random.randint(1, 4)
    items = []
    for prod in random.sample(PRODUCTS, items_count):
        qty = random.randint(5, 50)
        items.append({
            "name": prod["name"],
            "product_name": prod["name"],
            "qty": qty,
            "quantity": qty,
            "price_per_unit": prod["price"],
            "subtotal": qty * prod["price"],
            "unit": prod["unit"],
        })

    total = sum(i["subtotal"] for i in items)
    created = (datetime.utcnow() - timedelta(days=days_ago, hours=random.randint(0, 12))).isoformat() + "Z"
    order_id = str(uuid.uuid4())

    payload = {
        "id": order_id,
        "order_number": f"ORD-{order_id[:8].upper()}",
        "buyer_id": retailer["id"],
        "buyer_name": retailer["name"],
        "buyer_role": "retailer",
        "seller_id": DIST_NAUFAL,
        "seller_name": "Naufal DIstri",
        "seller_type": "distributor",
        "items": items,
        "total_price": total,
        "delivery_address": f"Jl. Utama No.{random.randint(1,99)}, {retailer['city']}",
        "status": status,
        "escrow_status": "released" if status == "delivered" else "held",
        "created_at": created,
    }

    if status in ("shipping", "delivered"):
        payload["shipping_info"] = {"courier": random.choice(["JNE", "J&T", "SiCepat"]), "tracking_number": f"TRK{random.randint(100000,999999)}"}

    return payload


print("Seeding distributor↔retailer orders...")

orders = []
for retailer in RETAILERS:
    # 4-6 orders per retailer, spread over last 30 days
    num_orders = random.randint(4, 6)
    for i in range(num_orders):
        days_ago = random.randint(1, 30)
        status = random.choice(STATUSES)
        orders.append(create_order(retailer, days_ago, status))

# Batch insert
for o in orders:
    try:
        supabase.table("orders").insert(o).execute()
        print(f"  [OK] {o['buyer_name'][:15]} | {o['status']:10} | Rp {o['total_price']:>10,} | {len(o['items'])} items")
    except Exception as e:
        print(f"  [ERR] {e}")

print(f"\nDone! Seeded {len(orders)} orders.")
