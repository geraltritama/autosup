import os
import csv
import io
import random
import uuid
from datetime import datetime, timedelta
from dotenv import load_dotenv
from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from supabase import create_client, Client
import google.generativeai as genai
from pydantic import BaseModel
from typing import Any, Optional

load_dotenv()

# ==========================================
# 1. PYDANTIC MODELS
# ==========================================

class RegisterReq(BaseModel):
    full_name: str
    email: str
    password: str
    role: str
    business_name: str
    phone: str

class LoginReq(BaseModel):
    email: str
    password: str
    recaptcha_token: Optional[str] = None

class RefreshReq(BaseModel):
    refresh_token: str

class NewInventoryItem(BaseModel):
    product_name: str
    current_stock: int

class UpdateStockReq(BaseModel):
    current_stock: int

class CreateOrderReq(BaseModel):
    seller_id: str
    seller_type: str
    items: list[dict]
    delivery_address: str
    notes: Optional[str] = None

class UpdateOrderStatusReq(BaseModel):
    status: str
    shipping_info: Optional[dict] = None

class SettlePaymentReq(BaseModel):
    payment_id: str

class AddRetailerReq(BaseModel):
    name: str
    contact_person: str
    phone: str
    city: str
    segment: str

class UpdateRetailerReq(BaseModel):
    phone: Optional[str] = None
    segment: Optional[str] = None
    status: Optional[str] = None

class PartnershipRequestReq(BaseModel):
    distributor_id: str

class UpdatePartnershipReq(BaseModel):
    action: str  # "accept" | "reject"

class OpenCreditReq(BaseModel):
    retailer_id: str
    credit_limit: float

class UpdateCreditReq(BaseModel):
    credit_limit: Optional[float] = None
    status: Optional[str] = None

class UpdateProfileReq(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None

class UpdateBusinessReq(BaseModel):
    business_name: Optional[str] = None
    tax_id: Optional[str] = None
    warehouse_locations: Optional[list[str]] = None
    service_regions: Optional[list[str]] = None

class UpdateNotificationReq(BaseModel):
    channels: Optional[dict] = None
    preferences: Optional[dict] = None

class UpdateAgentConfigReq(BaseModel):
    status: Optional[str] = None
    automation_level: Optional[str] = None

class Disable2FAReq(BaseModel):
    totp_code: str

class AIRestockReq(BaseModel):
    item_id: Optional[str] = None

class AIDemandReq(BaseModel):
    item_id: Optional[str] = None
    forecast_days: int = 7

class AICreditRiskReq(BaseModel):
    retailer_id: str

class AILogisticsReq(BaseModel):
    region: Optional[str] = None

class WebhookPayment(BaseModel):
    order_id: str
    transaction_status: str

class TeamMemberInvite(BaseModel):
    member_name: str
    role: str
    email: str

# ==========================================
# 2. SETUP
# ==========================================

app = FastAPI(title="AUTOSUP Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://autosup-production.up.railway.app",
        "https://autosup-backend-production.up.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def success_response(data: Any = None, message: str = "OK"):
    return {"success": True, "data": data, "message": message}


def error_response(message: str):
    return {"success": False, "data": None, "message": message}


def now_iso():
    return datetime.utcnow().isoformat() + "Z"


def past_iso(minutes=0, hours=0, days=0):
    return (datetime.utcnow() - timedelta(minutes=minutes, hours=hours, days=days)).isoformat() + "Z"


def future_iso(hours=0, days=0):
    return (datetime.utcnow() + timedelta(hours=hours, days=days)).isoformat() + "Z"


def safe_query(table: str, select="*", filters=None):
    """Query Supabase table, return empty list if table doesn't exist."""
    try:
        q = supabase.table(table).select(select)
        if filters:
            for col, val in filters.items():
                q = q.eq(col, val)
        return q.execute().data or []
    except Exception as e:
        if "PGRST205" in str(e) or "schema cache" in str(e):
            return []
        raise


# ==========================================
# 3. SUPABASE & GEMINI
# ==========================================

supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
gemini = genai.GenerativeModel("models/gemini-flash-latest")

# ==========================================
# 4. ROOT
# ==========================================

@app.get("/")
def home():
    return success_response(
        data={"status": "AUTOSUP Backend Aktif", "engine": "Gemini Flash"},
        message="Server is running",
    )

# ==========================================
# 5. AUTH
# ==========================================

@app.post("/auth/register")
def register_user(req: RegisterReq):
    try:
        res = supabase.auth.sign_up({
            "email": req.email,
            "password": req.password,
            "options": {
                "data": {
                    "full_name": req.full_name,
                    "role": req.role,
                    "business_name": req.business_name,
                    "phone": req.phone,
                }
            },
        })
        if not res.user:
            return error_response("Gagal mendaftarkan user.")
        return success_response(
            data={
                "user_id": res.user.id,
                "email": res.user.email,
                "role": req.role,
                "access_token": res.session.access_token if res.session else None,
            },
            message="Registrasi berhasil",
        )
    except Exception as e:
        return error_response(f"Gagal Register: {str(e)}")


@app.post("/auth/login")
def login_user(req: LoginReq):
    try:
        res = supabase.auth.sign_in_with_password({"email": req.email, "password": req.password})
        meta = res.user.user_metadata
        return success_response(
            data={
                "user_id": res.user.id,
                "full_name": meta.get("full_name", ""),
                "role": meta.get("role", "distributor"),
                "business_name": meta.get("business_name", ""),
                "access_token": res.session.access_token,
                "refresh_token": res.session.refresh_token,
            },
            message="Login berhasil",
        )
    except Exception:
        return error_response("Login gagal. Cek kembali email dan password Anda.")


@app.post("/auth/refresh")
def refresh_token(req: RefreshReq):
    try:
        res = supabase.auth.refresh_session(req.refresh_token)
        return success_response(
            data={"access_token": res.session.access_token, "refresh_token": res.session.refresh_token},
            message="Token berhasil diperbarui",
        )
    except Exception as e:
        return error_response(f"Gagal refresh token: {str(e)}")


@app.post("/auth/logout")
def logout_user():
    try:
        supabase.auth.sign_out()
        return success_response(message="Logout berhasil")
    except Exception as e:
        return error_response(f"Gagal logout: {str(e)}")

# ==========================================
# 6. INVENTORY
# ==========================================

@app.get("/inventory")
def get_inventory():
    try:
        res = supabase.table("inventories").select("*").execute()
        items = [
            {
                "id": i.get("id"),
                "name": i.get("product_name"),
                "stock": i.get("current_stock"),
                "min_stock": i.get("min_threshold", 0),
                "category": i.get("category", "umum"),
                "unit": i.get("unit", "pcs"),
            }
            for i in (res.data or [])
        ]
        return success_response(data=items, message="Berhasil mengambil data inventory")
    except Exception as e:
        return error_response(str(e))


@app.post("/inventory")
def add_inventory(data: NewInventoryItem):
    try:
        res = supabase.table("inventories").insert(data.dict()).execute()
        i = res.data[0]
        return success_response(
            data={"id": i.get("id"), "name": i.get("product_name"), "stock": i.get("current_stock"),
                  "min_stock": i.get("min_threshold", 0), "category": i.get("category", "umum"), "unit": i.get("unit", "pcs")},
            message="Barang baru berhasil ditambahkan",
        )
    except Exception as e:
        return error_response(str(e))


@app.patch("/inventory/{item_id}")
def update_inventory(item_id: str, data: UpdateStockReq):
    try:
        res = supabase.table("inventories").update({"current_stock": data.current_stock}).eq("id", item_id).execute()
        if not res.data:
            return error_response("Barang tidak ditemukan.")
        i = res.data[0]
        return success_response(
            data={"id": i.get("id"), "name": i.get("product_name"), "stock": i.get("current_stock"),
                  "min_stock": i.get("min_threshold", 0), "category": i.get("category", "umum"), "unit": i.get("unit", "pcs")},
            message="Stok berhasil diupdate",
        )
    except Exception as e:
        return error_response(str(e))


@app.delete("/inventory/{item_id}")
def delete_inventory(item_id: str):
    try:
        res = supabase.table("inventories").delete().eq("id", item_id).execute()
        if not res.data:
            return error_response("Barang tidak ditemukan.")
        return success_response(message="Barang berhasil dihapus")
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 7. ORDERS
# ==========================================

def _map_order(o: dict) -> dict:
    return {
        "order_id": o.get("id"),
        "order_number": o.get("order_number", f"ORD-{str(o.get('id', ''))[:6].upper()}"),
        "buyer": {
            "id": o.get("buyer_id", ""),
            "name": o.get("buyer_name", o.get("retailer_name", "")),
            "role": o.get("buyer_role", "retailer"),
        },
        "seller": {
            "id": o.get("seller_id", ""),
            "name": o.get("seller_name", o.get("supplier_name", "")),
            "role": o.get("seller_type", "distributor"),
        },
        "items": o.get("items") or [
            {
                "item_name": o.get("product_name", ""),
                "qty": o.get("quantity", 1),
                "unit": "pcs",
                "price_per_unit": o.get("total_price", 0) // max(o.get("quantity", 1), 1),
                "subtotal": o.get("total_price", 0),
            }
        ],
        "total_amount": o.get("total_price", o.get("total_amount", 0)),
        "status": o.get("status", "pending"),
        "escrow_status": o.get("escrow_status", "held"),
        "delivery_address": o.get("delivery_address", o.get("retailer_name", "")),
        "estimated_delivery": o.get("estimated_delivery", future_iso(days=3)),
        "shipping_info": o.get("shipping_info"),
        "notes": o.get("notes"),
        "created_at": o.get("created_at", now_iso()),
        "updated_at": o.get("updated_at", now_iso()),
        "status_history": o.get("status_history") or [
            {"status": "pending", "changed_at": o.get("created_at", now_iso())}
        ],
    }


@app.get("/orders")
def get_orders(status: Optional[str] = None, search: Optional[str] = None, page: int = 1, limit: int = 20):
    try:
        query = supabase.table("orders").select("*")
        if status:
            query = query.eq("status", status)
        res = query.execute()
        orders = [_map_order(o) for o in (res.data or [])]

        if search:
            sl = search.lower()
            orders = [o for o in orders if sl in o["order_number"].lower()
                      or sl in o["buyer"]["name"].lower() or sl in o["seller"]["name"].lower()]

        total = len(orders)
        start = (page - 1) * limit
        return success_response(
            data={
                "orders": orders[start: start + limit],
                "summary": {
                    "total_orders": total,
                    "pending_orders": sum(1 for o in orders if o["status"] == "pending"),
                    "active_orders": sum(1 for o in orders if o["status"] in ["processing", "shipping"]),
                    "completed_orders": sum(1 for o in orders if o["status"] == "delivered"),
                    "cancelled_orders": sum(1 for o in orders if o["status"] == "cancelled"),
                },
                "pagination": {"page": page, "limit": limit, "total": total},
            },
            message="Berhasil mengambil data orders",
        )
    except Exception as e:
        return error_response(str(e))


@app.get("/orders/{order_id}")
def get_order_detail(order_id: str):
    try:
        res = supabase.table("orders").select("*").eq("id", order_id).execute()
        if not res.data:
            return error_response("Pesanan tidak ditemukan.")
        return success_response(data=_map_order(res.data[0]), message="Detail pesanan ditemukan")
    except Exception as e:
        return error_response(str(e))


@app.post("/orders")
def create_order(data: CreateOrderReq):
    try:
        order_id = str(uuid.uuid4())
        order_number = f"ORD-{order_id[:8].upper()}"
        total_amount = sum(
            item.get("subtotal", item.get("qty", 1) * item.get("price_per_unit", 0))
            for item in data.items
        )
        payload = {
            "id": order_id,
            "order_number": order_number,
            "seller_id": data.seller_id,
            "seller_type": data.seller_type,
            "items": data.items,
            "total_price": total_amount,
            "delivery_address": data.delivery_address,
            "notes": data.notes,
            "status": "pending",
            "escrow_status": "held",
            "created_at": now_iso(),
        }
        res = supabase.table("orders").insert(payload).execute()
        o = res.data[0] if res.data else payload
        return success_response(
            data={
                "order_id": o.get("id", order_id),
                "order_number": o.get("order_number", order_number),
                "total_amount": total_amount,
                "status": "pending",
                "escrow_status": "held",
                "created_at": o.get("created_at", now_iso()),
            },
            message="Pesanan berhasil dibuat",
        )
    except Exception as e:
        return error_response(str(e))


@app.put("/orders/{order_id}/status")
def update_order_status(order_id: str, data: UpdateOrderStatusReq):
    try:
        update_payload: dict = {"status": data.status, "updated_at": now_iso()}
        if data.shipping_info:
            update_payload["shipping_info"] = data.shipping_info
        if data.status == "delivered":
            update_payload["escrow_status"] = "released"
        res = supabase.table("orders").update(update_payload).eq("id", order_id).execute()
        if not res.data:
            return error_response("Pesanan tidak ditemukan.")
        return success_response(
            data={"order_id": order_id, "status": data.status, "updated_at": now_iso()},
            message="Status pesanan berhasil diupdate",
        )
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 8. DASHBOARD SUMMARY (role-based)
# ==========================================

@app.get("/dashboard/summary")
def get_dashboard_summary(x_user_role: Optional[str] = Header(default=None)):
    try:
        orders_res = supabase.table("orders").select("status").execute()
        inv_res = supabase.table("inventories").select("current_stock, min_threshold").execute()

        orders = orders_res.data or []
        inventory = inv_res.data or []
        pending = sum(1 for o in orders if o.get("status") == "pending")
        processing = sum(1 for o in orders if o.get("status") in ["processing", "shipping"])
        completed = sum(1 for o in orders if o.get("status") == "delivered")
        total_inv = len(inventory)
        low_stock = sum(1 for i in inventory if 0 < i.get("current_stock", 0) < i.get("min_threshold", 0))
        out_of_stock = sum(1 for i in inventory if i.get("current_stock", 0) == 0)

        role = x_user_role or "distributor"
        ai_alerts = [
            {"type": "restock_alert", "message": "Beberapa produk mendekati batas minimum stok.", "urgency": "high", "item_id": ""},
            {"type": "cash_flow_recommendation", "message": "Jadwalkan ulang pembayaran untuk optimalkan cash flow.", "urgency": "medium", "item_id": ""},
        ]

        if role == "supplier":
            data = {
                "role": "supplier",
                "products": {"total_active": total_inv, "low_stock_count": low_stock, "out_of_stock_count": out_of_stock},
                "orders": {"incoming_orders": pending, "processing": processing, "completed_this_month": completed},
                "partners": {"distributor_count": 5, "pending_requests": 1},
                "ai_insights": ai_alerts,
            }
        elif role == "retailer":
            data = {
                "role": "retailer",
                "inventory": {"total_items": total_inv, "low_stock_count": low_stock, "out_of_stock_count": out_of_stock},
                "orders": {"active_orders": processing, "pending_approval": pending, "in_transit": processing,
                           "completed_this_month": completed, "order_accuracy_rate": 97},
                "spending": {"total_outstanding": 4800000, "monthly_spending": 12500000, "available_credit": 5000000,
                             "upcoming_due_payments": 1, "payment_success_rate": 98},
                "distributors": {"active_partnered": 4, "pending_requests": 1, "average_reliability_score": 91, "avg_delivery_time": 2},
                "forecast_accuracy_pct": 84,
                "ai_insights": ai_alerts,
            }
        else:  # distributor
            data = {
                "role": "distributor",
                "inventory": {"total_items": total_inv, "low_stock_count": low_stock, "out_of_stock_count": out_of_stock},
                "orders": {"active_orders": processing, "pending_orders": pending, "completed_this_month": completed},
                "suppliers": {"partner_count": 8, "pending_requests": 2},
                "retailers": {"partner_count": 24, "pending_requests": 3},
                "ai_insights": ai_alerts,
            }

        return success_response(data=data, message="Data dashboard berhasil ditarik")
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 9. PAYMENTS
# ==========================================

@app.get("/payments/retailer")
def get_retailer_payments():
    try:
        raw = safe_query("invoices")
        invoices = [
            {
                "invoice_id": i.get("id"),
                "order_id": i.get("order_id"),
                "seller_name": i.get("seller_name", ""),
                "amount": i.get("amount", 0),
                "status": i.get("status", "pending"),
                "due_date": i.get("due_date", future_iso(days=7)),
                "created_at": i.get("created_at", now_iso()),
            }
            for i in (res.data or [])
        ]
        total_outstanding = sum(i["amount"] for i in invoices if i["status"] in ["pending", "overdue"])
        return success_response(
            data={
                "summary": {"total_outstanding": total_outstanding, "total_invoices": len(invoices),
                            "overdue_count": sum(1 for i in invoices if i["status"] == "overdue"),
                            "paid_this_month": sum(i["amount"] for i in invoices if i["status"] == "paid")},
                "invoices": invoices,
                "insights": [],
            },
            message="Data pembayaran retailer berhasil ditarik",
        )
    except Exception as e:
        return error_response(str(e))


@app.get("/payments/distributor")
def get_distributor_payments():
    try:
        res = supabase.table("payments").select("*").execute()
        payments = [
            {
                "payment_id": p.get("id"),
                "counterpart_name": p.get("counterpart_name", ""),
                "amount": p.get("amount", 0),
                "type": p.get("type", "payable"),
                "status": p.get("status", "pending"),
                "order_id": p.get("order_id"),
                "created_at": p.get("created_at", now_iso()),
            }
            for p in (res.data or [])
        ]
        return success_response(
            data={
                "summary": {"total_payable": sum(p["amount"] for p in payments if p["type"] == "payable"),
                            "total_receivable": sum(p["amount"] for p in payments if p["type"] == "receivable"),
                            "pending_count": sum(1 for p in payments if p["status"] == "pending")},
                "payments": payments,
            },
            message="Data pembayaran distributor berhasil ditarik",
        )
    except Exception as e:
        return error_response(str(e))


@app.post("/payments/settle")
def settle_payment(data: SettlePaymentReq):
    try:
        supabase.table("payments").update({"status": "settled"}).eq("id", data.payment_id).execute()
        return success_response(data={"success": True}, message="Pembayaran berhasil diselesaikan")
    except Exception as e:
        return error_response(str(e))


@app.post("/invoices/{invoice_id}/pay")
def pay_invoice(invoice_id: str):
    try:
        supabase.table("invoices").update({"status": "paid", "paid_at": now_iso()}).eq("id", invoice_id).execute()
        return success_response(data={"success": True}, message="Invoice berhasil dibayar")
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 10. RETAILERS
# ==========================================

@app.get("/retailers")
def get_retailers(search: Optional[str] = None, segment: Optional[str] = None,
                  status: Optional[str] = None, page: int = 1, limit: int = 20):
    try:
        query = supabase.table("retailers").select("*")
        if status:
            query = query.eq("status", status)
        res = query.execute()
        retailers = [
            {
                "retailer_id": r.get("id"),
                "name": r.get("name", ""),
                "contact_person": r.get("contact_person", ""),
                "phone": r.get("phone", ""),
                "city": r.get("city", ""),
                "segment": r.get("segment", "reguler"),
                "status": r.get("status", "active"),
                "monthly_order_volume": r.get("monthly_order_volume", 0),
                "total_purchase_amount": r.get("total_purchase_amount", 0),
                "last_order_at": r.get("last_order_at", past_iso(days=3)),
            }
            for r in (res.data or [])
        ]
        if search:
            sl = search.lower()
            retailers = [r for r in retailers if sl in r["name"].lower() or sl in r["city"].lower()]
        if segment:
            retailers = [r for r in retailers if r["segment"] == segment]
        total = len(retailers)
        start = (page - 1) * limit
        return success_response(
            data={
                "retailers": retailers[start: start + limit],
                "summary": {"total": total, "active": sum(1 for r in retailers if r["status"] == "active"),
                            "premium_count": sum(1 for r in retailers if r["segment"] == "premium")},
                "pagination": {"page": page, "limit": limit, "total": total},
            },
            message="Data retailer berhasil ditarik",
        )
    except Exception as e:
        return error_response(str(e))


@app.get("/retailers/{retailer_id}")
def get_retailer_detail(retailer_id: str):
    try:
        res = supabase.table("retailers").select("*").eq("id", retailer_id).execute()
        if not res.data:
            return error_response("Retailer tidak ditemukan.")
        r = res.data[0]
        return success_response(
            data={
                "retailer_id": r.get("id"), "name": r.get("name", ""), "contact_person": r.get("contact_person", ""),
                "phone": r.get("phone", ""), "email": r.get("email", ""), "city": r.get("city", ""),
                "address": r.get("address", ""), "segment": r.get("segment", "reguler"), "status": r.get("status", "active"),
                "monthly_order_volume": r.get("monthly_order_volume", 0),
                "total_purchase_amount": r.get("total_purchase_amount", 0),
                "last_order_at": r.get("last_order_at", past_iso(days=3)),
                "purchase_history": [], "demand_intelligence": {"top_products": [], "peak_order_day": "Senin"}, "credit_summary": None,
            },
            message="Detail retailer ditemukan",
        )
    except Exception as e:
        return error_response(str(e))


@app.post("/retailers")
def add_retailer(data: AddRetailerReq):
    try:
        payload = {**data.dict(), "status": "active", "monthly_order_volume": 0, "total_purchase_amount": 0}
        res = supabase.table("retailers").insert(payload).execute()
        r = res.data[0] if res.data else payload
        return success_response(
            data={"retailer_id": r.get("id"), "name": r.get("name"), "contact_person": r.get("contact_person"),
                  "phone": r.get("phone"), "city": r.get("city"), "segment": r.get("segment"),
                  "status": "active", "monthly_order_volume": 0, "total_purchase_amount": 0, "last_order_at": now_iso()},
            message="Retailer berhasil ditambahkan",
        )
    except Exception as e:
        return error_response(str(e))


@app.put("/retailers/{retailer_id}")
def update_retailer(retailer_id: str, data: UpdateRetailerReq):
    try:
        update_payload = {k: v for k, v in data.dict().items() if v is not None}
        res = supabase.table("retailers").update(update_payload).eq("id", retailer_id).execute()
        if not res.data:
            return error_response("Retailer tidak ditemukan.")
        r = res.data[0]
        return success_response(
            data={"retailer_id": r.get("id"), "name": r.get("name"), "contact_person": r.get("contact_person"),
                  "phone": r.get("phone"), "city": r.get("city"), "segment": r.get("segment"),
                  "status": r.get("status"), "monthly_order_volume": r.get("monthly_order_volume", 0),
                  "total_purchase_amount": r.get("total_purchase_amount", 0), "last_order_at": r.get("last_order_at", now_iso())},
            message="Retailer berhasil diupdate",
        )
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 11. DISTRIBUTORS
# ==========================================

@app.get("/distributors")
def get_distributors(search: Optional[str] = None, status: Optional[str] = None, page: int = 1, limit: int = 20):
    try:
        res = supabase.table("distributors").select("*").execute()
        distributors = [
            {
                "distributor_id": d.get("id"),
                "name": d.get("name", ""),
                "city": d.get("city", ""),
                "reliability_score": d.get("reliability_score", 80),
                "active_products": d.get("active_products", 0),
                "partnership_status": d.get("partnership_status", "active"),
                "avg_delivery_time": d.get("avg_delivery_time", 3),
            }
            for d in (res.data or [])
        ]
        if search:
            distributors = [d for d in distributors if search.lower() in d["name"].lower()]
        if status:
            distributors = [d for d in distributors if d["partnership_status"] == status]
        total = len(distributors)
        start = (page - 1) * limit
        avg_rel = sum(d["reliability_score"] for d in distributors) // max(total, 1)
        return success_response(
            data={
                "distributors": distributors[start: start + limit],
                "summary": {"total": total, "active": sum(1 for d in distributors if d["partnership_status"] == "active"), "avg_reliability": avg_rel},
                "pagination": {"page": page, "limit": limit, "total": total},
            },
            message="Data distributor berhasil ditarik",
        )
    except Exception as e:
        return error_response(str(e))


@app.get("/distributors/partnership-requests")
def get_distributor_requests(page: int = 1, limit: int = 20):
    try:
        res = supabase.table("partnerships").select("*").eq("status", "pending").execute()
        requests = [
            {
                "request_id": p.get("id"), "distributor_id": p.get("distributor_id", ""),
                "distributor_name": p.get("distributor_name", p.get("supplier_name", "")),
                "city": p.get("city", ""), "reliability_score": p.get("reliability_score", 80),
                "status": p.get("status", "pending"), "created_at": p.get("created_at", now_iso()),
            }
            for p in (res.data or [])
        ]
        total = len(requests)
        return success_response(
            data={"requests": requests[(page-1)*limit: page*limit], "pagination": {"page": page, "limit": limit, "total": total}},
            message="Data permintaan kemitraan berhasil ditarik",
        )
    except Exception as e:
        return error_response(str(e))


@app.get("/distributors/{distributor_id}/stock")
def get_distributor_stock(distributor_id: str, page: int = 1, limit: int = 20):
    try:
        res = supabase.table("inventories").select("*").eq("owner_id", distributor_id).execute()
        products = [
            {
                "item_id": i.get("id"), "name": i.get("product_name", ""), "category": i.get("category", "umum"),
                "stock": i.get("current_stock", 0), "min_stock": i.get("min_threshold", 0), "unit": i.get("unit", "pcs"),
                "status": "in_stock" if i.get("current_stock", 0) > i.get("min_threshold", 0) else (
                    "low_stock" if i.get("current_stock", 0) > 0 else "out_of_stock"),
                "last_updated": i.get("updated_at", now_iso()),
            }
            for i in (res.data or [])
        ]
        total = len(products)
        return success_response(
            data={"distributor": {"distributor_id": distributor_id, "name": ""},
                  "products": products[(page-1)*limit: page*limit], "pagination": {"page": page, "limit": limit, "total": total}},
            message="Stok distributor berhasil ditarik",
        )
    except Exception as e:
        return error_response(str(e))


@app.post("/distributors/partnership-request")
def request_partnership(data: PartnershipRequestReq):
    try:
        request_id = str(uuid.uuid4())
        supabase.table("partnerships").insert({"id": request_id, "distributor_id": data.distributor_id, "status": "pending", "created_at": now_iso()}).execute()
        return success_response(
            data={"request_id": request_id, "distributor_id": data.distributor_id, "distributor_name": "", "status": "pending", "created_at": now_iso()},
            message="Permintaan kemitraan berhasil dikirim",
        )
    except Exception as e:
        return error_response(str(e))


@app.put("/distributors/partnership-request/{request_id}")
def update_partnership_request(request_id: str, data: UpdatePartnershipReq):
    try:
        new_status = "approved" if data.action == "accept" else "rejected"
        supabase.table("partnerships").update({"status": new_status}).eq("id", request_id).execute()
        return success_response(data={"request_id": request_id, "action": data.action}, message=f"Partnership {data.action}ed")
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 12. PARTNERSHIPS
# ==========================================

@app.get("/partnerships/summary")
def get_partnerships_summary():
    try:
        res = supabase.table("partnerships").select("status").execute()
        ps = res.data or []
        active = sum(1 for p in ps if p.get("status") == "approved")
        pending = sum(1 for p in ps if p.get("status") == "pending")
        return success_response(
            data={
                "summary": {"active_partnerships": active, "pending_requests": pending, "trust_score_avg": 87, "nft_issued": active},
                "insights": [{"type": "new_partner", "message": f"{pending} permintaan kemitraan menunggu persetujuan.", "urgency": "medium"}],
            },
            message="Data partnership berhasil ditarik",
        )
    except Exception as e:
        return error_response(str(e))


def _get_nft(table_filter: dict):
    try:
        query = supabase.table("partnership_nfts").select("*")
        for col, val in table_filter.items():
            query = query.eq(col, val)
        res = query.execute()
        if not res.data:
            return success_response(data=None, message="NFT tidak ditemukan")
        return success_response(data=res.data[0], message="NFT ditemukan")
    except Exception as e:
        return error_response(str(e))


@app.get("/blockchain/partnership-nft/{user_id}/{supplier_id}")
def get_supplier_nft(user_id: str, supplier_id: str):
    return _get_nft({"distributor_id": user_id, "supplier_id": supplier_id})


@app.get("/blockchain/partnership-nft/retailer/{user_id}/{distributor_id}")
def get_retailer_nft(user_id: str, distributor_id: str):
    return _get_nft({"retailer_id": user_id, "distributor_id": distributor_id})


@app.get("/blockchain/partnership-nft/distributor/{user_id}/{retailer_id}")
def get_distributor_nft(user_id: str, retailer_id: str):
    return _get_nft({"distributor_id": user_id, "retailer_id": retailer_id})

# ==========================================
# 13. ANALYTICS
# ==========================================

def _base_analytics(orders: list, inventory: list):
    completed = [o for o in orders if o.get("status") == "delivered"]
    total_revenue = sum(o.get("total_price", 0) for o in completed)
    n = max(len(orders), 1)
    return {
        "summary": {"total_revenue": total_revenue, "total_orders": len(orders), "completed_orders": len(completed), "growth_pct": 12.5},
        "trends": [
            {"period": f"Minggu {i}", "revenue": total_revenue * (0.22 + i * 0.02), "orders": len(orders) // 4}
            for i in range(1, 5)
        ],
        "top_products": [
            {"name": i.get("product_name", ""), "revenue": i.get("current_stock", 0) * 10000, "units_sold": i.get("current_stock", 0)}
            for i in inventory[:5]
        ],
    }


@app.get("/analytics/retailer/overview")
def analytics_retailer():
    try:
        o = supabase.table("orders").select("*").execute().data or []
        i = supabase.table("inventories").select("*").execute().data or []
        return success_response(data=_base_analytics(o, i), message="Analytics retailer")
    except Exception as e:
        return error_response(str(e))


@app.get("/analytics/distributor/overview")
def analytics_distributor():
    try:
        o = supabase.table("orders").select("*").execute().data or []
        i = supabase.table("inventories").select("*").execute().data or []
        return success_response(data=_base_analytics(o, i), message="Analytics distributor")
    except Exception as e:
        return error_response(str(e))


@app.get("/analytics/supplier/overview")
def analytics_supplier():
    try:
        o = supabase.table("orders").select("*").execute().data or []
        i = supabase.table("inventories").select("*").execute().data or []
        base = _base_analytics(o, i)
        base["distributor_performance"] = [
            {"distributor_id": "d1", "distributor_name": "PT Nusantara Distribusi", "orders": 12, "revenue": 8500000, "reliability": 94},
            {"distributor_id": "d2", "distributor_name": "CV Maju Bersama", "orders": 8, "revenue": 5200000, "reliability": 88},
        ]
        return success_response(data=base, message="Analytics supplier")
    except Exception as e:
        return error_response(str(e))


@app.get("/analytics/distributor/regional")
def analytics_distributor_regional(item_id: Optional[str] = None):
    return success_response(
        data={"regional_demand": [
            {"region": r, "demand_score": s, "growth_pct": g}
            for r, s, g in [("Jakarta", 92, 15), ("Bandung", 78, 8), ("Surabaya", 85, 12), ("Medan", 65, 5), ("Makassar", 58, 18)]
        ]},
        message="Data regional distributor",
    )


@app.get("/analytics/supplier/regional")
def analytics_supplier_regional(item_id: Optional[str] = None):
    return success_response(
        data={"regions": [
            {"region": r, "demand_score": s, "growth_pct": g}
            for r, s, g in [("Jakarta", 92, 15), ("Bandung", 78, 8), ("Surabaya", 85, 12),
                            ("Yogyakarta", 71, 10), ("Semarang", 68, 7), ("Medan", 65, 5), ("Makassar", 58, 18)]
        ]},
        message="Data regional supplier",
    )


@app.get("/analytics/products/insights")
def analytics_product_insights():
    try:
        items = supabase.table("inventories").select("*").execute().data or []
        return success_response(
            data={
                "top_selling": [{"name": i.get("product_name", ""), "units": i.get("current_stock", 0), "growth_pct": random.randint(5, 25)} for i in items[:3]],
                "declining": [{"name": i.get("product_name", ""), "units": i.get("current_stock", 0), "decline_pct": random.randint(5, 20)} for i in items[3:5]],
                "stock_risk": [{"name": i.get("product_name", ""), "stock": i.get("current_stock", 0), "min_stock": i.get("min_threshold", 0)}
                               for i in items if i.get("current_stock", 0) < i.get("min_threshold", 0)],
            },
            message="Product insights",
        )
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 14. DEMAND
# ==========================================

@app.get("/analytics/supplier/demand")
def get_demand(period: str = "7d"):
    try:
        items = supabase.table("inventories").select("product_name, current_stock").execute().data or []
        top = [{"id": f"d{i}", "name": it.get("product_name", ""), "current_demand": random.randint(50, 200),
                "growth_pct": round(random.uniform(5, 30), 1), "trend": "rising", "category": "umum"} for i, it in enumerate(items[:3])]
        declining = [{"id": f"d{i+3}", "name": it.get("product_name", ""), "current_demand": random.randint(10, 50),
                      "growth_pct": -round(random.uniform(5, 20), 1), "trend": "declining"} for i, it in enumerate(items[3:5])]
        return success_response(
            data={
                "insights": [{"type": "demand_spike", "message": "Permintaan meningkat signifikan minggu ini.", "urgency": "medium"}],
                "top_rising": top, "declining": declining,
                "trends": [{"period": f"D-{i}", "demand": random.randint(80, 150)} for i in range(7, 0, -1)],
                "top_selling": top, "product_performance_by_distributor": [],
            },
            message="Data demand berhasil ditarik",
        )
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 15. LOGISTICS
# ==========================================

@app.get("/logistics/shipments")
def get_shipments():
    try:
        res = supabase.table("shipments").select("*").execute()
        shipments = [
            {"id": s.get("id"), "order_id": s.get("order_id"), "retailer_name": s.get("retailer_name", ""),
             "destination": s.get("destination", ""), "status": s.get("status", "in_transit"),
             "eta": s.get("eta", future_iso(hours=4)), "carrier": s.get("carrier", "JNE")}
            for s in (res.data or [])
        ]
        return success_response(
            data={
                "active_shipments": sum(1 for s in shipments if s["status"] in ["packed", "dispatched", "in_transit"]),
                "delayed_shipments": sum(1 for s in shipments if s["status"] == "delayed"),
                "delivered_today": sum(1 for s in shipments if s["status"] == "delivered"),
                "shipments": shipments, "partners": [],
            },
            message="Data shipment berhasil ditarik",
        )
    except Exception as e:
        return error_response(str(e))


@app.put("/logistics/shipments/{shipment_id}/route")
def optimize_route(shipment_id: str):
    try:
        new_eta = future_iso(hours=2)
        supabase.table("shipments").update({"status": "in_transit", "eta": new_eta}).eq("id", shipment_id).execute()
        return success_response(data={"shipment_id": shipment_id, "new_eta": new_eta, "optimized": True}, message="Rute berhasil dioptimasi")
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 16. CREDIT
# ==========================================

@app.get("/credit/accounts")
def get_credit_accounts(page: int = 1, limit: int = 20):
    try:
        res = supabase.table("credit_accounts").select("*").execute()
        accounts = [
            {
                "credit_account_id": a.get("id"),
                "retailer": {"retailer_id": a.get("retailer_id"), "name": a.get("retailer_name", "")},
                "credit_limit": a.get("credit_limit", 0), "utilized_amount": a.get("utilized_amount", 0),
                "available_amount": a.get("credit_limit", 0) - a.get("utilized_amount", 0),
                "utilization_pct": round(a.get("utilized_amount", 0) / max(a.get("credit_limit", 1), 1) * 100, 1),
                "status": a.get("status", "active"), "risk_level": a.get("risk_level", "medium"),
                "next_due_date": a.get("next_due_date", future_iso(days=7)),
                "next_due_amount": a.get("next_due_amount", 0), "opened_at": a.get("opened_at", past_iso(days=30)),
            }
            for a in (res.data or [])
        ]
        total = len(accounts)
        total_limit = sum(a["credit_limit"] for a in accounts)
        total_utilized = sum(a["utilized_amount"] for a in accounts)
        return success_response(
            data={
                "accounts": accounts[(page-1)*limit: page*limit],
                "summary": {"total_credit_issued": total_limit, "total_utilized": total_utilized,
                            "total_available": total_limit - total_utilized,
                            "overdue_count": sum(1 for a in accounts if a["status"] == "overdue"),
                            "avg_utilization_pct": round(total_utilized / max(total_limit, 1) * 100, 1)},
                "pagination": {"page": page, "limit": limit, "total": total},
            },
            message="Data credit berhasil ditarik",
        )
    except Exception as e:
        return error_response(str(e))


@app.get("/credit/accounts/{account_id}/repayments")
def get_repayments(account_id: str):
    try:
        res = supabase.table("repayments").select("*").eq("credit_account_id", account_id).execute()
        repayments = [
            {"repayment_id": r.get("id"), "amount": r.get("amount", 0), "paid_at": r.get("paid_at", now_iso()),
             "status": r.get("status", "paid"), "payment_method": r.get("payment_method", "transfer"), "invoice_id": r.get("invoice_id")}
            for r in (res.data or [])
        ]
        return success_response(data={"repayments": repayments}, message="Data repayment berhasil ditarik")
    except Exception as e:
        return error_response(str(e))


@app.post("/credit/accounts")
def open_credit(data: OpenCreditReq):
    try:
        account_id = str(uuid.uuid4())
        payload = {"id": account_id, "retailer_id": data.retailer_id, "credit_limit": data.credit_limit,
                   "utilized_amount": 0, "status": "active", "risk_level": "medium", "opened_at": now_iso()}
        supabase.table("credit_accounts").insert(payload).execute()
        return success_response(
            data={**payload, "credit_account_id": account_id, "retailer": {"retailer_id": data.retailer_id, "name": ""},
                  "available_amount": data.credit_limit, "utilization_pct": 0},
            message="Akun kredit berhasil dibuka",
        )
    except Exception as e:
        return error_response(str(e))


@app.put("/credit/accounts/{account_id}")
def update_credit(account_id: str, data: UpdateCreditReq):
    try:
        update_payload = {k: v for k, v in data.dict().items() if v is not None}
        res = supabase.table("credit_accounts").update(update_payload).eq("id", account_id).execute()
        if not res.data:
            return error_response("Akun kredit tidak ditemukan.")
        a = res.data[0]
        return success_response(
            data={"credit_account_id": a.get("id"), "credit_limit": a.get("credit_limit"),
                  "utilized_amount": a.get("utilized_amount", 0), "status": a.get("status"), "risk_level": a.get("risk_level")},
            message="Akun kredit berhasil diupdate",
        )
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 17. AI AGENTS
# ==========================================

@app.get("/ai/agents")
def get_ai_agents():
    return success_response(
        data={
            "agents": [
                {"id": "agent-1", "agent_key": "auto_restock", "name": "Auto Restock", "status": "active",
                 "automation_level": "manual_approval", "description": "Memantau inventory dan memberikan peringatan restock.",
                 "recent_action": "Menyarankan restock Tepung Terigu 50kg.", "last_active": past_iso(minutes=5)},
                {"id": "agent-2", "agent_key": "demand_forecast", "name": "Demand Forecast", "status": "active",
                 "automation_level": "manual_approval", "description": "Memprediksi permintaan masa depan.",
                 "recent_action": "Meningkatkan forecast Kopi Arabika 15%.", "last_active": past_iso(minutes=30)},
                {"id": "agent-3", "agent_key": "supplier_recommendation", "name": "Supplier Recommendation", "status": "paused",
                 "automation_level": "manual_approval", "description": "Mencari partner alternatif.",
                 "recent_action": "Menganalisis 5 partner baru.", "last_active": past_iso(hours=2)},
                {"id": "agent-4", "agent_key": "price_optimization", "name": "Price Optimization", "status": "disabled",
                 "automation_level": "manual_approval", "description": "Menyarankan penyesuaian harga jual.",
                 "recent_action": "-", "last_active": past_iso(days=1)},
                {"id": "agent-5", "agent_key": "cash_flow_optimizer", "name": "Cash Flow Optimizer", "status": "active",
                 "automation_level": "auto_with_threshold", "description": "Mengoptimalkan jadwal pembayaran.",
                 "recent_action": "Menjadwalkan ulang pembayaran ke CV Maju Bersama.", "last_active": past_iso(minutes=15)},
            ],
            "activities": [
                {"id": "act-1", "agent_name": "Cash Flow Optimizer", "action": "Menyarankan penundaan pembayaran inv-002.",
                 "impact": "Menjaga positive cash flow Rp3.200.000", "timestamp": past_iso(minutes=15)},
                {"id": "act-2", "agent_name": "Auto Restock", "action": "Mendeteksi Gula Pasir menyentuh minimum stok.",
                 "impact": "Mencegah kehabisan stok", "timestamp": past_iso(hours=2)},
            ],
            "performance": {"accuracy_rate": 89, "cost_savings": 1450000, "time_saved_hours": 18},
        },
        message="Data AI agents berhasil ditarik",
    )


@app.put("/ai/agents/{agent_id}/config")
def update_agent_config(agent_id: str, data: UpdateAgentConfigReq):
    return success_response(data={"success": True}, message="Config agent berhasil diupdate")

# ==========================================
# 18. AI (existing + new credit risk)
# ==========================================

@app.post("/ai/restock-recommendation")
def ai_restock(req: AIRestockReq):
    try:
        res = supabase.table("inventories").select("*").execute()
        prompt = f"Sebagai AI Supply Chain. Cek data stok: {res.data}. Buat rekomendasi restock kritis. Fokus ID: {req.item_id or 'Semua'}."
        return success_response(data={"rekomendasi_ai": gemini.generate_content(prompt).text}, message="Rekomendasi restock selesai")
    except Exception as e:
        return error_response(str(e))


@app.post("/ai/demand-forecast")
def ai_demand(req: AIDemandReq):
    try:
        res = supabase.table("inventories").select("product_name, current_stock").execute()
        prompt = f"Buat prediksi permintaan {req.forecast_days} hari ke depan untuk data: {res.data}."
        return success_response(data={"prediksi_ai": gemini.generate_content(prompt).text}, message="Demand forecasting selesai")
    except Exception as e:
        return error_response(str(e))


@app.post("/ai/credit-risk")
def ai_credit_risk(req: AICreditRiskReq):
    try:
        res = supabase.table("orders").select("*").eq("buyer_id", req.retailer_id).execute()
        prompt = f"Analisis kredit untuk retailer {req.retailer_id}. Data transaksi: {res.data}. Beri risk score dan rekomendasi limit kredit."
        ai_text = gemini.generate_content(prompt).text
        return success_response(
            data={"retailer_id": req.retailer_id, "retailer_name": "", "risk_score": 75, "risk_level": "medium",
                  "recommendation": ai_text, "max_credit_suggestion": 5000000, "generated_at": now_iso()},
            message="Credit risk scoring selesai",
        )
    except Exception as e:
        return error_response(str(e))


@app.post("/ai/logistics-optimization")
def ai_logistics(req: AILogisticsReq):
    try:
        res = supabase.table("shipments").select("*").execute()
        prompt = f"Kamu Manajer Logistik. Analisis data {res.data}. Target regional: {req.region or 'Semua'}. Beri rekomendasi pemindahan barang."
        return success_response(data={"rekomendasi_ai": gemini.generate_content(prompt).text}, message="Optimasi logistik selesai")
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 19. SETTINGS
# ==========================================

@app.get("/settings/profile")
def get_profile():
    return success_response(data={"user_id": "", "full_name": "", "email": "", "phone": "", "role": "", "avatar_url": None}, message="Profile ditarik")


@app.put("/settings/profile")
def update_profile(data: UpdateProfileReq):
    return success_response(data={k: v for k, v in data.dict().items() if v is not None}, message="Profile berhasil diupdate")


@app.get("/settings/business")
def get_business():
    return success_response(data={"business_name": "", "tax_id": "", "warehouse_locations": [], "service_regions": []}, message="Business settings ditarik")


@app.put("/settings/business")
def update_business(data: UpdateBusinessReq):
    return success_response(data={k: v for k, v in data.dict().items() if v is not None}, message="Business settings diupdate")


@app.get("/settings/notifications")
def get_notification_settings():
    return success_response(
        data={"channels": {"email": True, "whatsapp": False, "push": True},
              "preferences": {"order_updates": True, "payment_alerts": True, "restock_alerts": True, "partnership_requests": True}},
        message="Notification settings ditarik",
    )


@app.put("/settings/notifications")
def update_notifications(data: UpdateNotificationReq):
    return success_response(data={**(data.channels or {}), **(data.preferences or {})}, message="Notification settings diupdate")


@app.get("/settings/integrations")
def get_integrations():
    return success_response(
        data={"erp": {"connected": False, "provider": None}, "payment_gateway": {"connected": False, "provider": None},
              "wallet": {"connected": False, "address": None}, "logistics": {"connected": False, "provider": None}, "api_keys": []},
        message="Integration settings ditarik",
    )


@app.get("/settings/security/sessions")
def get_sessions():
    return success_response(
        data={"sessions": [{"session_id": str(uuid.uuid4()), "device": "Chrome / Windows", "ip": "127.0.0.1",
                            "city": "Jakarta", "is_current": True, "last_active_at": now_iso()}]},
        message="Sessions ditarik",
    )


@app.post("/settings/security/2fa/enable")
def enable_2fa():
    return success_response(data={"secret": "JBSWY3DPEHPK3PXP", "qr_code_url": ""}, message="2FA siap diaktifkan")


@app.post("/settings/security/2fa/disable")
def disable_2fa(data: Disable2FAReq):
    return success_response(message="2FA berhasil dinonaktifkan")

# ==========================================
# 20. SUPPLIERS
# ==========================================

@app.get("/suppliers")
def get_suppliers(search: str = "", type: str = "", page: int = 1, limit: int = 20):
    """Returns supplier list with optional search/type filter."""
    try:
        # Fetch users with role=supplier from Supabase auth users
        res = supabase.table("users").select("*").eq("role", "supplier")
        if search:
            res = res.or_(f"full_name.ilike.%{search}%,business_name.ilike.%{search}%")
        res = res.execute()
        users = res.data or []

        # Also check Supabase auth users via admin API
        # For now, fallback to hardcoded list if table not ready
        if not users:
            # Query profiles/users table for suppliers
            try:
                profiles = supabase.table("profiles").select("*").eq("role", "supplier").execute().data or []
            except:
                profiles = []

        all_users = users or profiles or []
        partners = [u for u in all_users if u.get("partner_status") == "partner" or u.get("type") == "partner"]
        discover = [u for u in all_users if u not in partners]

        if type == "partner":
            result = partners
        elif type == "discover":
            result = discover
        else:
            result = all_users

        suppliers = []
        for u in result:
            suppliers.append({
                "supplier_id": u.get("id", u.get("user_id", "")),
                "name": u.get("business_name", u.get("full_name", "")),
                "category": u.get("category", u.get("business_type", "Umum")),
                "type": "partner" if u in partners else "discover",
                "reputation_score": u.get("reputation_score", 0),
                "total_transactions": u.get("total_transactions", 0),
                "on_time_delivery_rate": u.get("on_time_delivery_rate", 0),
                "wallet_address": u.get("wallet_address", ""),
                "is_active": u.get("is_active", True),
            })

        return success_response(data={
            "suppliers": suppliers,
            "summary": {
                "partner_count": len(partners),
                "discover_count": len(discover),
                "pending_requests": 0,
            },
            "pagination": {"page": page, "limit": limit, "total": len(suppliers)},
        })
    except Exception as e:
        # Fallback: return from discover list + hardcoded partners
        discover_list = [
            {"supplier_id": "sup-001", "name": "PT Padi Nusantara Jaya", "category": "Beras & Biji-bijian", "type": "discover", "reputation_score": 95, "total_transactions": 0, "on_time_delivery_rate": 0, "wallet_address": "", "is_active": True},
            {"supplier_id": "sup-002", "name": "CV Makmur Minyak", "category": "Minyak Goreng", "type": "discover", "reputation_score": 82, "total_transactions": 0, "on_time_delivery_rate": 0, "wallet_address": "", "is_active": True},
        ]
        all_sup = discover_list
        if type == "partner":
            all_sup = []
        elif type == "discover":
            all_sup = discover_list

        return success_response(data={
            "suppliers": all_sup,
            "summary": {"partner_count": 0, "discover_count": len(discover_list), "pending_requests": 0},
            "pagination": {"page": page, "limit": limit, "total": len(all_sup)},
        })


@app.get("/suppliers/partnership-requests")
def get_partnership_requests(status: str = ""):
    """Get partnership requests (distributor -> supplier)."""
    try:
        res = supabase.table("partnerships").select("*")
        if status:
            res = res.eq("status", status)
        res = res.execute()
        requests = []
        for r in (res.data or []):
            requests.append({
                "request_id": r.get("id", r.get("request_id", "")),
                "distributor": {
                    "id": r.get("distributor_id", r.get("retailer_name", "")),
                    "name": r.get("distributor_name", r.get("retailer_name", "")),
                    "business_name": r.get("distributor_name", r.get("retailer_name", "")),
                },
                "status": r.get("status", "pending"),
                "created_at": r.get("created_at", now_iso()),
            })
        return success_response(data={
            "requests": requests,
            "pagination": {"page": 1, "limit": 20, "total": len(requests)},
        })
    except Exception as e:
        return success_response(data={"requests": [], "pagination": {"page": 1, "limit": 20, "total": 0}})


@app.post("/suppliers/partnership-request")
def create_partnership_request(body: dict):
    """Distributor sends partnership request to supplier."""
    supplier_id = body.get("supplier_id", "")
    try:
        res = supabase.table("partnerships").insert({
            "supplier_id": supplier_id,
            "status": "pending",
            "created_at": now_iso(),
        }).execute()
        if res.data:
            return success_response(data={
                "request_id": res.data[0].get("id", ""),
                "supplier_id": supplier_id,
                "supplier_name": "",
                "status": "pending",
                "created_at": now_iso(),
            }, message="Request kemitraan dikirim")
    except:
        pass
    return success_response(data={
        "request_id": f"req-{uuid.uuid4().hex[:8]}",
        "supplier_id": supplier_id,
        "supplier_name": "",
        "status": "pending",
        "created_at": now_iso(),
    }, message="Request kemitraan dikirim")


@app.get("/suppliers/{supplier_id}/stock")
def get_supplier_stock(supplier_id: str):
    """Get stock items from a specific supplier."""
    try:
        res = supabase.table("inventory").select("*").eq("user_id", supplier_id).execute()
        items = res.data or []
        products = []
        for item in items:
            stock = item.get("stock", item.get("current_stock", 0))
            min_stock = item.get("min_stock", 10)
            status = "out_of_stock" if stock == 0 else ("low_stock" if stock < min_stock else "in_stock")
            products.append({
                "item_id": item.get("id", ""),
                "name": item.get("name", item.get("product_name", "")),
                "category": item.get("category", ""),
                "stock": stock,
                "min_stock": min_stock,
                "unit": item.get("unit", "pcs"),
                "status": status,
                "estimated_restock_days": item.get("estimated_restock_days", None),
                "last_updated": item.get("last_updated", item.get("updated_at", now_iso())),
            })
        return success_response(data={
            "supplier": {"supplier_id": supplier_id, "name": "", "is_partner": True},
            "products": products,
            "pagination": {"page": 1, "limit": 20, "total": len(products)},
        })
    except Exception as e:
        return success_response(data={
            "supplier": {"supplier_id": supplier_id, "name": "", "is_partner": False},
            "products": [],
            "pagination": {"page": 1, "limit": 20, "total": 0},
        })


@app.put("/suppliers/partnership-request/{request_id}")
def respond_partnership_request(request_id: str, body: dict):
    """Accept or reject a partnership request."""
    action = body.get("action", "reject")
    new_status = "accepted" if action == "accept" else "rejected"
    try:
        supabase.table("partnerships").update({"status": new_status}).eq("id", request_id).execute()
    except:
        pass
    return success_response(data={"request_id": request_id, "action": action}, message=f"Request {new_status}")


@app.get("/suppliers/discover")
def discover_suppliers():
    """Legacy discover endpoint — redirects to /suppliers?type=discover."""
    data = get_suppliers(type="discover")
    return data

# ==========================================
# 21. NOTIFICATIONS
# ==========================================

@app.get("/notifications/{user_name}")
def get_user_notifications(user_name: str):
    res = supabase.table("notifications").select("*").eq("user_name", user_name).order("created_at", desc=True).execute()
    return success_response(data=res.data, message="Notifikasi ditarik")


@app.patch("/notifications/read/{notif_id}")
def mark_notification_read(notif_id: str):
    supabase.table("notifications").update({"is_read": True}).eq("id", notif_id).execute()
    return success_response(message="Notifikasi ditandai dibaca")

# ==========================================
# 22. PAYMENTS (checkout + webhook)
# ==========================================

@app.post("/payments/checkout/{order_id}")
def checkout_order(order_id: str):
    try:
        res = supabase.table("orders").select("*").eq("id", order_id).execute()
        if not res.data:
            return error_response("Pesanan tidak ditemukan.")
        nomor_va = f"8077{random.randint(1000000, 9999999)}"
        return success_response(
            data={"order_id": order_id, "total_tagihan": res.data[0].get("total_price"), "metode": "BCA Virtual Account", "nomor_va": nomor_va},
            message="Checkout berhasil",
        )
    except Exception as e:
        return error_response(str(e))


@app.post("/payments/webhook")
def payment_webhook(data: WebhookPayment):
    try:
        status_map = {"settlement": "processing", "expire": "cancelled", "cancel": "cancelled", "deny": "cancelled"}
        status_baru = status_map.get(data.transaction_status, "pending")
        supabase.table("orders").update({"status": status_baru}).eq("id", data.order_id).execute()
        return success_response(data={"order_id": data.order_id}, message=f"Webhook diterima, status: {status_baru}")
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 23. EXPORT
# ==========================================

@app.get("/export/orders/{store_name}")
def export_orders(store_name: str):
    res = supabase.table("orders").select("*").eq("retailer_name", store_name).execute()
    if not res.data:
        return error_response("Tidak ada data untuk diexport.")
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=res.data[0].keys())
    writer.writeheader()
    writer.writerows(res.data)
    return StreamingResponse(
        io.StringIO(output.getvalue()), media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=laporan_order_{store_name}.csv"},
    )

# ==========================================
# 24. TEAM
# ==========================================

@app.get("/team/{store_name}")
def get_team(store_name: str):
    res = supabase.table("team_members").select("*").eq("store_name", store_name).execute()
    return success_response(data=res.data, message="Team ditarik")


@app.post("/team/invite/{store_name}")
def invite_member(store_name: str, member: TeamMemberInvite):
    res = supabase.table("team_members").insert({"store_name": store_name, **member.dict()}).execute()
    return success_response(data=res.data[0], message="Member diundang")
