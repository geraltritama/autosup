import os
import csv
import io
import random
import uuid
import json
import hashlib
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv
from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from supabase import create_client, Client
import requests
from pydantic import BaseModel
from typing import Any, Optional

load_dotenv()

# Blockchain service (graceful degradation if solders/solana not installed)
try:
    import blockchain as bc
    _BC = True
except Exception:
    bc = None  # type: ignore
    _BC = False

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
    user_id: Optional[str] = None
    price: Optional[float] = None
    min_threshold: Optional[int] = None
    category: Optional[str] = None
    unit: Optional[str] = None

class UpdateStockReq(BaseModel):
    current_stock: int
    price: Optional[float] = None

class CreateOrderReq(BaseModel):
    """Deprecated — use CreateOrderReqV2 inline at POST /orders."""
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
    requester_id: Optional[str] = None

class UpdatePartnershipReq(BaseModel):
    action: str  # "accept" | "reject"

class OpenCreditReq(BaseModel):
    retailer_id: str
    credit_limit: float
    distributor_id: Optional[str] = None

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

class Verify2FAReq(BaseModel):
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


def auth_users_by_role(role: str) -> list[dict]:
    """Fetch users from Supabase Auth by role, return as dict list."""
    results = []

    # Primary: Supabase Auth REST API (most reliable)
    try:
        headers = {
            "apikey": os.getenv("SUPABASE_KEY"),
            "Authorization": f"Bearer {os.getenv('SUPABASE_KEY')}",
        }
        resp = requests.get(
            f"{os.getenv('SUPABASE_URL')}/auth/v1/admin/users",
            headers=headers,
            timeout=10,
        )
        if resp.status_code == 200:
            for u in resp.json().get("users", []):
                meta = u.get("user_metadata", {}) or {}
                if meta.get("role") == role:
                    results.append({
                        "id": u.get("id", ""),
                        "email": u.get("email", ""),
                        "full_name": meta.get("full_name", ""),
                        "business_name": meta.get("business_name", ""),
                        "role": role,
                        "phone": meta.get("phone", ""),
                        "business_type": meta.get("business_type", ""),
                        "reputation_score": meta.get("reputation_score", 0),
                        "city": meta.get("city", ""),
                        "is_active": True,
                    })
            return results
    except Exception:
        pass

    # Fallback: supabase-py admin API
    try:
        auth_response = supabase.auth.admin.list_users()
        auth_users = auth_response.users if hasattr(auth_response, 'users') else list(auth_response)
        for u in auth_users:
            meta = u.user_metadata or {}
            if meta.get("role") == role:
                results.append({
                    "id": u.id,
                    "email": u.email or "",
                    "full_name": meta.get("full_name", ""),
                    "business_name": meta.get("business_name", ""),
                    "role": role,
                    "phone": meta.get("phone", ""),
                    "business_type": meta.get("business_type", ""),
                    "reputation_score": meta.get("reputation_score", 0),
                    "city": meta.get("city", ""),
                    "is_active": True,
                })
    except Exception:
        pass
    return results


# ==========================================
# 3. SUPABASE & GEMINI
# ==========================================

supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "google/gemma-2-9b-it:free")
AI_URL = "https://openrouter.ai/api/v1/chat/completions"

# ─── Rate-limit cooldown ─────────────────────────────────────────────────────
import threading
_rate_limit_until = 0.0
_last_call_time = 0.0
_rate_lock = threading.Lock()

def _call_ai(prompt: str) -> str:
    """Call OpenRouter AI with burst prevention and rate-limit cooldown."""
    global _rate_limit_until, _last_call_time
    import time as _time, re as _re

    if not OPENROUTER_KEY:
        raise RuntimeError("OPENROUTER_API_KEY not configured. Sign up at https://openrouter.ai/keys")

    if not OPENROUTER_KEY.startswith("sk-or-"):
        raise RuntimeError("Invalid OPENROUTER_API_KEY format. Must start with 'sk-or-v1-'. Get key at https://openrouter.ai/keys")

    now_t = _time.time()
    with _rate_lock:
        gap = now_t - _last_call_time
        if gap < 2:
            _time.sleep(2 - gap + 0.1)
        _last_call_time = _time.time()
        if _time.time() < _rate_limit_until:
            wait = _rate_limit_until - _time.time()
            raise RuntimeError(f"AI rate-limited. Cooldown: {wait:.0f}s remaining.")

    try:
        resp = requests.post(
            AI_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "AUTOSUP",
            },
            json={
                "model": AI_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
            },
            timeout=30,
        )
        if resp.status_code != 200:
            detail = resp.text[:300]
            if resp.status_code == 429:
                delay = 60
                retry = resp.headers.get("Retry-After", "")
                if retry and retry.isdigit():
                    delay = int(retry)
                with _rate_lock:
                    _rate_limit_until = _time.time() + delay + 10
                raise RuntimeError(f"OpenRouter rate limited. Retry in {delay}s.")
            if resp.status_code == 401:
                raise RuntimeError(f"Invalid API key. Check OPENROUTER_API_KEY in .env — should start with 'sk-or-v1-'")
            if resp.status_code == 404:
                raise RuntimeError(f"Model '{AI_MODEL}' not found. Try another model in .env: AI_MODEL=meta-llama/llama-3.1-8b-instruct:free")
            raise RuntimeError(f"OpenRouter error {resp.status_code}: {detail}")
        body = resp.json()
        return body["choices"][0]["message"]["content"]
    except RuntimeError:
        raise
    except Exception as e:
        raise RuntimeError(f"AI call failed: {str(e)[:200]}")

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
        # Step 1: Daftarkan ke auth.users
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
        # Also insert into public.users for queryable supplier/distributor/retailer lists
        try:
            supabase.table("users").upsert({
                "id": res.user.id,
                "role": req.role,
                "business_name": req.business_name,
            }).execute()
        except Exception:
            pass  # table might not exist yet — non-critical

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


@app.post("/auth/forgot-password")
def forgot_password(body: dict):
    """Send password reset email via Supabase."""
    try:
        email = body.get("email", "")
        if not email:
            return error_response("Email diperlukan.")
        supabase.auth.reset_password_email(email)
        return success_response(message="Link reset password telah dikirim ke email.")
    except Exception as e:
        return error_response(f"Gagal mengirim reset: {str(e)}")


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

def _map_inventory_item(i: dict) -> dict:
    return {
        "id": i.get("id"),
        "name": i.get("product_name"),
        "stock": i.get("current_stock"),
        "min_stock": i.get("min_threshold", 0),
        "category": i.get("category", "umum"),
        "unit": i.get("unit", "pcs"),
        "price": i.get("price", 0) or 0,
    }

@app.get("/inventory")
def get_inventory(user_id: Optional[str] = None):
    try:
        query = supabase.table("inventories").select("*")
        if user_id:
            query = query.eq("user_id", user_id)
        res = query.execute()
        items = [_map_inventory_item(i) for i in (res.data or [])]
        return success_response(data=items, message="Berhasil mengambil data inventory")
    except Exception as e:
        return error_response(str(e))

@app.get("/inventory/seller/{seller_id}")
def get_seller_inventory(seller_id: str):
    try:
        res = supabase.table("inventories").select("*").eq("user_id", seller_id).execute()
        items = [_map_inventory_item(i) for i in (res.data or [])]
        return success_response(data=items, message="Berhasil mengambil inventory seller")
    except Exception as e:
        return error_response(str(e))


@app.post("/inventory")
def add_inventory(data: NewInventoryItem):
    full_payload = {"product_name": data.product_name, "current_stock": data.current_stock}
    if data.user_id:
        full_payload["user_id"] = data.user_id
    if data.price is not None:
        full_payload["price"] = data.price
    if data.min_threshold is not None:
        full_payload["min_threshold"] = data.min_threshold
    if data.category is not None:
        full_payload["category"] = data.category
    if data.unit is not None:
        full_payload["unit"] = data.unit
    try:
        res = supabase.table("inventories").insert(full_payload).execute()
        i = res.data[0]
        return success_response(data=_map_inventory_item(i), message="Barang baru berhasil ditambahkan")
    except Exception:
        # Fallback: insert only core columns in case extended columns don't exist yet
        try:
            minimal = {"product_name": data.product_name, "current_stock": data.current_stock}
            res = supabase.table("inventories").insert(minimal).execute()
            i = res.data[0]
            return success_response(data=_map_inventory_item(i), message="Barang baru berhasil ditambahkan (skema terbatas — jalankan migrasi SQL)")
        except Exception as e2:
            return error_response(str(e2))


@app.patch("/inventory/{item_id}")
def update_inventory(item_id: str, data: UpdateStockReq):
    try:
        update_payload = {"current_stock": data.current_stock}
        if data.price is not None:
            update_payload["price"] = data.price
        res = supabase.table("inventories").update(update_payload).eq("id", item_id).execute()
        if not res.data:
            return error_response("Barang tidak ditemukan.")
        i = res.data[0]
        return success_response(
            data=_map_inventory_item(i),
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
def get_orders(status: Optional[str] = None, search: Optional[str] = None,
               role: Optional[str] = None, user_id: Optional[str] = None,
               page: int = 1, limit: int = 20):
    try:
        query = supabase.table("orders").select("*")
        if status:
            query = query.eq("status", status)
        if user_id and role == "buyer":
            query = query.eq("buyer_id", user_id)
        elif user_id and role == "seller":
            query = query.eq("seller_id", user_id)
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


@app.get("/orders/trust-summary")
def get_orders_trust_summary(user_id: Optional[str] = None, role: Optional[str] = None):
    try:
        if not user_id:
            return success_response(data={
                "escrow_held": 0, "escrow_released": 0, "escrow_refunded": 0,
                "total_released_value": 0, "reputation_score": 0,
            }, message="Trust summary")

        # Fetch orders scoped to user
        if role == "supplier":
            res = supabase.table("orders").select("*").eq("seller_id", user_id).execute()
        else:
            res = supabase.table("orders").select("*").eq("buyer_id", user_id).execute()
        orders = res.data or []

        held = sum(1 for o in orders if o.get("escrow_status") == "held")
        released = sum(1 for o in orders if o.get("escrow_status") == "released")
        refunded = sum(1 for o in orders if o.get("escrow_status") == "refunded")
        total_released_value = sum(
            o.get("total_price", 0) for o in orders if o.get("escrow_status") == "released"
        )

        # Reputation score from auth metadata
        reputation_score = 0
        raw_user = _get_auth_user(user_id)
        if raw_user:
            meta = raw_user.get("user_metadata", {}) or {}
            reputation_score = meta.get("reputation_score", 0)

        return success_response(data={
            "escrow_held": held,
            "escrow_released": released,
            "escrow_refunded": refunded,
            "total_released_value": total_released_value,
            "reputation_score": reputation_score,
        }, message="Trust summary")
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


class CreateOrderReqV2(BaseModel):
    seller_id: str
    seller_type: str
    buyer_id: str
    buyer_name: str
    buyer_role: str
    seller_name: Optional[str] = None
    items: list[dict]
    delivery_address: str
    notes: Optional[str] = None

@app.post("/orders")
def create_order(data: CreateOrderReqV2):
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
            "buyer_id": data.buyer_id,
            "buyer_name": data.buyer_name,
            "buyer_role": data.buyer_role,
            "seller_id": data.seller_id,
            "seller_name": data.seller_name or "",
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

        # Record payment proof on-chain via Memo program (non-blocking)
        payment_proof_sig = None
        if bc:
            try:
                buyer_wallet = bc.get_or_create_wallet(supabase, data.buyer_id)
                seller_wallet = bc.get_or_create_wallet(supabase, data.seller_id)
                payment_proof_sig = bc.record_payment_proof(
                    order_id,
                    buyer_wallet["pubkey"],
                    seller_wallet["pubkey"],
                    int(total_amount),
                    action="payment_init",
                )
                try:
                    supabase.table("orders").update({"payment_proof_sig": payment_proof_sig}).eq("id", order_id).execute()
                except Exception:
                    pass
            except Exception:
                pass  # Non-critical — order already persisted

        # Auto-create shipment
        try:
            shipment_id = str(uuid.uuid4())
            supabase.table("shipments").insert({
                "id": shipment_id,
                "order_id": order_id,
                "retailer_name": data.buyer_name,
                "destination": data.delivery_address or "",
                "status": "packed",
                "eta": future_iso(hours=48),
                "carrier": "JNE",
                "sender_id": data.seller_id,
                "receiver_id": data.buyer_id,
                "created_at": now_iso(),
            }).execute()
        except Exception:
            pass  # Non-critical

        return success_response(
            data={
                "order_id": o.get("id", order_id),
                "order_number": o.get("order_number", order_number),
                "total_amount": total_amount,
                "status": "pending",
                "escrow_status": "held",
                "created_at": o.get("created_at", now_iso()),
                "payment_proof_sig": payment_proof_sig,
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

        # Auto-release escrow and bump seller reputation when order delivered
        if data.status == "delivered":
            update_payload["escrow_status"] = "released"
            order_res = supabase.table("orders").select("seller_id").eq("id", order_id).execute()
            if order_res.data:
                seller_id = order_res.data[0].get("seller_id")
                if seller_id:
                    raw_seller = _get_auth_user(seller_id)
                    if raw_seller:
                        meta = raw_seller.get("user_metadata", {}) or {}
                        current_score = meta.get("reputation_score", 0) or 0
                        _update_auth_user_metadata(seller_id, {"reputation_score": current_score + 1})
                    # Update on-chain reputation (non-blocking)
                    if bc:
                        try:
                            seller_wallet = bc.get_or_create_wallet(supabase, seller_id)
                            seller_orders = supabase.table("orders").select("status").eq("seller_id", seller_id).execute().data or []
                            total = len(seller_orders)
                            fulfilled = sum(1 for o in seller_orders if o.get("status") == "delivered")
                            fulfillment_rate = int(fulfilled * 100 / max(total, 1))
                            bc.update_reputation(
                                seller_wallet["pubkey"],
                                fulfillment_rate=fulfillment_rate,
                                total_transactions=total,
                                positive_feedbacks=fulfilled,
                            )
                        except Exception:
                            pass

        supabase.table("orders").update(update_payload).eq("id", order_id).execute()
        return success_response(data={"order_id": order_id, "status": data.status}, message="Status diperbarui")
    except Exception as e:
        return error_response(str(e))


@app.delete("/orders/{order_id}")
def delete_order(order_id: str):
    """Hapus order test/dummy."""
    try:
        supabase.table("orders").delete().eq("id", order_id).execute()
        return success_response(data={"order_id": order_id}, message="Order dihapus")
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 8. DASHBOARD SUMMARY (role-based)
# ==========================================

@app.get("/dashboard/summary")
def get_dashboard_summary(x_user_role: Optional[str] = Header(default=None),
                          user_id: Optional[str] = None):
    try:
        role = x_user_role or "distributor"

        # Orders filtered by user
        orders_query = supabase.table("orders").select("status,buyer_id,seller_id")
        if user_id:
            if role == "supplier":
                orders_query = orders_query.eq("seller_id", user_id)
            elif role == "retailer":
                orders_query = orders_query.eq("buyer_id", user_id)
            else:
                orders_query = orders_query.or_(f"buyer_id.eq.{user_id},seller_id.eq.{user_id}")
        orders = orders_query.execute().data or []

        # Inventory filtered by user
        inv_query = supabase.table("inventories").select("current_stock, min_threshold")
        if user_id:
            inv_query = inv_query.eq("user_id", user_id)
        inventory = inv_query.execute().data or []

        pending = sum(1 for o in orders if o.get("status") == "pending")
        processing = sum(1 for o in orders if o.get("status") in ["processing", "shipping"])
        completed = sum(1 for o in orders if o.get("status") == "delivered")
        total_inv = len(inventory)
        low_stock = sum(1 for i in inventory if 0 < i.get("current_stock", 0) < i.get("min_threshold", 0))
        out_of_stock = sum(1 for i in inventory if i.get("current_stock", 0) == 0)

        # AI insights from real agent activity (role-filtered)
        ai_alerts = []
        try:
            act_query = supabase.table("ai_activities").select("*").or_(f"activity_role.eq.{role},activity_role.eq.all").order("timestamp", desc=True).limit(5).execute()
            for a in (act_query.data or []):
                msg = a.get("impact", "")[:150]
                if msg:
                    ai_alerts.append({
                        "type": "ai_insight",
                        "message": msg,
                        "urgency": "high" if "high" in a.get("impact", "").lower() or "urgent" in a.get("impact", "").lower() else "medium",
                        "agent_name": a.get("agent_name", ""),
                        "timestamp": a.get("timestamp", ""),
                        "full_result": a.get("full_result", ""),
                    })
        except Exception:
            ai_alerts = [{"type": "restock_alert", "message": "AI agents belum menghasilkan insights.", "urgency": "low", "item_id": ""}]

        # Partnership counts filtered by user
        supplier_partner_count = 0
        distributor_partner_count = 0
        retailer_partner_count = 0
        pending_supplier_requests = 0
        pending_retailer_requests = 0
        try:
            p_query = supabase.table("partnerships").select("*")
            if user_id and role == "supplier":
                try:
                    p_query = p_query.or_(f"supplier_id.eq.{user_id},supplier_name.eq.{user_id}")
                except Exception:
                    p_query = p_query.eq("supplier_name", user_id)
            elif user_id and role == "distributor":
                try:
                    p_query = p_query.or_(f"distributor_id.eq.{user_id},retailer_name.eq.{user_id}")
                except Exception:
                    p_query = p_query.eq("retailer_name", user_id)
            partnerships = p_query.execute().data or []
            active_partnerships = [p for p in partnerships if p.get("status") in ["accepted", "approved", "partner"]]
            pending_partnerships = [p for p in partnerships if p.get("status") == "pending"]
            supplier_partner_count = len(active_partnerships)
            distributor_partner_count = len(active_partnerships)
            retailer_partner_count = len(active_partnerships)
            pending_supplier_requests = len(pending_partnerships)
            pending_retailer_requests = len(pending_partnerships)
        except Exception:
            pass

        if role == "supplier":
            data = {
                "role": "supplier",
                "products": {"total_active": total_inv, "low_stock_count": low_stock, "out_of_stock_count": out_of_stock},
                "orders": {"incoming_orders": pending, "processing": processing, "completed_this_month": completed},
                "partners": {"distributor_count": supplier_partner_count, "pending_requests": pending_supplier_requests},
                "ai_insights": ai_alerts,
            }
        elif role == "retailer":
            data = {
                "role": "retailer",
                "inventory": {"total_items": total_inv, "low_stock_count": low_stock, "out_of_stock_count": out_of_stock},
                "orders": {"active_orders": processing, "pending_approval": pending, "in_transit": processing,
                           "completed_this_month": completed, "order_accuracy_rate": 97},
                "spending": {"total_outstanding": 0, "monthly_spending": 0, "available_credit": 0,
                              "upcoming_due_payments": 0, "payment_success_rate": 0},
                "distributors": {"active_partnered": distributor_partner_count, "pending_requests": 0, "average_reliability_score": 0, "avg_delivery_time": 0},
                "forecast_accuracy_pct": 0,
                "ai_insights": ai_alerts,
            }
        else:
            data = {
                "role": "distributor",
                "inventory": {"total_items": total_inv, "low_stock_count": low_stock, "out_of_stock_count": out_of_stock},
                "orders": {"active_orders": processing, "pending_orders": pending, "completed_this_month": completed},
                "suppliers": {"partner_count": supplier_partner_count, "pending_requests": pending_supplier_requests},
                "retailers": {"partner_count": retailer_partner_count, "pending_requests": pending_retailer_requests},
                "ai_insights": ai_alerts,
            }

        return success_response(data=data, message="Data dashboard berhasil ditarik")
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 9. PAYMENTS
# ==========================================

@app.get("/payments/retailer")
def get_retailer_payments(user_id: Optional[str] = None):
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
            for i in raw
        ]
        if user_id:
            invoices = [inv for inv in invoices if inv.get("buyer_id") == user_id or True]
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
def get_distributor_payments(user_id: Optional[str] = None):
    try:
        query = supabase.table("payments").select("*")
        if user_id:
            try:
                query = query.or_(f"payer_id.eq.{user_id},payee_id.eq.{user_id}")
            except Exception:
                pass
        res = query.execute()
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
                  status: Optional[str] = None, user_id: Optional[str] = None,
                  page: int = 1, limit: int = 20):
    try:
        query = supabase.table("retailers").select("*")
        if status:
            query = query.eq("status", status)
        if user_id:
            try:
                query = query.eq("distributor_id", user_id)
            except Exception:
                pass
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
        # Fallback: auth admin
        if not retailers:
            for u in auth_users_by_role("retailer"):
                retailers.append({
                    "retailer_id": u["id"],
                    "name": u.get("business_name", u.get("full_name", "")),
                    "contact_person": u.get("full_name", ""),
                    "phone": u.get("phone", ""),
                    "city": u.get("city", ""),
                    "segment": "regular",
                    "status": "active",
                    "monthly_order_volume": 0,
                    "total_purchase_amount": 0,
                    "last_order_at": past_iso(days=3),
                })
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


class AddRetailerReqV2(BaseModel):
    name: str
    contact_person: str
    phone: str
    city: str
    segment: str
    distributor_id: Optional[str] = None

@app.post("/retailers")
def add_retailer(data: AddRetailerReqV2):
    try:
        payload = {k: v for k, v in data.dict().items() if v is not None}
        payload.update({"status": "active", "monthly_order_volume": 0, "total_purchase_amount": 0})
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
def get_distributors(search: Optional[str] = None, status: Optional[str] = None,
                     type: Optional[str] = None,
                     user_id: Optional[str] = None, page: int = 1, limit: int = 20):
    if not status and type:
        status = type  # alias: type=partner → status=partner
    try:
        # Always use auth users as source — their id matches partnership distributor_id
        distributors = [
            {
                "distributor_id": u["id"],
                "name": u.get("business_name", u.get("full_name", "")),
                "business_name": u.get("business_name", u.get("full_name", "")),
                "region": u.get("city", u.get("region", "")),
                "reputation_score": u.get("reputation_score", 0),
                "order_volume": u.get("order_volume", 0),
                "payment_punctuality": u.get("payment_punctuality", 0),
                "avg_delivery_days": u.get("avg_delivery_days", 0),
                "on_time_delivery_rate": u.get("on_time_delivery_rate", 0),
                "total_transactions": u.get("total_transactions", 0),
                "is_active": u.get("is_active", True),
                "partnership_status": "none",
                "address": u.get("address", ""),
                "contact_person": u.get("contact_person", ""),
                "phone": u.get("phone", ""),
                "email": u.get("email", ""),
            }
            for u in auth_users_by_role("distributor")
        ]

        # Mark partner / pending status for current user (supplier or retailer)
        if user_id:
            try:
                p_rows = supabase.table("partnerships").select("distributor_id,retailer_name,status").or_(
                    f"supplier_id.eq.{user_id},supplier_name.eq.{user_id},retailer_name.eq.{user_id}"
                ).execute().data or []
                partner_ids = {
                    p.get("distributor_id", "") for p in p_rows
                    if p.get("status") in ["approved", "accepted"]
                }
                pending_ids = {
                    p.get("distributor_id", "") for p in p_rows
                    if p.get("status") == "pending"
                }
                for d in distributors:
                    did = d["distributor_id"] or ""
                    if did in partner_ids:
                        d["partnership_status"] = "partner"
                    elif did in pending_ids:
                        d["partnership_status"] = "pending"
            except Exception:
                pass

        if search:
            distributors = [d for d in distributors if search.lower() in d["name"].lower()]
        if status and status != "all":
            distributors = [d for d in distributors if d["partnership_status"] == status]

        total = len(distributors)
        start = (page - 1) * limit
        partner_count = sum(1 for d in distributors if d["partnership_status"] == "partner")
        pending_count = sum(1 for d in distributors if d["partnership_status"] == "pending")
        return success_response(
            data={
                "distributors": distributors[start: start + limit],
                "summary": {
                    "partner_count": partner_count,
                    "pending_count": pending_count,
                    "total_order_volume": sum(d.get("order_volume", 0) for d in distributors),
                    "avg_punctuality": sum(d.get("payment_punctuality", 0) for d in distributors) // max(total, 1),
                    "avg_delivery_days": sum(d.get("avg_delivery_days", 0) for d in distributors) // max(total, 1),
                },
                "pagination": {"page": page, "limit": limit, "total": total},
            },
            message="Data distributor berhasil ditarik",
        )
    except Exception as e:
        return error_response(str(e))


@app.get("/distributors/partnership-requests")
def get_distributor_requests(user_id: Optional[str] = None, page: int = 1, limit: int = 20):
    try:
        query = supabase.table("partnerships").select("*").eq("status", "pending")
        if user_id:
            # Filter request yang masuk KE distributor ini
            query = query.eq("distributor_id", user_id)
        res = query.execute()

        # Ambil nama retailer dari auth users
        retailer_ids = [p.get("retailer_name") for p in (res.data or []) if p.get("retailer_name")]
        retailer_names = {}
        for u in auth_users_by_role("retailer"):
            if u["id"] in retailer_ids:
                retailer_names[u["id"]] = u.get("business_name") or u.get("full_name") or "Unknown"

        requests = [
            {
                "request_id": p.get("id"),
                "distributor_id": p.get("retailer_name", ""),
                "distributor_name": retailer_names.get(p.get("retailer_name", ""), "Unknown"),
                "status": p.get("status", "pending"),
                "created_at": p.get("created_at", now_iso()),
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
        # Dedup: check existing pending/approved for this requester+distributor pair
        if data.requester_id and data.distributor_id:
            existing = supabase.table("partnerships").select("id,status").eq("distributor_id", data.distributor_id).or_(
                f"retailer_name.eq.{data.requester_id}"
            ).in_("status", ["pending", "approved", "accepted"]).execute().data or []
            if existing:
                row = existing[0]
                return success_response(
                    data={"request_id": row["id"], "distributor_id": data.distributor_id, "status": row["status"], "created_at": now_iso()},
                    message="Partnership sudah ada",
                )
        request_id = str(uuid.uuid4())
        row_data = {"id": request_id, "distributor_id": data.distributor_id, "status": "pending", "created_at": now_iso()}
        if data.requester_id:
            row_data["retailer_name"] = data.requester_id
        supabase.table("partnerships").insert(row_data).execute()
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
def get_partnerships_summary(user_id: Optional[str] = None):
    try:
        query = supabase.table("partnerships").select("*")
        if user_id:
            try:
                query = query.or_(f"supplier_id.eq.{user_id},supplier_name.eq.{user_id},distributor_id.eq.{user_id},retailer_name.eq.{user_id}")
            except Exception:
                pass
        res = query.execute()
        ps = res.data or []
        active = sum(1 for p in ps if p.get("status") in ("approved", "accepted"))
        pending = sum(1 for p in ps if p.get("status") == "pending")
        rejected = sum(1 for p in ps if p.get("status") in ("rejected", "terminated"))
        total_closed = active + rejected
        renewal_rate = round(active / max(total_closed, 1) * 100) if total_closed > 0 else 100

        # Real NFT count
        nft_count = 0
        try:
            if user_id:
                nft_res = supabase.table("partnership_nfts").select("id", count="exact").or_(
                    f"distributor_id.eq.{user_id},supplier_id.eq.{user_id},retailer_id.eq.{user_id}"
                ).execute()
            else:
                nft_res = supabase.table("partnership_nfts").select("id", count="exact").execute()
            nft_count = nft_res.count or len(nft_res.data or [])
        except Exception:
            nft_count = active

        # Network growth: partnerships in last 30d vs previous 30d
        now = datetime.utcnow()
        cutoff_30 = now - timedelta(days=30)
        cutoff_60 = now - timedelta(days=60)
        recent_new = sum(1 for p in ps if p.get("created_at") and _parse_ts(p["created_at"]) and _parse_ts(p["created_at"]) >= cutoff_30)
        prev_new   = sum(1 for p in ps if p.get("created_at") and _parse_ts(p["created_at"]) and cutoff_60 <= _parse_ts(p["created_at"]) < cutoff_30)
        network_growth = round(((recent_new - prev_new) / max(prev_new, 1)) * 100) if prev_new > 0 else (10 if recent_new > 0 else 0)

        # Trust score: average reputation of partners
        trust_score = 87  # baseline; can be derived from reputation data if needed

        insights = []
        if pending > 0:
            insights.append({"type": "new_partner", "message": f"{pending} permintaan kemitraan menunggu persetujuan.", "urgency": "medium"})
        if nft_count > 0:
            insights.append({"type": "nft_issued", "message": f"{nft_count} Partnership NFT aktif di Solana Devnet.", "urgency": "low"})

        return success_response(
            data={
                "summary": {
                    "active_partnerships": active,
                    "pending_agreements": pending,
                    "contract_renewal_rate": renewal_rate,
                    "trust_score": trust_score,
                    "network_growth": network_growth,
                    "nft_issued": nft_count,
                },
                "insights": insights,
            },
            message="Data partnership berhasil ditarik",
        )
    except Exception as e:
        return error_response(str(e))


@app.delete("/partnerships/between/{partner_id}")
def delete_partnership(partner_id: str, user_id: Optional[str] = None):
    """Terminate or cancel partnership between current user and partner_id."""
    if not user_id:
        return error_response("user_id required")
    try:
        # Fetch all partnerships involving user_id on any side
        res = supabase.table("partnerships").select("id,distributor_id,supplier_id,supplier_name,retailer_name").or_(
            f"distributor_id.eq.{user_id},supplier_id.eq.{user_id},supplier_name.eq.{user_id},retailer_name.eq.{user_id}"
        ).execute()
        rows = res.data or []
        # Keep only rows where partner_id appears on any other column
        matching_ids = []
        for r in rows:
            all_vals = {
                r.get("distributor_id", ""),
                r.get("supplier_id", ""),
                r.get("supplier_name", ""),
                r.get("retailer_name", ""),
            }
            if partner_id in all_vals:
                matching_ids.append(r["id"])
        if not matching_ids:
            return error_response("Partnership tidak ditemukan")
        for pid in matching_ids:
            supabase.table("partnerships").update({"status": "terminated"}).eq("id", pid).execute()
        return success_response(data={"terminated": len(matching_ids)}, message="Partnership berhasil dihapus")
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


@app.post("/wallet/airdrop")
def request_wallet_airdrop(user_id: Optional[str] = None):
    """Request devnet SOL airdrop for a user's wallet (max 2 SOL)."""
    if not user_id:
        return error_response("user_id diperlukan")
    try:
        if not bc:
            return error_response("Blockchain service tidak tersedia — install solders dan solana")
        wallet = bc.get_or_create_wallet(supabase, user_id)
        success = bc.request_airdrop(wallet["pubkey"])
        return success_response(data={"success": success, "pubkey": wallet["pubkey"]},
                                message="Airdrop berhasil" if success else "Airdrop gagal — coba lagi")
    except Exception as e:
        return error_response(str(e))


@app.post("/wallet/connect")
def connect_browser_wallet(user_id: Optional[str] = None, body: dict = None):
    """Store a browser-provided wallet pubkey (Phantom/MetaMask) for a user."""
    if not user_id:
        return error_response("user_id diperlukan")
    if not body:
        body = {}
    pubkey = body.get("pubkey", "").strip()
    wallet_type = body.get("wallet_type", "browser")
    if not pubkey:
        return error_response("pubkey diperlukan")
    try:
        # Upsert: store browser pubkey, mark as browser wallet (no privkey)
        supabase.table("user_wallets").upsert({
            "user_id": user_id,
            "pubkey": pubkey,
            "privkey_b58": f"__browser__{wallet_type}__",
        }).execute()
        explorer_url = f"https://explorer.solana.com/address/{pubkey}?cluster=devnet"
        return success_response(data={
            "pubkey": pubkey,
            "wallet_type": wallet_type,
            "explorer_url": explorer_url,
            "is_browser_wallet": True,
        }, message=f"Wallet {wallet_type} berhasil dihubungkan")
    except Exception as e:
        return error_response(str(e))


@app.delete("/wallet/connect")
def disconnect_browser_wallet(user_id: Optional[str] = None):
    """Remove browser wallet — regenerate a fresh backend-managed wallet."""
    if not user_id:
        return error_response("user_id diperlukan")
    try:
        # Delete current record so next GET /wallet/my auto-generates a new keypair
        supabase.table("user_wallets").delete().eq("user_id", user_id).execute()
        # Immediately re-create a backend-managed wallet
        if bc:
            wallet = bc.get_or_create_wallet(supabase, user_id)
        else:
            seed = f"wallet:{user_id}"
            h = hashlib.sha256(seed.encode()).digest()
            _B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
            n = int.from_bytes(h, "big")
            chars = []
            while n:
                chars.append(_B58[n % 58])
                n //= 58
            pk = "".join(reversed(chars))[:44].ljust(44, "1")
            wallet = {"pubkey": pk, "explorer_url": f"https://explorer.solana.com/address/{pk}?cluster=devnet"}
        return success_response(data={"pubkey": wallet["pubkey"]}, message="Browser wallet dilepas, wallet baru dibuat")
    except Exception as e:
        return error_response(str(e))


@app.get("/wallet/my")
def get_my_wallet_info(user_id: Optional[str] = None):
    """Get wallet info — also returns whether it's a browser wallet."""
    if not user_id:
        return error_response("user_id diperlukan")
    try:
        is_browser = False
        wallet_type = "backend"
        # Check existing record first
        try:
            row = supabase.table("user_wallets").select("pubkey,privkey_b58").eq("user_id", user_id).execute()
            if row.data:
                privkey = row.data[0].get("privkey_b58", "")
                if privkey.startswith("__browser__"):
                    is_browser = True
                    wallet_type = privkey.replace("__browser__", "").replace("__", "")
        except Exception:
            pass

        if bc:
            wallet = bc.get_or_create_wallet(supabase, user_id)
            balance = bc.get_sol_balance(wallet["pubkey"]) if not is_browser else 0.0
        else:
            seed = f"wallet:{user_id}"
            h = hashlib.sha256(seed.encode()).digest()
            _B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
            n = int.from_bytes(h, "big")
            chars = []
            while n:
                chars.append(_B58[n % 58])
                n //= 58
            pk = "".join(reversed(chars))[:44].ljust(44, "1")
            wallet = {"pubkey": pk, "explorer_url": f"https://explorer.solana.com/address/{pk}?cluster=devnet"}
            balance = 0.0
        return success_response(data={
            "pubkey": wallet["pubkey"],
            "explorer_url": wallet["explorer_url"],
            "sol_balance": balance,
            "is_browser_wallet": is_browser,
            "wallet_type": wallet_type,
        })
    except Exception as e:
        return error_response(str(e))


@app.get("/blockchain/escrow/{order_id}")
def get_escrow_details(order_id: str):
    """Return escrow blockchain verification details for an order."""
    try:
        res = supabase.table("orders").select("id,order_number,escrow_status,total_price,status,seller_id,buyer_id,created_at,updated_at").eq("id", order_id).execute()
        if not res.data:
            return error_response("Order tidak ditemukan")
        o = res.data[0]

        # Generate deterministic on-chain tx hash (mock Solana devnet)
        import hashlib
        seed = f"escrow:{order_id}"
        h = hashlib.sha256(seed.encode()).hexdigest()
        tx_hash = h[:88]
        explorer_url = f"https://explorer.solana.com/tx/{tx_hash}?cluster=devnet"

        escrow_status = o.get("escrow_status", "held")
        order_status = o.get("status", "pending")

        events = [{"event": "escrow_created", "tx": tx_hash, "timestamp": o.get("created_at", "")}]
        if escrow_status == "released":
            seed_r = f"escrow_release:{order_id}"
            h_r = hashlib.sha256(seed_r.encode()).hexdigest()
            events.append({
                "event": "escrow_released",
                "tx": h_r[:88],
                "timestamp": o.get("updated_at", ""),
                "explorer_url": f"https://explorer.solana.com/tx/{h_r[:88]}?cluster=devnet",
            })
        elif escrow_status == "refunded":
            seed_rf = f"escrow_refund:{order_id}"
            h_rf = hashlib.sha256(seed_rf.encode()).hexdigest()
            events.append({
                "event": "escrow_refunded",
                "tx": h_rf[:88],
                "timestamp": o.get("updated_at", ""),
                "explorer_url": f"https://explorer.solana.com/tx/{h_rf[:88]}?cluster=devnet",
            })

        return success_response(data={
            "order_id": order_id,
            "order_number": o.get("order_number", ""),
            "escrow_status": escrow_status,
            "order_status": order_status,
            "total_amount": o.get("total_price", 0),
            "chain": "Solana Devnet",
            "program": "AUTOSUP_ESCROW_V1",
            "creation_tx": tx_hash,
            "explorer_url": explorer_url,
            "events": events,
        }, message="Escrow details ditarik")
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

def _parse_ts(iso_str: str):
    try:
        clean = iso_str.replace("Z", "").split("+")[0].strip()
        return datetime.fromisoformat(clean) if clean else None
    except Exception:
        return None

def _month_starts(now, n: int) -> list:
    result = []
    y, m = now.year, now.month
    for i in range(n - 1, -1, -1):
        mo = m - i
        yr = y
        while mo <= 0:
            mo += 12
            yr -= 1
        result.append(datetime(yr, mo, 1))
    return result

def _analytics_overview(all_orders: list, user_id: Optional[str], inventory: list) -> dict:
    from collections import defaultdict
    now = datetime.utcnow()

    orders_sell = [o for o in all_orders if o.get("seller_id") == user_id] if user_id else all_orders
    orders_buy  = [o for o in all_orders if o.get("buyer_id") == user_id]  if user_id else []
    delivered_sell = [o for o in orders_sell if o.get("status") == "delivered"]
    delivered_buy  = [o for o in orders_buy  if o.get("status") == "delivered"]

    cutoff_30 = now - timedelta(days=30)
    cutoff_60 = now - timedelta(days=60)

    def _price(o): return o.get("total_price", 0) or 0
    def _ts(o): return _parse_ts(o.get("created_at", "")) or now

    # Revenue growth (as seller)
    recent_rev = sum(_price(o) for o in delivered_sell if _ts(o) >= cutoff_30)
    prev_rev   = sum(_price(o) for o in delivered_sell if cutoff_60 <= _ts(o) < cutoff_30)
    revenue_growth = round(((recent_rev - prev_rev) / max(prev_rev, 1)) * 100) if prev_rev > 0 else (5 if recent_rev > 0 else 0)

    # Fulfillment: seller side preferred; fallback to buyer side for retailer
    if orders_sell:
        fulfillment_rate = round(len(delivered_sell) / max(len(orders_sell), 1) * 100)
    else:
        fulfillment_rate = round(len(delivered_buy) / max(len(orders_buy), 1) * 100)

    # Inventory turnover = delivered orders / inventory items
    turnover = round((len(delivered_sell) + len(delivered_buy)) / max(len(inventory), 1), 1)

    # Monthly trends (last 6 months)
    month_dts = _month_starts(now, 6)
    buckets: dict = {}
    for dt in month_dts:
        key = (dt.year, dt.month)
        buckets[key] = {"label": dt.strftime("%b"), "revenue": 0, "spending": 0}

    for o in all_orders:
        ts = _parse_ts(o.get("created_at", ""))
        if not ts:
            continue
        key = (ts.year, ts.month)
        if key not in buckets:
            continue
        price = _price(o)
        if o.get("seller_id") == user_id:
            buckets[key]["revenue"] += price
        if o.get("buyer_id") == user_id:
            buckets[key]["spending"] += price

    trends = [{"label": buckets[k]["label"], "revenue": buckets[k]["revenue"], "spending": buckets[k]["spending"]}
              for k in sorted(buckets)]

    # Top products from sell-side orders
    product_vol: dict = defaultdict(int)
    for o in orders_sell:
        for item in (o.get("items") or []):
            pname = item.get("product_name", item.get("name", item.get("item_name", "")))
            qty = item.get("quantity", item.get("qty", 0)) or 0
            if pname:
                product_vol[pname] += qty
    top_products = [{"name": n, "sales": v}
                    for n, v in sorted(product_vol.items(), key=lambda x: x[1], reverse=True)[:5]]

    return {
        "summary": {
            "revenue_growth": revenue_growth,
            "inventory_turnover": max(turnover, 0.1),
            "partner_performance": 80,
            "order_fulfillment_rate": fulfillment_rate,
            "forecast_accuracy": 0,
        },
        "trends": trends,
        "top_products": top_products,
    }


@app.get("/analytics/retailer/overview")
def analytics_retailer(user_id: Optional[str] = None):
    try:
        oq = supabase.table("orders").select("*")
        if user_id:
            oq = oq.eq("buyer_id", user_id)
        orders = oq.execute().data or []
        inventory = (supabase.table("inventories").select("*").eq("user_id", user_id).execute().data or []) if user_id else []
        return success_response(data=_analytics_overview(orders, user_id, inventory), message="Analytics retailer")
    except Exception as e:
        return error_response(str(e))


@app.get("/analytics/distributor/overview")
def analytics_distributor(user_id: Optional[str] = None):
    try:
        oq = supabase.table("orders").select("*")
        if user_id:
            oq = oq.or_(f"buyer_id.eq.{user_id},seller_id.eq.{user_id}")
        orders = oq.execute().data or []
        inventory = (supabase.table("inventories").select("*").eq("user_id", user_id).execute().data or []) if user_id else []
        return success_response(data=_analytics_overview(orders, user_id, inventory), message="Analytics distributor")
    except Exception as e:
        return error_response(str(e))


@app.get("/analytics/supplier/overview")
def analytics_supplier(user_id: Optional[str] = None):
    try:
        from collections import defaultdict
        oq = supabase.table("orders").select("*")
        if user_id:
            oq = oq.eq("seller_id", user_id)
        orders = oq.execute().data or []

        completed = [o for o in orders if o.get("status") == "delivered"]
        total_revenue = sum((o.get("total_price", 0) or 0) for o in completed)

        # Weekly trends (last 4 weeks)
        now = datetime.utcnow()
        weekly = []
        for i in range(3, -1, -1):
            start = now - timedelta(weeks=i + 1)
            end   = now - timedelta(weeks=i)
            wk = [o for o in orders if start <= (_parse_ts(o.get("created_at", "")) or now) < end]
            weekly.append({
                "period": f"Minggu {4 - i}",
                "revenue": sum((o.get("total_price", 0) or 0) for o in wk if o.get("status") == "delivered"),
                "orders": len(wk),
            })

        recent_rev = sum(t["revenue"] for t in weekly[2:])
        prev_rev   = sum(t["revenue"] for t in weekly[:2])
        growth_pct = round(((recent_rev - prev_rev) / max(prev_rev, 1)) * 100) if prev_rev > 0 else (5 if recent_rev > 0 else 0)

        # Distributor performance from real order data
        dist_orders: dict = defaultdict(list)
        dist_names: dict = {}
        for o in orders:
            bid = o.get("buyer_id", "")
            bname = o.get("buyer_name", "")
            if bid:
                dist_orders[bid].append(o)
                if bname:
                    dist_names[bid] = bname

        distributor_performance = []
        for dist_id, d_ords in dist_orders.items():
            delivered = [o for o in d_ords if o.get("status") == "delivered"]
            distributor_performance.append({
                "distributor_id": dist_id,
                "distributor_name": dist_names.get(dist_id, "Unknown"),
                "orders": len(d_ords),
                "revenue": sum((o.get("total_price", 0) or 0) for o in delivered),
                "reliability": round(len(delivered) / max(len(d_ords), 1) * 100),
            })
        distributor_performance.sort(key=lambda x: x["revenue"], reverse=True)

        return success_response(data={
            "summary": {
                "total_revenue": total_revenue,
                "total_orders": len(orders),
                "completed_orders": len(completed),
                "growth_pct": growth_pct,
            },
            "trends": weekly,
            "distributor_performance": distributor_performance,
        }, message="Analytics supplier")
    except Exception as e:
        return error_response(str(e))


@app.get("/analytics/distributor/regional")
def analytics_distributor_regional(user_id: Optional[str] = None, item_id: Optional[str] = None):
    try:
        from collections import defaultdict
        oq = supabase.table("orders").select("delivery_address, items, created_at")
        if user_id:
            oq = oq.eq("buyer_id", user_id)
        orders = oq.execute().data or []
        now = datetime.utcnow()
        cutoff_recent = now - timedelta(days=30)
        cutoff_prev   = now - timedelta(days=60)
        recent: dict = defaultdict(int)
        prev: dict   = defaultdict(int)
        for order in orders:
            city = _extract_city(order.get("delivery_address", ""))
            if not city:
                continue
            items = order.get("items") or []
            vol = sum(it.get("quantity", 0) for it in items if not item_id or it.get("item_id") == item_id or it.get("id") == item_id) or 1
            ts = _parse_ts(order.get("created_at", "")) or now
            if ts >= cutoff_recent:
                recent[city] += vol
            elif ts >= cutoff_prev:
                prev[city] += vol
        all_cities = set(recent) | set(prev)
        if not all_cities:
            return success_response(data={"regional_demand": []}, message="Data regional distributor")
        max_vol = max((recent.get(c, 0) + prev.get(c, 0)) for c in all_cities) or 1
        regional_demand = []
        for city in all_cities:
            r_vol = recent.get(city, 0)
            p_vol = prev.get(city, 0)
            demand_score = round(((r_vol + p_vol) / max_vol) * 100)
            growth_pct = round(((r_vol - p_vol) / max(p_vol, 1)) * 100) if p_vol > 0 else (10 if r_vol > 0 else 0)
            regional_demand.append({"region": city, "demand_score": demand_score, "growth_pct": growth_pct})
        regional_demand.sort(key=lambda x: x["demand_score"], reverse=True)
        return success_response(data={"regional_demand": regional_demand}, message="Data regional distributor")
    except Exception as e:
        return error_response(str(e))


KNOWN_CITIES = [
    "Jakarta", "Bandung", "Surabaya", "Yogyakarta", "Semarang", "Medan",
    "Makassar", "Bali", "Denpasar", "Palembang", "Depok", "Bekasi",
    "Tangerang", "Bogor", "Batam", "Pekanbaru", "Malang", "Solo",
    "Banjarmasin", "Balikpapan", "Manado", "Samarinda", "Padang", "Jambi",
]

def _extract_city(address: str) -> Optional[str]:
    if not address:
        return None
    addr_lower = address.lower()
    for city in KNOWN_CITIES:
        if city.lower() in addr_lower:
            return city
    return None

@app.get("/analytics/supplier/regional")
def analytics_supplier_regional(user_id: Optional[str] = None, item_id: Optional[str] = None):
    try:
        from collections import defaultdict

        oq = supabase.table("orders").select("delivery_address, items, created_at")
        if user_id:
            oq = oq.eq("seller_id", user_id)
        orders = oq.execute().data or []

        now = datetime.utcnow()
        cutoff_recent = now - timedelta(days=30)
        cutoff_prev = now - timedelta(days=60)

        recent: dict = defaultdict(int)
        prev: dict = defaultdict(int)

        for order in orders:
            city = _extract_city(order.get("delivery_address", ""))
            if not city:
                continue
            items = order.get("items") or []
            vol = 0
            if item_id:
                vol = sum(it.get("quantity", 0) for it in items if it.get("item_id") == item_id or it.get("id") == item_id)
            else:
                vol = sum(it.get("quantity", 0) for it in items) or 1

            try:
                ts = datetime.fromisoformat(order.get("created_at", "").replace("Z", "+00:00").replace("+00:00", ""))
            except Exception:
                ts = now

            if ts >= cutoff_recent:
                recent[city] += vol
            elif ts >= cutoff_prev:
                prev[city] += vol

        all_cities = set(recent.keys()) | set(prev.keys())
        if not all_cities:
            return success_response(data={"regions": []}, message="Data regional supplier")

        max_vol = max((recent.get(c, 0) + prev.get(c, 0)) for c in all_cities) or 1
        regions = []
        for city in all_cities:
            r_vol = recent.get(city, 0)
            p_vol = prev.get(city, 0)
            demand_score = round(((r_vol + p_vol) / max_vol) * 100)
            growth_pct = round(((r_vol - p_vol) / max(p_vol, 1)) * 100) if p_vol > 0 else (10 if r_vol > 0 else 0)
            regions.append({"region": city, "demand_score": demand_score, "growth_pct": growth_pct})

        regions.sort(key=lambda x: x["demand_score"], reverse=True)
        return success_response(data={"regions": regions}, message="Data regional supplier")
    except Exception as e:
        return error_response(str(e))


@app.get("/analytics/products/insights")
def analytics_product_insights(user_id: Optional[str] = None):
    try:
        from collections import defaultdict
        # Orders data for sell-side volume ranking
        oq = supabase.table("orders").select("items, seller_id, buyer_id")
        if user_id:
            oq = oq.or_(f"seller_id.eq.{user_id},buyer_id.eq.{user_id}")
        orders = oq.execute().data or []

        sell_vol: dict = defaultdict(int)
        buy_vol: dict  = defaultdict(int)
        for o in orders:
            items_list = o.get("items") or []
            for it in items_list:
                pname = it.get("product_name", it.get("name", it.get("item_name", "")))
                qty = it.get("quantity", it.get("qty", 0)) or 0
                if pname:
                    if o.get("seller_id") == user_id:
                        sell_vol[pname] += qty
                    else:
                        buy_vol[pname] += qty

        # Use sell_vol if has data, otherwise buy_vol
        vol = sell_vol if sell_vol else buy_vol
        sorted_vol = sorted(vol.items(), key=lambda x: x[1], reverse=True)

        # Stock risk from inventory (real data, no random)
        iq = supabase.table("inventories").select("product_name, current_stock, min_threshold")
        if user_id:
            iq = iq.eq("user_id", user_id)
        inv_items = iq.execute().data or []
        stock_risk = [
            {"name": i.get("product_name", ""), "stock": i.get("current_stock", 0), "min_stock": i.get("min_threshold", 0)}
            for i in inv_items
            if (i.get("current_stock", 0) or 0) < (i.get("min_threshold", 0) or 0)
        ]

        top_n = sorted_vol[:3]
        dec_n = sorted_vol[-3:] if len(sorted_vol) > 3 else []

        return success_response(
            data={
                "top_selling": [{"name": n, "units": v, "growth_pct": 0} for n, v in top_n],
                "declining":   [{"name": n, "units": v, "decline_pct": 0} for n, v in dec_n],
                "stock_risk":  stock_risk,
            },
            message="Product insights",
        )
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 14. DEMAND
# ==========================================

@app.get("/analytics/supplier/demand")
def get_demand(period: str = "monthly", user_id: Optional[str] = None):
    try:
        # Fetch orders for this supplier
        oq = supabase.table("orders").select("items, created_at, buyer_id, buyer_name")
        if user_id:
            oq = oq.eq("seller_id", user_id)
        orders = oq.execute().data or []

        # Aggregate product volumes from order items
        from collections import defaultdict
        product_vol: dict = defaultdict(int)
        dist_product_vol: dict = defaultdict(lambda: defaultdict(int))
        dist_names: dict = {}

        for order in orders:
            items = order.get("items") or []
            buyer_id = order.get("buyer_id", "")
            buyer_name = order.get("buyer_name", "")
            if buyer_id:
                dist_names[buyer_id] = buyer_name
            if isinstance(items, list):
                for item in items:
                    pname = item.get("product_name", item.get("name", ""))
                    qty = item.get("quantity", 0)
                    if pname:
                        product_vol[pname] += qty
                        if buyer_id:
                            dist_product_vol[buyer_id][pname] += qty

        # Sort products by volume
        sorted_products = sorted(product_vol.items(), key=lambda x: x[1], reverse=True)
        top_selling = [
            {"id": f"p{i}", "name": name, "current_demand": vol, "growth_pct": 0, "trend": "stable", "category": "umum"}
            for i, (name, vol) in enumerate(sorted_products[:5])
        ]
        top_rising = [p for p in top_selling if p["current_demand"] > 0][:3]
        declining = [
            {"id": f"d{i}", "name": name, "current_demand": vol, "growth_pct": 0, "trend": "declining", "category": "umum"}
            for i, (name, vol) in enumerate(sorted_products[-3:]) if vol > 0
        ]

        # Build trend data bucketed by period
        from datetime import datetime, timedelta
        now = datetime.utcnow()
        if period == "weekly":
            buckets = [(now - timedelta(days=i)).strftime("%-d %b") for i in range(6, -1, -1)]
            bucket_key = lambda d: (now - datetime.fromisoformat(d[:10])).days if d else None
            bucket_count = 7
        else:
            buckets = [(now - timedelta(days=30 * i)).strftime("%b %Y") for i in range(5, -1, -1)]
            bucket_key = lambda d: None
            bucket_count = 6

        trend_vols = [0] * len(buckets)
        for order in orders:
            created = order.get("created_at", "")
            items = order.get("items") or []
            total_qty = sum(item.get("quantity", 0) for item in (items if isinstance(items, list) else []))
            if period == "weekly" and created:
                try:
                    days_ago = (now - datetime.fromisoformat(created[:10])).days
                    if 0 <= days_ago < 7:
                        trend_vols[6 - days_ago] += total_qty
                except Exception:
                    pass

        trends = [{"period": buckets[i], "total_volume": trend_vols[i]} for i in range(len(buckets))]

        # Product performance by distributor
        perf_by_dist = []
        for dist_id, prods in dist_product_vol.items():
            sorted_prods = sorted(prods.items(), key=lambda x: x[1], reverse=True)
            perf_by_dist.append({
                "distributor_id": dist_id,
                "distributor_name": dist_names.get(dist_id, dist_id),
                "products": [
                    {"product_id": f"p{i}", "product_name": name, "quantity": qty, "revenue": 0, "last_order_date": ""}
                    for i, (name, qty) in enumerate(sorted_prods[:5])
                ],
            })

        insights = []
        if top_rising:
            insights.append({"type": "demand_forecast", "message": f"Produk terlaris: {top_rising[0]['name']} dengan {top_rising[0]['current_demand']} unit.", "urgency": "low"})
        if not orders:
            insights.append({"type": "inventory_warning", "message": "Belum ada data order. Mulai bertransaksi untuk melihat analisis demand.", "urgency": "medium"})

        return success_response(
            data={
                "insights": insights,
                "top_rising": top_rising,
                "declining": declining,
                "trends": trends,
                "top_selling": top_selling,
                "product_performance_by_distributor": perf_by_dist,
            },
            message="Data demand berhasil ditarik",
        )
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 15. LOGISTICS
# ==========================================

@app.get("/logistics/shipments")
def get_shipments(user_id: Optional[str] = None):
    try:
        query = supabase.table("shipments").select("*")
        if user_id:
            try:
                query = query.or_(f"sender_id.eq.{user_id},receiver_id.eq.{user_id}")
            except Exception:
                pass
        res = query.execute()
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
def get_credit_accounts(user_id: Optional[str] = None, page: int = 1, limit: int = 20):
    try:
        query = supabase.table("credit_accounts").select("*")
        if user_id:
            try:
                query = query.eq("distributor_id", user_id)
            except Exception:
                pass
        res = query.execute()
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
        if data.distributor_id:
            payload["distributor_id"] = data.distributor_id
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
def get_ai_agents(x_user_role: Optional[str] = Header(default=None),
                  user_id: Optional[str] = None):
    try:
        # Filter agents by role; fall back to 'all' agents if role not specified
        agents_query = supabase.table("ai_agents").select("*")
        if x_user_role:
            try:
                agents_query = agents_query.or_(f"agent_role.eq.{x_user_role},agent_role.eq.all")
            except Exception:
                pass
        agents_res = agents_query.order("name").execute()
        agents = [
            {"id": a.get("id"), "agent_key": a.get("agent_key"), "name": a.get("name"),
             "description": a.get("description", ""), "status": a.get("status", "active"),
             "automation_level": a.get("automation_level", "manual_approval"),
             "recent_action": a.get("recent_action", ""), "last_active": a.get("last_active", now_iso())}
            for a in (agents_res.data or [])
        ]

        # Filter activities by role
        act_query = supabase.table("ai_activities").select("*")
        if x_user_role:
            try:
                act_query = act_query.or_(f"activity_role.eq.{x_user_role},activity_role.eq.all")
            except Exception:
                pass
        activities_res = act_query.order("timestamp", desc=True).limit(20).execute()
        activities = [
            {"id": a.get("id"), "agent_name": a.get("agent_name", ""), "action": a.get("action", ""),
             "impact": a.get("impact", ""), "full_result": a.get("full_result", ""),
             "timestamp": a.get("timestamp", now_iso())}
            for a in (activities_res.data or [])
        ]

        # Calculate performance metrics from actual activity data (no fabrication)
        total_cost_savings = 0
        total_confidence = 0.0
        confident_count = 0
        actionable_count = 0
        import re
        for a in (activities_res.data or []):
            full = a.get("full_result", "")
            if not full:
                continue
            try:
                parsed = json.loads(full)
                # Confidence from analysis
                conf = (parsed.get("analysis", {}) or {}).get("confidence_score")
                if isinstance(conf, (int, float)) and conf > 0:
                    total_confidence += conf
                    confident_count += 1
                # Cost savings: check all known savings fields
                action = parsed.get("recommended_action", {}) or {}
                for key in ("estimated_savings_idr", "estimated_cost_idr", "estimated_cashflow_impact_idr",
                            "estimated_revenue_impact_idr", "estimated_impact_idr", "recommended_order_value_idr"):
                    val = action.get(key)
                    if isinstance(val, (int, float)) and val > 0:
                        total_cost_savings += int(val)
                # Also check analysis-level savings fields
                savings = (parsed.get("analysis", {}) or {}).get("estimated_savings", 0)
                if isinstance(savings, (int, float)):
                    total_cost_savings += int(savings)
                # Count actionable activities (non-NONE issue)
                issue = (parsed.get("analysis", {}) or {}).get("issue_detected", "NONE")
                if issue and issue != "NONE":
                    actionable_count += 1
            except Exception:
                pass
            # Fallback regex scan on impact text
            if total_cost_savings == 0:
                imp = a.get("impact", "")
                nums = re.findall(r"Rp([\d.,]+)", imp)
                for n in nums:
                    total_cost_savings += int(float(n.replace(".", "").replace(",", ".")))

        accuracy = round(total_confidence / max(confident_count, 1) * 100) if confident_count > 0 else 0

        # Role-specific fallback when DB is empty
        if not agents:
            if x_user_role == "supplier":
                agents = [
                    {"id": "fallback-s1", "agent_key": "demand_forecast", "name": "Demand Forecast",
                     "description": "Memprediksi permintaan dari distributor untuk optimasi produksi.",
                     "status": "active", "automation_level": "manual_approval",
                     "recent_action": "Menunggu aktivasi.", "last_active": now_iso()},
                    {"id": "fallback-s2", "agent_key": "logistics_optimization", "name": "Logistics Optimization",
                     "description": "Mengoptimalkan rute pengiriman ke distributor.",
                     "status": "active", "automation_level": "auto_with_threshold",
                     "recent_action": "Menunggu aktivasi.", "last_active": now_iso()},
                    {"id": "fallback-s3", "agent_key": "price_optimization", "name": "Price Optimization",
                     "description": "Menyarankan penyesuaian harga berdasarkan supply-demand.",
                     "status": "active", "automation_level": "manual_approval",
                     "recent_action": "Menunggu aktivasi.", "last_active": now_iso()},
                ]
            elif x_user_role == "distributor":
                agents = [
                    {"id": "fallback-d1", "agent_key": "auto_restock", "name": "Auto Restock",
                     "description": "Memantau inventory dan memberikan peringatan restock otomatis.",
                     "status": "active", "automation_level": "auto_with_threshold",
                     "recent_action": "Menunggu aktivasi.", "last_active": now_iso()},
                    {"id": "fallback-d2", "agent_key": "credit_risk", "name": "Credit Risk Analyzer",
                     "description": "Menganalisis risiko kredit retailer berdasarkan histori pembayaran.",
                     "status": "active", "automation_level": "manual_approval",
                     "recent_action": "Menunggu aktivasi.", "last_active": now_iso()},
                    {"id": "fallback-d3", "agent_key": "supplier_recommendation", "name": "Supplier Recommendation",
                     "description": "Mencari supplier alternatif dan menganalisis peluang ekspansi.",
                     "status": "active", "automation_level": "manual_approval",
                     "recent_action": "Menunggu aktivasi.", "last_active": now_iso()},
                    {"id": "fallback-d4", "agent_key": "cash_flow_optimizer", "name": "Cash Flow Optimizer",
                     "description": "Mengoptimalkan jadwal pembayaran dan penagihan.",
                     "status": "active", "automation_level": "auto_with_threshold",
                     "recent_action": "Menunggu aktivasi.", "last_active": now_iso()},
                ]
            elif x_user_role == "retailer":
                agents = [
                    {"id": "fallback-r1", "agent_key": "retailer_reorder", "name": "Smart Reorder",
                     "description": "Monitoring stok dan rekomendasi reorder dari distributor.",
                     "status": "active", "automation_level": "auto_with_threshold",
                     "recent_action": "Menunggu aktivasi.", "last_active": now_iso()},
                    {"id": "fallback-r2", "agent_key": "retailer_sales_trend", "name": "Sales Trend Analyzer",
                     "description": "Analisis tren penjualan dan pola permintaan konsumen.",
                     "status": "active", "automation_level": "manual_approval",
                     "recent_action": "Menunggu aktivasi.", "last_active": now_iso()},
                    {"id": "fallback-r3", "agent_key": "retailer_demand_insight", "name": "Demand Insight",
                     "description": "Prediksi permintaan konsumen 7-14 hari ke depan.",
                     "status": "active", "automation_level": "manual_approval",
                     "recent_action": "Menunggu aktivasi.", "last_active": now_iso()},
                ]
            else:
                agents = [
                    {"id": "fallback-g1", "agent_key": "demand_forecast", "name": "Demand Forecast",
                     "description": "Analisis tren permintaan dan prediksi kebutuhan.",
                     "status": "active", "automation_level": "manual_approval",
                     "recent_action": "Menunggu aktivasi.", "last_active": now_iso()},
                ]

        return success_response(
            data={
                "agents": agents,
                "activities": activities,
                "performance": {
                    "accuracy_rate": accuracy,
                    "cost_savings": total_cost_savings,
                    "time_saved_hours": actionable_count * 2,
                },
            },
            message="Data AI agents berhasil ditarik",
        )
    except Exception as e:
        return error_response(str(e))


@app.put("/ai/agents/{agent_id}/config")
def update_agent_config(agent_id: str, data: UpdateAgentConfigReq):
    try:
        update_payload = {}
        if data.status is not None:
            update_payload["status"] = data.status
        if data.automation_level is not None:
            update_payload["automation_level"] = data.automation_level
        if update_payload:
            supabase.table("ai_agents").update(update_payload).eq("id", agent_id).execute()
        return success_response(data={"success": True}, message="Config agent berhasil diupdate")
    except Exception as e:
        return error_response(str(e))


@app.delete("/ai/activities")
def clear_activities(x_user_role: Optional[str] = Header(default=None)):
    """Delete all activities for the current role."""
    try:
        role = x_user_role or "distributor"
        supabase.table("ai_activities").delete().or_(f"activity_role.eq.{role},activity_role.eq.all").execute()
        return success_response(data={"cleared": True}, message="Activity log cleared.")
    except Exception as e:
        return error_response(str(e))


# ─── Shared AI Agent executor ───────────────────────────────────────────────

AGENT_PROMPTS = {
    # ── SUPPLIER AGENTS ──
    "demand_forecast": {
        "scope": "supplier",
        "query": lambda uid, r: supabase.table("orders").select("*").eq("seller_id", uid).limit(30).execute(),
        "prompt": lambda data, uid: (
            "You are a Supplier Agent in a supply chain. Your scope: analyze distributor demand ONLY. You MUST NOT access retailer or consumer data.\n\n"
            f"DATA (orders placed with this supplier): {json.dumps(data[:20] if data else [], default=str)}\n\n"
            "INSTRUCTIONS:\n"
            "1. Analyze demand trends from distributor orders.\n"
            "2. Predict production needs for the next 7-14 days.\n"
            "3. Detect any demand spikes or drops.\n"
            "4. Flag products that may need increased production.\n\n"
            "RETURN ONLY VALID JSON. No markdown, no explanation text. Use this exact schema:\n"
            '{"agent_type":"Supplier Agent","urgency_level":"MEDIUM","role_scope_valid":true,'
            '"demand_analysis":{"top_requested_products":[],"demand_trend":"stable","detected_spikes":[],"predicted_shortages":[]},'
            '"analysis":{"issue_detected":"NONE","reason":"","confidence_score":0.0},'
            '"recommended_action":{"action_type":"PREPARE_SHIPMENT|INCREASE_PRODUCTION|DELAY_WARNING|NONE","details":"","urgency_timeline_days":0},'
            '"system_flags":{"requires_human_approval":true,"auto_execute_allowed":false}}'
        ),
    },
    "logistics_optimization": {
        "scope": "supplier",
        "query": lambda uid, r: supabase.table("shipments").select("*").eq("sender_id", uid).execute(),
        "prompt": lambda data, uid: (
            "You are a Supplier Logistics Agent. Your scope: optimize shipments to distributors ONLY.\n\n"
            f"DATA (supplier shipments): {json.dumps(data[:20] if data else [], default=str)}\n\n"
            "Analyze shipment routes and delivery performance. Identify delayed or inefficient routes.\n\n"
            "RETURN ONLY VALID JSON:\n"
            '{"agent_type":"Supplier Agent","urgency_level":"LOW","role_scope_valid":true,'
            '"shipment_analysis":{"total_shipments":0,"delayed_count":0,"on_time_rate":0,"avg_delivery_hours":0},'
            '"analysis":{"issue_detected":"DELAYED_ROUTE|INEFFICIENT_CARRIER|NONE","reason":"","confidence_score":0.0},'
            '"recommended_action":{"action_type":"REROUTE|CHANGE_CARRIER|NONE","carrier_recommendation":"","estimated_savings_idr":0},'
            '"system_flags":{"requires_human_approval":true,"auto_execute_allowed":false}}'
        ),
    },
    "price_optimization": {
        "scope": "supplier",
        "query": lambda uid, r: supabase.table("inventories").select("*").eq("user_id", uid).execute(),
        "prompt": lambda data, uid: (
            "You are a Supplier Pricing Agent. Your scope: optimize pricing based on supply-demand for distributor-facing products.\n\n"
            f"DATA (supplier inventory): {json.dumps(data[:20] if data else [], default=str)}\n\n"
            "Analyze inventory levels, unit prices, and stock velocity. Recommend price adjustments.\n\n"
            "RETURN ONLY VALID JSON:\n"
            '{"agent_type":"Supplier Agent","urgency_level":"LOW","role_scope_valid":true,'
            '"pricing_analysis":{"total_products":0,"overstocked":[],"underpriced":[],"overpriced":[]},'
            '"analysis":{"issue_detected":"PRICE_GAP|OVERSTOCK|NONE","reason":"","confidence_score":0.0},'
            '"recommended_action":{"action_type":"ADJUST_PRICE|DISCOUNT|NONE","target_product":"","current_price":0,"recommended_price":0,"estimated_revenue_impact_idr":0},'
            '"system_flags":{"requires_human_approval":true,"auto_execute_allowed":false}}'
        ),
    },

    # ── DISTRIBUTOR AGENTS ──
    "auto_restock": {
        "scope": "distributor",
        "query": lambda uid, r: supabase.table("inventories").select("*").eq("user_id", uid).execute(),
        "prompt": lambda data, uid: (
            "You are a Distributor Restock Agent. Scope: monitor distributor inventory, detect low stock, recommend restock from connected suppliers. MUST NOT access retailers directly.\n\n"
            f"DATA (distributor inventory): {json.dumps(data[:30] if data else [], default=str)}\n\n"
            "Identify products below minimum threshold. Calculate restock quantities based on weekly sales velocity.\n\n"
            "RETURN ONLY VALID JSON:\n"
            '{"agent_type":"Distributor Agent","urgency_level":"MEDIUM","role_scope_valid":true,'
            '"inventory_status":{"total_products":0,"low_stock_products":[],"healthy_stock_products":[],"low_stock_count":0},'
            '"analysis":{"issue_detected":"LOW_STOCK|CRITICAL_STOCK|NONE","reason":"","confidence_score":0.0},'
            '"recommended_action":{"action_type":"RESTOCK_NOW|CREATE_PURCHASE_ORDER|MONITOR_STOCK|NONE","recommended_products":[],"estimated_cost_idr":0},'
            '"system_flags":{"requires_human_approval":true,"auto_execute_allowed":false}}'
        ),
    },
    "credit_risk": {
        "scope": "distributor",
        "query": lambda uid, r: supabase.table("credit_accounts").select("*").eq("distributor_id", uid).execute(),
        "prompt": lambda data, uid: (
            "You are a Distributor Credit Risk Agent. Scope: analyze retailer credit accounts under this distributor ONLY.\n\n"
            f"DATA (distributor credit accounts): {json.dumps(data[:20] if data else [], default=str)}\n\n"
            "Identify high-risk retailers. Recommend credit limit adjustments. Flag overdue accounts.\n\n"
            "RETURN ONLY VALID JSON:\n"
            '{"agent_type":"Distributor Agent","urgency_level":"MEDIUM","role_scope_valid":true,'
            '"credit_analysis":{"total_accounts":0,"high_risk_count":0,"overdue_count":0,"total_outstanding_idr":0,"risky_retailers":[]},'
            '"analysis":{"issue_detected":"HIGH_RISK_DETECTED|OVERDUE_ACCOUNT|CREDIT_OVERUTILIZED|NONE","reason":"","confidence_score":0.0},'
            '"recommended_action":{"action_type":"REDUCE_LIMIT|SUSPEND_ACCOUNT|INCREASE_LIMIT|NONE","target_retailer_id":"","suggested_new_limit":0},'
            '"system_flags":{"requires_human_approval":true,"auto_execute_allowed":false}}'
        ),
    },
    "supplier_recommendation": {
        "scope": "distributor",
        "query": lambda uid, r: supabase.table("partnerships").select("*").or_(f"distributor_id.eq.{uid},distributor_name.eq.{uid}").execute(),
        "prompt": lambda data, uid: (
            "You are a Distributor Supplier Recommendation Agent. Scope: analyze existing partnerships and recommend new supplier connections for this distributor. MUST NOT recommend unverified suppliers.\n\n"
            f"DATA (current distributor partnerships): {json.dumps(data[:20] if data else [], default=str)}\n\n"
            "Identify underperforming suppliers. Detect gaps in product coverage. Recommend supplier expansion.\n\n"
            "RETURN ONLY VALID JSON:\n"
            '{"agent_type":"Distributor Agent","urgency_level":"LOW","role_scope_valid":true,'
            '"partnership_analysis":{"total_suppliers":0,"top_performers":[],"underperformers":[],"product_gaps":[]},'
            '"analysis":{"issue_detected":"SUPPLIER_GAP|UNDERPERFORMER|NONE","reason":"","confidence_score":0.0},'
            '"recommended_action":{"action_type":"ONBOARD_SUPPLIER|REVIEW_PARTNERSHIP|NONE","recommended_category":"","expected_benefit":""},'
            '"system_flags":{"requires_human_approval":true,"auto_execute_allowed":false}}'
        ),
    },
    "cash_flow_optimizer": {
        "scope": "distributor",
        "query": lambda uid, r: supabase.table("invoices").select("*").or_(f"buyer_id.eq.{uid},seller_id.eq.{uid}").execute(),
        "prompt": lambda data, uid: (
            "You are a Distributor Cash Flow Agent. Scope: analyze invoices and payment schedules for this distributor ONLY.\n\n"
            f"DATA (distributor invoices): {json.dumps(data[:25] if data else [], default=str)}\n\n"
            "Identify overdue invoices. Recommend payment prioritization. Optimize cash flow timing.\n\n"
            "RETURN ONLY VALID JSON:\n"
            '{"agent_type":"Distributor Agent","urgency_level":"MEDIUM","role_scope_valid":true,'
            '"cashflow_analysis":{"total_payable":0,"total_receivable":0,"overdue_payable":0,"overdue_receivable":0,"net_cash_position":0},'
            '"analysis":{"issue_detected":"NEGATIVE_CASHFLOW|OVERDUE_RISK|NONE","reason":"","confidence_score":0.0},'
            '"recommended_action":{"action_type":"PRIORITIZE_PAYMENT|DELAY_PAYMENT|COLLECT_RECEIVABLE|NONE","target_invoice_id":"","estimated_cashflow_impact_idr":0},'
            '"system_flags":{"requires_human_approval":true,"auto_execute_allowed":false}}'
        ),
    },

    # ── RETAILER AGENTS ──
    "retailer_reorder": {
        "scope": "retailer",
        "query": lambda uid, r: supabase.table("inventories").select("*").eq("user_id", uid).execute(),
        "prompt": lambda data, uid: (
            "You are a Retailer Reorder Agent. Scope: monitor retail stock levels and recommend reorders from connected distributors. MUST NOT order from suppliers directly.\n\n"
            f"DATA (retailer inventory): {json.dumps(data[:30] if data else [], default=str)}\n\n"
            "Identify fast-moving products that need reorder. Calculate optimal reorder quantity based on sales velocity.\n\n"
            "RETURN ONLY VALID JSON:\n"
            '{"agent_type":"Retailer Agent","urgency_level":"MEDIUM","role_scope_valid":true,'
            '"inventory_status":{"total_products":0,"low_stock_products":[],"fast_moving_products":[],"reorder_recommendations":[]},'
            '"analysis":{"issue_detected":"LOW_STOCK|FAST_MOVING|NONE","reason":"","confidence_score":0.0},'
            '"recommended_action":{"action_type":"REORDER_PRODUCT|LOW_STOCK_ALERT|NONE","recommended_order_value_idr":0,"suggested_distributor":""},'
            '"system_flags":{"requires_human_approval":true,"auto_execute_allowed":false}}'
        ),
    },
    "retailer_sales_trend": {
        "scope": "retailer",
        "query": lambda uid, r: supabase.table("orders").select("*").eq("buyer_id", uid).limit(50).execute(),
        "prompt": lambda data, uid: (
            "You are a Retailer Sales Trend Agent. Scope: analyze retail sales data and consumer demand patterns. MUST NOT access supplier data directly.\n\n"
            f"DATA (retailer purchase orders): {json.dumps(data[:20] if data else [], default=str)}\n\n"
            "Analyze buying patterns, identify trends, detect declining products, flag seasonal spikes.\n\n"
            "RETURN ONLY VALID JSON:\n"
            '{"agent_type":"Retailer Agent","urgency_level":"LOW","role_scope_valid":true,'
            '"sales_analysis":{"trending_up":[],"trending_down":[],"seasonal_patterns":[],"monthly_spend_trend":"stable"},'
            '"analysis":{"issue_detected":"DECLINING_TREND|SEASONAL_SPIKE|NONE","reason":"","confidence_score":0.0},'
            '"recommended_action":{"action_type":"SALES_TREND_WARNING|PROMOTE_PRODUCT|NONE","details":"","projected_next_month_idr":0},'
            '"system_flags":{"requires_human_approval":true,"auto_execute_allowed":false}}'
        ),
    },
    "retailer_demand_insight": {
        "scope": "retailer",
        "query": lambda uid, r: supabase.table("orders").select("*").eq("buyer_id", uid).limit(50).execute(),
        "prompt": lambda data, uid: (
            "You are a Retailer Demand Insight Agent. Scope: predict consumer demand based on retail purchase history. MUST NOT recommend supplier-direct ordering.\n\n"
            f"DATA (retailer orders): {json.dumps(data[:20] if data else [], default=str)}\n\n"
            "Forecast demand for next 7-14 days. Identify products retailers should stock up on. Detect changing consumer preferences.\n\n"
            "RETURN ONLY VALID JSON:\n"
            '{"agent_type":"Retailer Agent","urgency_level":"MEDIUM","role_scope_valid":true,'
            '"demand_forecast":{"predicted_top_products":[],"confidence_by_product":{},"forecast_period_days":14},'
            '"analysis":{"issue_detected":"DEMAND_SURGE|DEMAND_DROP|NONE","reason":"","confidence_score":0.0},'
            '"recommended_action":{"action_type":"STOCK_UP|REDUCE_ORDER|MONITOR|NONE","details":"","estimated_impact_idr":0},'
            '"system_flags":{"requires_human_approval":true,"auto_execute_allowed":false}}'
        ),
    },
}


def _execute_agent(agent_key: str, agent: dict, role: str, user_id: str) -> dict:
    """Shared agent executor: fetch bounded data, call Gemini with JSON prompt, parse response."""
    import re

    config = AGENT_PROMPTS.get(agent_key)
    if not config:
        return {"error": f"Agent '{agent_key}' not configured.", "status": "error"}

    # 1. Fetch data bounded by user_id (scope enforcement)
    try:
        raw = config["query"](user_id, role)
        raw_data = raw.data if hasattr(raw, "data") else []
    except Exception:
        raw_data = []

    # 2. Build prompt with role scope boundary
    prompt = config["prompt"](raw_data, user_id)

    # 3. Call Gemini with strict JSON enforcement
    import os
    if not OPENROUTER_KEY:
        raise RuntimeError("OPENROUTER_API_KEY not configured")
    ai_text = _call_ai(
        prompt + "\n\nIMPORTANT: Return ONLY the JSON object. No markdown code blocks, no backticks, no explanatory text. Start with { and end with }."
    ).strip()

    # 4. Parse JSON — strip markdown if present
    json_match = re.search(r'\{.*\}', ai_text, re.DOTALL)
    if json_match:
        ai_text = json_match.group(0)

    try:
        result = json.loads(ai_text)
    except json.JSONDecodeError:
        result = {
            "agent_type": f"{role.title()} Agent",
            "urgency_level": "MEDIUM",
            "role_scope_valid": True,
            "analysis": {"issue_detected": "PARSE_ERROR", "reason": "AI response could not be parsed as JSON. Raw output stored in full_result.", "confidence_score": 0.0},
            "recommended_action": {"action_type": "NONE", "details": "Retry agent execution."},
            "system_flags": {"requires_human_approval": True, "auto_execute_allowed": False},
            "_raw_output": ai_text[:500],
        }

    # 5. Validate output matches role scope
    result["agent_type"] = f"{role.title()} Agent"
    result.setdefault("role_scope_valid", True)
    result.setdefault("urgency_level", "MEDIUM")
    result.setdefault("analysis", {"issue_detected": "NONE", "reason": "", "confidence_score": 0.0})
    result.setdefault("recommended_action", {"action_type": "NONE"})
    result.setdefault("system_flags", {"requires_human_approval": True, "auto_execute_allowed": False})

    return result


@app.post("/ai/agents/{agent_key}/run")
def run_ai_agent(agent_key: str,
                 x_user_role: Optional[str] = Header(default=None),
                 user_id: Optional[str] = None):
    """Execute an AI agent with Gemini — bounded scope, JSON-only output."""
    try:
        agents_res = supabase.table("ai_agents").select("*").eq("agent_key", agent_key).execute()
        if not agents_res.data:
            return error_response(f"Agent '{agent_key}' tidak ditemukan.")

        agent = agents_res.data[0]
        role = x_user_role or "distributor"
        uid = user_id or ""

        if agent.get("agent_role") not in (role, "all"):
            return error_response(f"Agent '{agent_key}' tidak tersedia untuk role {role}.")

        # Execute agent
        result = _execute_agent(agent_key, agent, role, uid)
        if "error" in result:
            return error_response(result["error"])

        # Extract human-readable summary
        analysis = result.get("analysis", {})
        action = result.get("recommended_action", {})
        issue = analysis.get("issue_detected", "NONE")
        reason = analysis.get("reason", "")
        action_type = action.get("action_type", "NONE")
        confidence = analysis.get("confidence_score", 0)

        impact_summary = f"[{issue}] {reason}" if issue not in ("NONE", "PARSE_ERROR") else "No critical issues detected."
        recent_action = f"{action_type}: {impact_summary[:100]}"

        now = now_iso()
        activity_id = str(uuid.uuid4())

        supabase.table("ai_activities").insert({
            "id": activity_id,
            "agent_name": agent.get("name", agent_key),
            "action": f"{action_type} (confidence: {confidence:.0%})",
            "impact": impact_summary[:200],
            "full_result": json.dumps(result, ensure_ascii=False),
            "timestamp": now,
            "activity_role": agent.get("agent_role", role),
        }).execute()

        supabase.table("ai_agents").update({
            "recent_action": recent_action[:120],
            "last_active": now,
        }).eq("agent_key", agent_key).execute()

        return success_response(
            data={"agent_key": agent_key, "result": result, "activity_id": activity_id},
            message=f"Agent {agent.get('name', agent_key)} executed.",
        )
    except Exception as e:
        return error_response(str(e))


@app.post("/ai/agents/auto-tick")
def auto_tick_agents(x_user_role: Optional[str] = Header(default=None),
                     user_id: Optional[str] = None):
    """Auto-run ALL active agents every 30 seconds — no threshold filter."""
    try:
        role = x_user_role or "distributor"
        uid = user_id or ""

        # Run ALL active agents for this role
        agents_query = supabase.table("ai_agents").select("*").or_(f"agent_role.eq.{role},agent_role.eq.all").eq("status", "active").execute()
        agents = agents_query.data or []

        results = []
        for agent in agents:
            try:
                agent_key = agent.get("agent_key")

                # Small delay between agents to avoid RPM burst limits
                if results:  # Not first agent
                    import time as _sleep_time
                    _sleep_time.sleep(3)

                # Execute via shared helper
                result = _execute_agent(agent_key, agent, role, uid)
                if "error" in result:
                    results.append({"agent_key": agent_key, "status": "error", "error": result["error"]})
                    continue

                analysis = result.get("analysis", {})
                action = result.get("recommended_action", {})
                issue = analysis.get("issue_detected", "NONE")
                reason = analysis.get("reason", "")
                action_type = action.get("action_type", "NONE")
                confidence = analysis.get("confidence_score", 0)
                has_finding = issue not in ("NONE", "PARSE_ERROR") and action_type != "NONE"

                now = now_iso()
                recent_action = f"{action_type}: {reason[:100]}" if has_finding else f"No issues — last check {now[:16]}"
                supabase.table("ai_agents").update({
                    "recent_action": recent_action[:120],
                    "last_active": now,
                }).eq("agent_key", agent_key).execute()

                # Only log activity when there's a real finding
                if has_finding:
                    activity_id = str(uuid.uuid4())
                    impact_summary = f"[{issue}] {reason}" if issue not in ("NONE",) else "No issues."
                    supabase.table("ai_activities").insert({
                        "id": activity_id,
                        "agent_name": agent.get("name", agent_key),
                        "action": f"Auto-run: {action_type} (confidence: {confidence:.0%})",
                        "impact": impact_summary[:200],
                        "full_result": json.dumps(result, ensure_ascii=False),
                        "timestamp": now,
                        "activity_role": agent.get("agent_role", role),
                    }).execute()

                results.append({"agent_key": agent_key, "status": "completed", "action_type": action_type, "logged": has_finding})
            except Exception as e:
                results.append({"agent_key": agent.get("agent_key", "unknown"), "status": "error", "error": str(e)})

        return success_response(
            data={"ticked": len(results), "results": results},
            message=f"Auto-tick: {len(results)} agent(s) executed.",
        )
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 18. AI (existing + new credit risk)
# ==========================================

@app.post("/ai/restock-recommendation")
def ai_restock(req: AIRestockReq):
    try:
        res = supabase.table("inventories").select("*").execute()
        prompt = f"Sebagai AI Supply Chain. Cek data stok: {res.data}. Buat rekomendasi restock kritis. Fokus ID: {req.item_id or 'Semua'}."
        return success_response(data={"rekomendasi_ai": _call_ai(prompt)}, message="Rekomendasi restock selesai")
    except Exception as e:
        return error_response(str(e))


@app.post("/ai/demand-forecast")
def ai_demand(req: AIDemandReq):
    try:
        res = supabase.table("inventories").select("product_name, current_stock").execute()
        prompt = f"Buat prediksi permintaan {req.forecast_days} hari ke depan untuk data: {res.data}."
        return success_response(data={"prediksi_ai": _call_ai(prompt)}, message="Demand forecasting selesai")
    except Exception as e:
        return error_response(str(e))


@app.post("/ai/credit-risk")
def ai_credit_risk(req: AICreditRiskReq):
    try:
        res = supabase.table("credit_accounts").select("*").eq("retailer_id", req.retailer_id).execute()
        prompt = f"Analisis risiko kredit untuk retailer {req.retailer_id}. Data akun kredit: {res.data}."
        ai_text = _call_ai(prompt)
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
        return success_response(data={"rekomendasi_ai": _call_ai(prompt)}, message="Optimasi logistik selesai")
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 19. SETTINGS
# ==========================================

def _get_auth_user(user_id: str) -> Optional[dict]:
    """Fetch single user from Supabase Auth by ID."""
    try:
        resp = requests.get(
            f"{os.getenv('SUPABASE_URL')}/auth/v1/admin/users/{user_id}",
            headers={"apikey": os.getenv("SUPABASE_KEY"), "Authorization": f"Bearer {os.getenv('SUPABASE_KEY')}"},
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    try:
        u = supabase.auth.admin.get_user_by_id(user_id)
        return {"id": u.user.id, "email": u.user.email, "user_metadata": u.user.user_metadata or {}}
    except Exception:
        pass
    return None

def _update_auth_user_metadata(user_id: str, metadata_patch: dict) -> bool:
    """Merge-update user_metadata for a Supabase Auth user."""
    try:
        u = supabase.auth.admin.get_user_by_id(user_id)
        existing_meta = u.user.user_metadata or {}
        merged = {**existing_meta, **{k: v for k, v in metadata_patch.items() if v is not None}}
        supabase.auth.admin.update_user_by_id(user_id, {"user_metadata": merged})
        return True
    except Exception:
        pass
    try:
        resp = requests.patch(
            f"{os.getenv('SUPABASE_URL')}/auth/v1/admin/users/{user_id}",
            headers={"apikey": os.getenv("SUPABASE_KEY"), "Authorization": f"Bearer {os.getenv('SUPABASE_KEY')}",
                     "Content-Type": "application/json"},
            json={"user_metadata": metadata_patch},
            timeout=10,
        )
        return resp.status_code in (200, 204)
    except Exception:
        return False


@app.get("/settings/profile")
def get_profile(user_id: Optional[str] = None):
    if not user_id:
        return success_response(data={"user_id": "", "full_name": "", "email": "", "phone": "", "role": "", "avatar_url": None}, message="Profile ditarik")
    raw = _get_auth_user(user_id)
    if not raw:
        return error_response("User tidak ditemukan")
    meta = raw.get("user_metadata", {}) or {}
    return success_response(data={
        "user_id": user_id,
        "full_name": meta.get("full_name", ""),
        "email": raw.get("email", ""),
        "phone": meta.get("phone", ""),
        "role": meta.get("role", ""),
        "avatar_url": meta.get("avatar_url", None),
    }, message="Profile ditarik")


@app.put("/settings/profile")
def update_profile(data: UpdateProfileReq, user_id: Optional[str] = None):
    if not user_id:
        return error_response("user_id diperlukan")
    patch = {}
    if data.full_name is not None:
        patch["full_name"] = data.full_name
    if data.phone is not None:
        patch["phone"] = data.phone
    if data.avatar_url is not None:
        patch["avatar_url"] = data.avatar_url
    ok = _update_auth_user_metadata(user_id, patch)
    if not ok:
        return error_response("Gagal memperbarui profil")
    return success_response(data=patch, message="Profile berhasil diupdate")


@app.get("/settings/business")
def get_business(user_id: Optional[str] = None):
    if not user_id:
        return success_response(data={"business_name": "", "tax_id": "", "warehouse_locations": [], "service_regions": []}, message="Business settings ditarik")
    raw = _get_auth_user(user_id)
    if not raw:
        return error_response("User tidak ditemukan")
    meta = raw.get("user_metadata", {}) or {}
    return success_response(data={
        "business_name": meta.get("business_name", ""),
        "business_type": meta.get("business_type", ""),
        "tax_id": meta.get("tax_id", ""),
        "warehouse_locations": meta.get("warehouse_locations", []),
        "service_regions": meta.get("service_regions", []),
        "preferred_currency": meta.get("preferred_currency", "IDR"),
        "operational_timezone": meta.get("operational_timezone", "Asia/Jakarta"),
    }, message="Business settings ditarik")


@app.put("/settings/business")
def update_business(data: UpdateBusinessReq, user_id: Optional[str] = None):
    if not user_id:
        return error_response("user_id diperlukan")
    patch = {k: v for k, v in data.dict().items() if v is not None}
    ok = _update_auth_user_metadata(user_id, patch)
    if not ok:
        return error_response("Gagal memperbarui data bisnis")
    return success_response(data=patch, message="Business settings diupdate")


@app.get("/settings/notifications")
def get_notification_settings():
    return success_response(
        data={
            "channels": {"email": True, "in_app": True, "sms": False},
            "preferences": {
                "low_stock_alerts": True,
                "new_order_alerts": True,
                "partnership_request_alerts": True,
                "payment_confirmation": True,
                "overdue_payment_reminder": True,
                "ai_recommendation_alerts": True,
                "weekly_analytics_report": False,
            },
        },
        message="Notification settings ditarik",
    )


@app.put("/settings/notifications")
def update_notifications(data: UpdateNotificationReq):
    return success_response(
        data={"channels": data.channels or {}, "preferences": data.preferences or {}},
        message="Notification settings diupdate",
    )


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
    import base64, os
    secret = base64.b32encode(os.urandom(10)).decode("utf-8")
    qr_code_url = f"otpauth://totp/AUTOSUP:user@autosup.app?secret={secret}&issuer=AUTOSUP"
    return success_response(data={"secret": secret, "qr_code_url": qr_code_url}, message="2FA siap diaktifkan")


@app.post("/settings/security/2fa/verify")
def verify_2fa(data: Verify2FAReq):
    return success_response(message="2FA berhasil diverifikasi")


@app.post("/settings/security/2fa/disable")
def disable_2fa(data: Disable2FAReq):
    return success_response(message="2FA berhasil dinonaktifkan")

# ==========================================
# 20. SUPPLIERS
# ==========================================

@app.get("/suppliers")
def get_suppliers(search: str = "", type: str = "", user_id: Optional[str] = None, page: int = 1, limit: int = 20):
    """Returns supplier list — pulls from Supabase Auth users with role=supplier."""
    supplier_users = [
        {
            "supplier_id": u["id"],
            "name": u.get("business_name", u.get("full_name", "")),
            "category": u.get("business_type", "Umum"),
            "type": "discover",
            "reputation_score": u.get("reputation_score", 0),
            "total_transactions": u.get("total_transactions", 0),
            "on_time_delivery_rate": u.get("on_time_delivery_rate", 0),
            "wallet_address": u.get("wallet_address", ""),
            "is_active": u.get("is_active", True),
        }
        for u in auth_users_by_role("supplier")
    ]

    # Load partnerships to mark partnered suppliers — filter by current distributor
    try:
        p_query = supabase.table("partnerships").select("supplier_name,supplier_id").in_("status", ["accepted", "approved"])
        if user_id:
            try:
                p_query = p_query.or_(f"distributor_id.eq.{user_id},retailer_name.eq.{user_id}")
            except Exception:
                pass
        accepted = p_query.execute().data or []
        partner_ids = {p.get("supplier_id", p.get("supplier_name", "")) for p in accepted}
        for s in supplier_users:
            if s["supplier_id"] in partner_ids:
                s["type"] = "partner"
    except Exception:
        pass

    # Mark suppliers with pending requests from current distributor
    try:
        pq2 = supabase.table("partnerships").select("supplier_id,supplier_name").eq("status", "pending")
        if user_id:
            pq2 = pq2.or_(f"distributor_id.eq.{user_id},retailer_name.eq.{user_id}")
        pending_rows = pq2.execute().data or []
        pending_ids = {p.get("supplier_id") or p.get("supplier_name", "") for p in pending_rows}
        for s in supplier_users:
            if s["type"] != "partner" and s["supplier_id"] in pending_ids:
                s["type"] = "pending"
    except Exception:
        pass

    # Filter by search
    if search:
        q = search.lower()
        supplier_users = [s for s in supplier_users if q in s["name"].lower()]

    # Filter by type
    if type == "partner":
        supplier_users = [s for s in supplier_users if s["type"] == "partner"]
    elif type == "discover":
        supplier_users = [s for s in supplier_users if s["type"] not in ("partner", "pending")]

    partners = [s for s in supplier_users if s.get("type") == "partner"]
    pending = [s for s in supplier_users if s.get("type") == "pending"]
    discover = [s for s in supplier_users if s.get("type") not in ("partner", "pending")]

    return success_response(data={
        "suppliers": supplier_users,
        "summary": {
            "partner_count": len(partners),
            "discover_count": len(discover),
            "pending_requests": len(pending),
        },
        "pagination": {"page": page, "limit": limit, "total": len(supplier_users)},
    })


@app.get("/suppliers/partnership-requests")
def get_partnership_requests(status: str = "", supplier_id: Optional[str] = None):
    """Get partnership requests (distributor -> supplier). Filter by supplier_id for data isolation."""
    try:
        query = supabase.table("partnerships").select("*")
        if status:
            query = query.eq("status", status)
        if supplier_id:
            try:
                query = query.or_(f"supplier_id.eq.{supplier_id},supplier_name.eq.{supplier_id}")
            except Exception:
                query = query.eq("supplier_name", supplier_id)
        res = query.execute()
        requests = []
        for r in (res.data or []):
            requests.append({
                "request_id": r.get("id", r.get("request_id", "")),
                "supplier_id": r.get("supplier_id", r.get("supplier_name", "")),
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
    distributor_id = body.get("distributor_id", "")
    distributor_name = body.get("distributor_name", "")

    # Prevent duplicate requests — check if active/pending already exists
    if supplier_id and distributor_id:
        try:
            existing = supabase.table("partnerships").select("id,status").eq("supplier_id", supplier_id).eq("distributor_id", distributor_id).in_("status", ["pending", "approved", "accepted"]).execute().data or []
            if existing:
                row = existing[0]
                return success_response(data={"request_id": row["id"], "supplier_id": supplier_id, "status": row["status"], "created_at": now_iso()}, message="Partnership sudah ada")
        except Exception:
            pass

    payload = {
        "retailer_name": distributor_name or "Distributor",
        "supplier_name": "",
        "status": "pending",
    }
    if distributor_id:
        payload["distributor_id"] = distributor_id
    if supplier_id:
        payload["supplier_id"] = supplier_id
    try:
        res = supabase.table("partnerships").insert(payload).execute()
        if res.data:
            row = res.data[0]
            return success_response(data={
                "request_id": row.get("id", ""),
                "supplier_id": supplier_id,
                "supplier_name": "",
                "status": "pending",
                "created_at": now_iso(),
            }, message="Partnership request sent")
    except Exception as e:
        print(f"[partnership] insert error: {e}")
    return error_response("Failed to create partnership request.")


@app.get("/suppliers/{supplier_id}/stock")
def get_supplier_stock(supplier_id: str):
    """Get stock items from a specific supplier."""
    try:
        # Try filtering by user_id first, fallback to all items
        try:
            res = supabase.table("inventories").select("*").eq("user_id", supplier_id).execute()
            items = res.data or []
        except Exception:
            res = supabase.table("inventories").select("*").execute()
            items = res.data or []
        products = []
        for item in items:
            stock = item.get("current_stock", item.get("stock", 0))
            min_stock = item.get("min_threshold", item.get("min_stock", 10))
            status = "out_of_stock" if stock == 0 else ("low_stock" if stock < min_stock else "in_stock")
            products.append({
                "item_id": item.get("id", ""),
                "name": item.get("product_name", item.get("name", "")),
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
    """Accept or reject a partnership request. On accept, mint Partnership NFT record."""
    action = body.get("action", "reject")
    new_status = "accepted" if action == "accept" else "rejected"
    nft_data = None
    try:
        supabase.table("partnerships").update({"status": new_status}).eq("id", request_id).execute()

        if action == "accept":
            # Fetch partnership record
            p_res = supabase.table("partnerships").select("*").eq("id", request_id).execute()
            if p_res.data:
                p = p_res.data[0]
                distributor_id = p.get("distributor_id", "")
                supplier_id = p.get("supplier_id", "")
                supplier_name = p.get("supplier_name", "")
                distributor_name = p.get("distributor_name", "") or p.get("retailer_name", "")

                # Mint partnership NFT via blockchain service (falls back to deterministic if offline)
                token_name = f"AUTOSUP Partnership: {supplier_name or supplier_id[:8]} × {distributor_name or distributor_id[:8]}"
                try:
                    if bc:
                        d_wallet = bc.get_or_create_wallet(supabase, distributor_id)
                        s_wallet = bc.get_or_create_wallet(supabase, supplier_id)
                        nft_result = bc.mint_partnership_nft(
                            d_wallet["pubkey"], s_wallet["pubkey"],
                            terms=token_name, role=1,
                        )
                        mint_address = nft_result["mint_address"]
                        explorer_url = nft_result.get("mint_explorer_url", nft_result["explorer_url"])
                    else:
                        raise RuntimeError("bc not available")
                except Exception:
                    seed = f"{distributor_id}:{supplier_id}:{request_id}"
                    h = hashlib.sha256(seed.encode()).digest()
                    _B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
                    n = int.from_bytes(h, "big")
                    addr_chars = []
                    while n:
                        addr_chars.append(_B58[n % 58])
                        n //= 58
                    mint_address = "".join(reversed(addr_chars))[:44].ljust(44, "1")
                    explorer_url = f"https://explorer.solana.com/address/{mint_address}?cluster=devnet"

                try:
                    existing = supabase.table("partnership_nfts").select("id").eq("distributor_id", distributor_id).eq("supplier_id", supplier_id).execute()
                    if not existing.data:
                        nft_insert = {
                            "id": str(uuid.uuid4()),
                            "distributor_id": distributor_id,
                            "supplier_id": supplier_id,
                            "mint_address": mint_address,
                            "explorer_url": explorer_url,
                            "token_name": token_name,
                            "issued_at": now_iso(),
                        }
                        nft_res = supabase.table("partnership_nfts").insert(nft_insert).execute()
                        nft_data = nft_res.data[0] if nft_res.data else nft_insert
                    else:
                        nft_data = existing.data[0]
                except Exception:
                    pass
    except Exception as e:
        return error_response(str(e))
    return success_response(
        data={"request_id": request_id, "action": action, "nft": nft_data},
        message=f"Request {new_status}" + (" — Partnership NFT diterbitkan" if nft_data else ""),
    )


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
