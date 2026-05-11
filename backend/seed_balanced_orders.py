"""
Seed balanced historical orders for better analytics:
- Even distribution across months (fixes revenue growth & demand stability)
- Delivery addresses with city names (fixes regional demand)
- More product variety (fixes top products)
Run: cd backend && python seed_balanced_orders.py
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

PRODUCTS = [
    {"name": "Kopi ABC", "price": 8500, "unit": "pcs"},
    {"name": "Mie Goreng Indomie", "price": 3200, "unit": "pcs"},
    {"name": "Gula Pasir 1kg", "price": 14500, "unit": "kg"},
    {"name": "Saus Sambal ABC 340ml", "price": 9500, "unit": "btl"},
    {"name": "Beras Premium 5kg", "price": 72000, "unit": "sak"},
    {"name": "Susu UHT Indomilk 1L", "price": 16000, "unit": "pcs"},
    {"name": "Kecap Manis Bango 600ml", "price": 14000, "unit": "btl"},
    {"name": "Teh Celup Sariwangi 25s", "price": 8500, "unit": "box"},
    {"name": "Sabun Cuci Sunlight 800ml", "price": 12000, "unit": "btl"},
    {"name": "Cooking Oil 1L", "price": 18000, "unit": "btl"},
]

RETAILERS = [
    {"id": RETAILER_RAFI, "name": "Toko Rafi Jaya", "city": "Jakarta Timur"},
    {"id": RETAILER_BUMI, "name": "Bumi pp", "city": "Bekasi"},
    {"id": RETAILER_SEMBAKO, "name": "Warung Sembako Ibu Sari", "city": "Depok"},
]

ADDRESSES = {
    "Jakarta Timur": ["Jl. Raya Jatinegara No.12, Jakarta Timur", "Jl. Matraman Raya No.45, Jakarta Timur", "Jl. Pemuda No.8, Jakarta Timur"],
    "Bekasi": ["Jl. Ahmad Yani No.33, Bekasi", "Jl. Juanda No.17, Bekasi Selatan", "Perum Grand Cikarang Blok E, Bekasi"],
    "Depok": ["Jl. Margonda Raya No.22, Depok", "Jl. Sawangan No.5, Depok", "Jl. Nusantara No.11, Depok"],
}

print("=" * 60)
print("SEEDING BALANCED ORDERS FOR ANALYTICS")
print("=" * 60)

# ─── Orders from retailers to Naufal (OUTGOING/REVENUE) ───
# Target: ~8 orders/month for last 5 months, consistent volume
print("\n--- Retailer → Naufal (revenue) ---")
revenue_orders = 0
for month_offset in range(5):  # 0=this month, 1=last month, ... 4=4 months ago
    # 7-9 orders per month for consistency
    num_orders = random.randint(7, 9)
    for _ in range(num_orders):
        retailer = random.choice(RETAILERS)
        day = random.randint(1, 28)
        order_date = now.replace(day=1) - timedelta(days=month_offset * 30) + timedelta(days=day)
        if order_date > now:
            order_date = now - timedelta(days=random.randint(1, 5))

        items_count = random.randint(2, 4)
        items = []
        for prod in random.sample(PRODUCTS, items_count):
            qty = random.randint(5, 25)
            items.append({
                "name": prod["name"], "product_name": prod["name"],
                "qty": qty, "quantity": qty,
                "price_per_unit": prod["price"],
                "subtotal": qty * prod["price"], "unit": prod["unit"],
            })
        total = sum(i["subtotal"] for i in items)
        addr = random.choice(ADDRESSES[retailer["city"]])

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
            "delivery_address": addr,
            "status": "delivered",
            "escrow_status": "released",
            "created_at": iso(order_date),
        }
        try:
            supabase.table("orders").insert(order).execute()
            revenue_orders += 1
        except Exception:
            pass

print(f"  [OK] {revenue_orders} orders (revenue, 5 months)")

# ─── Orders from Naufal to Toko Geral (SPENDING) ───
# Target: ~4 orders/month for consistency
print("\n--- Naufal → Toko Geral (spending) ---")
spending_orders = 0
for month_offset in range(5):
    num_orders = random.randint(3, 5)
    for _ in range(num_orders):
        day = random.randint(1, 28)
        order_date = now.replace(day=1) - timedelta(days=month_offset * 30) + timedelta(days=day)
        if order_date > now:
            order_date = now - timedelta(days=random.randint(1, 5))

        items_count = random.randint(2, 4)
        items = []
        for prod in random.sample(PRODUCTS, items_count):
            qty = random.randint(30, 80)
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
            "delivery_address": "Gudang Naufal, Cikarang, Bekasi",
            "status": "delivered",
            "escrow_status": "released",
            "created_at": iso(order_date),
        }
        try:
            supabase.table("orders").insert(order).execute()
            spending_orders += 1
        except Exception:
            pass

print(f"  [OK] {spending_orders} orders (spending, 5 months)")

print(f"\n{'=' * 60}")
print(f"DONE! Total: {revenue_orders + spending_orders} orders")
print(f"Revenue orders: {revenue_orders} (evenly distributed)")
print(f"Spending orders: {spending_orders} (evenly distributed)")
print(f"{'=' * 60}")
