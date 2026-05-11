"""
Seed credit line + payment data for Naufal DIstri (distributor) and Toko Rafi Jaya (retailer).
Run: cd backend && python seed_credit_payments.py
"""
import os, uuid
from datetime import datetime, timedelta
from dotenv import load_dotenv
load_dotenv()

from supabase import create_client

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

DIST_NAUFAL = "45cbdf58-c6ef-4a34-a3b5-3d6bdbedea2d"
RETAILER_RAFI = "05fab453-bdd4-4f2d-851a-0407dd830c9d"
RETAILER_BUMI = "9bbc6ffc-0d3e-47b7-84c3-2a2d1f30e183"
RETAILER_SEMBAKO = "502bd2dd-6471-406d-b652-80efd297bf5d"

now = datetime.utcnow()


def iso(dt):
    return dt.isoformat() + "Z"


print("=" * 60)
print("SEEDING CREDIT LINE + PAYMENTS")
print("=" * 60)

# ─── 1. Get partnership IDs ───
print("\n--- Finding partnerships ---")
p_res = supabase.table("partnerships").select("id,requester_id").eq("approver_id", DIST_NAUFAL).eq("type", "distributor_retailer").eq("status", "accepted").execute()
partnership_map = {p["requester_id"]: p["id"] for p in (p_res.data or [])}
print(f"  Found {len(partnership_map)} retailer partnerships")

# ─── 2. Credit Accounts ───
print("\n--- Creating credit accounts ---")

credit_accounts = [
    {
        "id": str(uuid.uuid4()),
        "retailer_id": RETAILER_RAFI,
        "distributor_id": DIST_NAUFAL,
        "partnership_id": partnership_map.get(RETAILER_RAFI),
        "credit_limit": 5000000,
        "utilized_amount": 1362000,  # from pending order
        "status": "active",
        "risk_level": "low",
        "credit_account_number": "CRD-0001",
        "billing_cycle_days": 14,
        "opened_at": iso(now - timedelta(days=30)),
        "next_due_date": iso(now + timedelta(days=7)),
        "next_due_amount": 1362000,
    },
    {
        "id": str(uuid.uuid4()),
        "retailer_id": RETAILER_SEMBAKO,
        "distributor_id": DIST_NAUFAL,
        "partnership_id": partnership_map.get(RETAILER_SEMBAKO),
        "credit_limit": 5000000,
        "utilized_amount": 544000,
        "status": "active",
        "risk_level": "medium",
        "credit_account_number": "CRD-0002",
        "billing_cycle_days": 14,
        "opened_at": iso(now - timedelta(days=20)),
        "next_due_date": iso(now + timedelta(days=3)),
        "next_due_amount": 544000,
    },
    {
        "id": str(uuid.uuid4()),
        "retailer_id": RETAILER_BUMI,
        "distributor_id": DIST_NAUFAL,
        "partnership_id": partnership_map.get(RETAILER_BUMI),
        "credit_limit": 10000000,
        "utilized_amount": 2800000,
        "status": "active",
        "risk_level": "low",
        "credit_account_number": "CRD-0003",
        "billing_cycle_days": 30,
        "opened_at": iso(now - timedelta(days=60)),
        "next_due_date": iso(now + timedelta(days=14)),
        "next_due_amount": 2800000,
    },
]

for acc in credit_accounts:
    try:
        supabase.table("credit_accounts").insert(acc).execute()
        print(f"  [OK] Credit for retailer {acc['retailer_id'][:8]}: limit Rp {acc['credit_limit']:,}, utilized Rp {acc['utilized_amount']:,}")
    except Exception as e:
        print(f"  [ERR] {e}")

# ─── 3. Payments / Invoices ───
print("\n--- Creating invoices ---")

# Get some delivered orders between Naufal and retailers
orders_res = supabase.table("orders").select("id,buyer_id,buyer_name,total_price,status,created_at").eq("seller_id", DIST_NAUFAL).eq("status", "delivered").execute()
delivered_orders = orders_res.data or []

invoices = []
for i, o in enumerate(delivered_orders[:8]):
    inv_id = str(uuid.uuid4())
    days_ago = 30 - (i * 4)
    due_date = now - timedelta(days=days_ago - 14)
    is_paid = i < 5  # first 5 paid, last 3 pending/overdue

    invoice = {
        "id": inv_id,
        "order_id": o.get("id"),
        "buyer_id": o.get("buyer_id"),
        "buyer_name": o.get("buyer_name", ""),
        "seller_id": DIST_NAUFAL,
        "seller_name": "Naufal DIstri",
        "amount": int(o.get("total_price", 0) or 0),
        "status": "paid" if is_paid else ("overdue" if due_date < now else "pending"),
        "due_date": iso(due_date),
        "created_at": o.get("created_at", iso(now - timedelta(days=days_ago))),
        "paid_at": iso(now - timedelta(days=days_ago - 7)) if is_paid else None,
    }
    invoices.append(invoice)

for inv in invoices:
    try:
        supabase.table("invoices").insert(inv).execute()
        print(f"  [OK] Invoice {inv['status']:8} | {inv['buyer_name'][:15]:15} | Rp {inv['amount']:>10,}")
    except Exception as e:
        print(f"  [ERR] {e}")

# ─── 4. Payments (for distributor paying supplier) ───
print("\n--- Creating payments (distributor → supplier) ---")

supplier_orders = supabase.table("orders").select("id,total_price,status,created_at").eq("buyer_id", DIST_NAUFAL).eq("status", "delivered").limit(5).execute()

payments = []
for i, o in enumerate((supplier_orders.data or [])[:5]):
    pay_id = str(uuid.uuid4())
    payments.append({
        "id": pay_id,
        "order_id": o.get("id"),
        "payer_id": DIST_NAUFAL,
        "payee_id": "eb19df91-cf38-4441-b462-40530ab95d02",  # Toko Geral
        "counterpart_name": "Toko Geral",
        "amount": int(o.get("total_price", 0) or 0),
        "type": "payable",
        "status": "paid" if i < 3 else "pending",
        "created_at": o.get("created_at", iso(now - timedelta(days=20))),
    })

# Payments from retailers to Naufal (receivable)
for inv in invoices[:5]:
    payments.append({
        "id": str(uuid.uuid4()),
        "order_id": inv["order_id"],
        "payer_id": inv["buyer_id"],
        "payee_id": DIST_NAUFAL,
        "counterpart_name": inv["buyer_name"],
        "amount": inv["amount"],
        "type": "receivable",
        "status": inv["status"],
        "created_at": inv["created_at"],
    })

for p in payments:
    try:
        supabase.table("payments").insert(p).execute()
        print(f"  [OK] {p['type']:10} | {p['counterpart_name'][:15]:15} | {p['status']:8} | Rp {p['amount']:>10,}")
    except Exception as e:
        print(f"  [ERR] {e}")

print(f"\n{'=' * 60}")
print(f"DONE! Created:")
print(f"  - {len(credit_accounts)} credit accounts")
print(f"  - {len(invoices)} invoices")
print(f"  - {len(payments)} payments")
print(f"{'=' * 60}")
