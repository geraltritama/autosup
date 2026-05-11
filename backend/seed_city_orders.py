"""
Seed orders from distributors in additional cities near Jakarta + Java.
Creates buyer entries and orders so regional map shows more pins.
"""
import os, uuid, random
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

SUPPLIER_ID = "eb19df91-cf38-4441-b462-40530ab95d02"
SUPPLIER_NAME = "Toko Geral"

# New distributors with city in name (so _extract_city picks them up)
NEW_DISTRIBUTORS = [
    {"name": "CV Maju Jaya Bandung", "city": "Bandung"},
    {"name": "PT Logistik Bekasi Mandiri", "city": "Bekasi"},
    {"name": "CV Tangerang Sejahtera", "city": "Tangerang"},
    {"name": "PT Bogor Makmur Distribusi", "city": "Bogor"},
    {"name": "CV Semarang Niaga Utama", "city": "Semarang"},
    {"name": "PT Yogyakarta Supply Chain", "city": "Yogyakarta"},
]

# Fetch supplier inventory
inventory = supabase.table("inventories").select("product_name,price,unit").eq("user_id", SUPPLIER_ID).execute().data or []
products = [i for i in inventory if i.get("product_name") and i["product_name"] not in ("Kopi ABC", "Saus ABC", "Cooking Oil 1L")]
print(f"Products: {[p['product_name'] for p in products]}")

random.seed(99)

# Volume profiles per city (varied to make map interesting)
city_volume_scale = {
    "Bandung": 0.6,
    "Bekasi": 0.5,
    "Tangerang": 0.45,
    "Bogor": 0.35,
    "Semarang": 0.4,
    "Yogyakarta": 0.3,
}

orders_inserted = 0

for dist_info in NEW_DISTRIBUTORS:
    dist_id = str(uuid.uuid4())
    dist_name = dist_info["name"]
    city = dist_info["city"]
    scale = city_volume_scale[city]

    # Create 3-4 orders in May (current month) and 2 in April (prev month)
    may_dates = [f"2026-05-{random.randint(1,11):02d}T{random.randint(8,17):02d}:{random.randint(0,59):02d}:00+00:00" for _ in range(4)]
    april_dates = [f"2026-04-{random.randint(5,28):02d}T{random.randint(8,17):02d}:{random.randint(0,59):02d}:00+00:00" for _ in range(2)]

    all_dates = may_dates + april_dates

    for order_date in all_dates:
        items = []
        total = 0.0
        # Pick 3-5 products
        order_products = random.sample(products, min(random.randint(3, 5), len(products)))
        for prod in order_products:
            base_qty = random.randint(20, 150)
            qty = max(5, int(base_qty * scale))
            price = float(prod.get("price") or 10000)
            subtotal = qty * price
            total += subtotal
            items.append({
                "item_name": prod["product_name"],
                "qty": qty,
                "unit_price": price,
                "price_per_unit": price,
                "subtotal": subtotal,
                "unit": prod.get("unit", "unit"),
            })

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
            "notes": "Seeded regional city order",
        }

        try:
            supabase.table("orders").insert(order).execute()
            orders_inserted += 1
        except Exception as e:
            print(f"  Error: {e}")

print(f"\nDone. Inserted {orders_inserted} orders for {len(NEW_DISTRIBUTORS)} new city distributors.")
