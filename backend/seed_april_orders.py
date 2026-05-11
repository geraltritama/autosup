"""
Seed April 2026 orders for Toko Geral supplier.
Creates historical orders so Rising vs Declining comparison works (current=May vs prev=April).
"""
import os, uuid, random
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

SUPPLIER_ID = "eb19df91-cf38-4441-b462-40530ab95d02"
SUPPLIER_NAME = "Toko Geral"

# --- Fetch all buyers from existing delivered orders (same set as May data) ---
existing_orders = supabase.table("orders").select("buyer_id,buyer_name").eq("seller_id", SUPPLIER_ID).eq("status", "delivered").execute().data or []
dist_map = {}
for o in existing_orders:
    bid = o.get("buyer_id")
    bname = o.get("buyer_name") or bid
    if bid:
        dist_map[bid] = bname

dist_ids = list(dist_map.keys())
print(f"Found {len(dist_ids)} buyers from existing orders")

# --- Fetch supplier inventory ---
inventory = supabase.table("inventories").select("product_name,price,unit").eq("user_id", SUPPLIER_ID).execute().data or []
products = [i for i in inventory if i.get("product_name")]
print(f"Products: {[p['product_name'] for p in products]}")

# --- April 2026 date range ---
random.seed(42)
april_dates = [
    f"2026-04-{day:02d}T{random.randint(8,18):02d}:{random.randint(0,59):02d}:00+00:00"
    for day in range(1, 30)
]

# May 1-11 actuals: Paper Cup 3790, Sugar 134, Coffee 212, SoySauce 126, Tepung 258
# April targets (full month, but we want comparison to show clear signal):
#   RISING in May  → April total LOWER than May 1-11
#   DECLINING in May → April total HIGHER than May 1-11
#
# Per-order qty (11 dist × ~2.5 orders = ~27 orders total):
# Rising: Sugar → April total ~60 (< May 134), Coffee → April total ~80 (< May 212)
# Declining: Paper Cup → April total ~5500 (> May 3790), SoySauce → April total ~200 (> May 126)
april_per_order_profile = {
    "Paper Cup 12oz":        (180, 230),  # ~27 orders × 200 avg = ~5400 > May 3790 → declining
    "Granulated Sugar 1kg":  (1, 3),      # ~27 orders × 2 avg = ~54 < May 134 → rising
    "Sweet Soy Sauce 600ml": (6, 9),      # ~27 orders × 7.5 avg = ~200 > May 126 → declining
    "Ground Coffee 200g":    (1, 4),      # ~27 orders × 2.5 avg = ~67 < May 212 → rising
    "Tepung Terigu":         (9, 13),     # ~27 orders × 11 avg = ~297 > May 258 → slight decline
}

orders_inserted = 0

for dist_id in dist_ids:
    dist_name = dist_map[dist_id]
    num_orders = random.randint(2, 3)

    for _ in range(num_orders):
        items = []
        total = 0.0

        # Pick products based on profile
        for prod in products:
            pname = prod["product_name"]
            if pname not in april_per_order_profile:
                continue
            lo, hi = april_per_order_profile[pname]
            qty = random.randint(lo, hi)
            price = float(prod.get("price") or 10000)
            subtotal = qty * price
            total += subtotal
            items.append({
                "product_name": pname,
                "quantity": qty,
                "unit_price": price,
                "price_per_unit": price,
                "subtotal": subtotal,
                "unit": prod.get("unit", "unit"),
            })

        if not items:
            continue

        order_date = random.choice(april_dates)
        order = {
            "id": str(uuid.uuid4()),
            "seller_id": SUPPLIER_ID,
            "seller_name": SUPPLIER_NAME,
            "buyer_id": dist_id,
            "buyer_name": dist_name,
            "buyer_role": "distributor",
            "seller_type": "supplier",
            "items": items,
            "total_price": total,
            "status": "delivered",
            "escrow_status": "released",
            "created_at": order_date,
            "updated_at": order_date,
            "notes": "Seeded April 2026 historical order",
        }

        try:
            supabase.table("orders").insert(order).execute()
            orders_inserted += 1
        except Exception as e:
            print(f"  Error: {e}")

print(f"\nDone. Inserted {orders_inserted} April 2026 orders.")
