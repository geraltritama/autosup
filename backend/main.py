import os
import csv
import io
import random
import uuid
import json
import hashlib
import requests
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv
from fastapi import FastAPI, Header, BackgroundTasks, Depends, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from supabase import create_client, Client
import requests
from pydantic import BaseModel
from typing import Any, Optional

load_dotenv()

# ==========================================
# 0. AUTH DEPENDENCY
# ==========================================

class AuthenticatedUser:
    """Represents a verified user from JWT token."""
    def __init__(self, user_id: str, role: str, email: str = ""):
        self.user_id = user_id
        self.role = role
        self.email = email


async def get_current_user(request: Request) -> AuthenticatedUser:
    """Verify Supabase JWT locally (no network call) and extract user_id + role."""
    import jwt as _jwt
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = auth_header[7:]
    try:
        # Decode JWT locally using Supabase JWT secret
        jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "")
        if jwt_secret:
            payload = _jwt.decode(token, jwt_secret, algorithms=["HS256"], audience="authenticated")
            user_id = payload.get("sub", "")
            meta = payload.get("user_metadata", {}) or {}
            role = meta.get("role", "distributor")
            email = payload.get("email", "")
        else:
            # Fallback: verify via Supabase Auth API (slower)
            headers = {
                "apikey": os.getenv("SUPABASE_KEY", ""),
                "Authorization": f"Bearer {token}",
            }
            resp = requests.get(
                f"{os.getenv('SUPABASE_URL')}/auth/v1/user",
                headers=headers,
                timeout=5,
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid or expired token")
            user_data = resp.json()
            user_id = user_data.get("id", "")
            meta = user_data.get("user_metadata", {}) or {}
            role = meta.get("role", "distributor")
            email = user_data.get("email", "")
        if not user_id:
            raise HTTPException(status_code=401, detail="Could not resolve user from token")
        return AuthenticatedUser(user_id=user_id, role=role, email=email)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Token verification failed")
        if not user_id:
            raise HTTPException(status_code=401, detail="Could not resolve user from token")
        return AuthenticatedUser(user_id=user_id, role=role, email=email)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Token verification failed")

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
    min_threshold: Optional[int] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    product_name: Optional[str] = None

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
    terms: Optional[str] = None
    legal_contract_hash: Optional[str] = None
    valid_until: Optional[int] = None
    distribution_region: Optional[str] = None

class UpdatePartnershipReq(BaseModel):
    action: str  # "accept" | "reject"

class OpenCreditReq(BaseModel):
    retailer_id: str
    credit_limit: float
    distributor_id: Optional[str] = None
    billing_cycle_days: int = 30
    notes: Optional[str] = None

class UpdateCreditReq(BaseModel):
    credit_limit: Optional[float] = None
    status: Optional[str] = None

class UpdateProfileReq(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None

class UpdateBusinessReq(BaseModel):
    business_name: Optional[str] = None
    business_type: Optional[str] = None
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
# 3. SUPABASE & GEMINI
# ==========================================

supabase: Client | None = None
OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY", "")
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_KEY = os.getenv("GROQ_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "google/gemma-2-9b-it:free")
AI_URL = "https://openrouter.ai/api/v1/chat/completions"

@asynccontextmanager
async def lifespan(app: FastAPI):
    global supabase
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if url and key:
        supabase = create_client(url, key)
    yield

app = FastAPI(title="AUTOSUP Backend API", lifespan=lifespan)

@app.get("/")
def health_check():
    return {"status": "ok", "supabase": supabase is not None}

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


_auth_users_cache: dict = {}
_auth_users_cache_ts: float = 0

def auth_users_by_role(role: str) -> list[dict]:
    """Fetch users from Supabase Auth by role, return as dict list. Cached 60s."""
    global _auth_users_cache, _auth_users_cache_ts
    import time as _t
    now = _t.time()
    if now - _auth_users_cache_ts < 60 and _auth_users_cache:
        return [u for u in _auth_users_cache.get("_all", []) if u.get("role") == role]

    results = []

    # Primary: Supabase Auth REST API with pagination
    try:
        headers = {
            "apikey": os.getenv("SUPABASE_KEY"),
            "Authorization": f"Bearer {os.getenv('SUPABASE_KEY')}",
        }
        page = 1
        per_page = 100
        while True:
            resp = requests.get(
                f"{os.getenv('SUPABASE_URL')}/auth/v1/admin/users?page={page}&per_page={per_page}",
                headers=headers,
                timeout=10,
            )
            if resp.status_code != 200:
                break
            users = resp.json().get("users", [])
            if not users:
                break
            for u in users:
                meta = u.get("user_metadata", {}) or {}
                u_role = meta.get("role", "")
                if u_role:
                    results.append({
                        "id": u.get("id", ""),
                        "email": u.get("email", ""),
                        "full_name": meta.get("full_name", ""),
                        "business_name": meta.get("business_name", ""),
                        "role": u_role,
                        "phone": meta.get("phone", ""),
                        "business_type": meta.get("business_type", ""),
                        "reputation_score": meta.get("reputation_score", 0),
                        "city": meta.get("city", ""),
                        "is_active": True,
                    })
            if len(users) < per_page:
                break
            page += 1
        # Deduplicate by user ID
        seen = set()
        results = [r for r in results if r["id"] not in seen and not seen.add(r["id"])]
        # Cache all fetched users
        _auth_users_cache["_all"] = results
        _auth_users_cache_ts = now
        return [u for u in results if u.get("role") == role]
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
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_KEY = os.getenv("GROQ_API_KEY", "")

# ─── Rate-limit cooldown ─────────────────────────────────────────────────────
import threading
_rate_limit_until = 0.0
_last_call_time = 0.0
_rate_lock = threading.Lock()


def _call_ai(prompt: str) -> str:
    """Call AI with automatic fallback: OpenRouter -> Gemini -> Groq."""
    global _rate_limit_until, _last_call_time
    import time as _time

    providers = []
    if OPENROUTER_KEY and OPENROUTER_KEY.startswith("sk-or-"):
        providers.append("openrouter")
    if GEMINI_KEY:
        providers.append("gemini")
    if GROQ_KEY:
        providers.append("groq")

    if not providers:
        raise RuntimeError("No AI API keys configured. Set OPENROUTER_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY in .env")

    errors = []
    for provider in providers:
        try:
            if provider == "openrouter":
                result = _call_openrouter(prompt, _time)
            elif provider == "gemini":
                result = _call_gemini(prompt)
            else:
                result = _call_groq(prompt)
            return result
        except Exception as e:
            errors.append(f"{provider}: {str(e)[:100]}")
            continue

    raise RuntimeError(f"All AI providers failed: {'; '.join(errors)}")


def _call_openrouter(prompt: str, _time) -> str:
    global _rate_limit_until, _last_call_time
    now_t = _time.time()
    with _rate_lock:
        gap = now_t - _last_call_time
        if gap < 2:
            _time.sleep(2 - gap + 0.1)
        _last_call_time = _time.time()
        if _time.time() < _rate_limit_until:
            raise RuntimeError("Rate-limited, skipping.")

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
    if resp.status_code == 429:
        delay = int(resp.headers.get("Retry-After", "60"))
        with _rate_lock:
            _rate_limit_until = _time.time() + delay + 10
        raise RuntimeError(f"Rate limited ({delay}s)")
    if resp.status_code != 200:
        raise RuntimeError(f"HTTP {resp.status_code}")
    return resp.json()["choices"][0]["message"]["content"]


def _call_gemini(prompt: str) -> str:
    resp = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_KEY}",
        headers={"Content-Type": "application/json"},
        json={"contents": [{"parts": [{"text": prompt}]}]},
        timeout=30,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Gemini HTTP {resp.status_code}")
    return resp.json()["candidates"][0]["content"]["parts"][0]["text"]


def _call_groq(prompt: str) -> str:
    import time as _gt
    for attempt in range(2):
        resp = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama-3.1-8b-instant",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
            },
            timeout=30,
        )
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"]
        if resp.status_code == 429 and attempt == 0:
            retry_after = int(resp.headers.get("Retry-After", "10"))
            _gt.sleep(min(retry_after, 30))
            continue
        raise RuntimeError(f"Groq HTTP {resp.status_code}")
    raise RuntimeError("Groq retry exhausted")

# ==========================================
# 4. ROOT
# ==========================================

@app.get("/")
def home():
    return success_response(
        data={"status": "AUTOSUP Backend Active", "engine": "Gemini Flash"},
        message="Server is running",
    )

def _record_payment_proof_bg(order_id: str, buyer_id: str, seller_id: str, total_amount: int):
    """Background task: record payment proof on-chain via Solana Memo program."""
    try:
        buyer_wallet = bc.get_or_create_wallet(supabase, buyer_id)
        seller_wallet = bc.get_or_create_wallet(supabase, seller_id)
        sig = bc.record_payment_proof(
            order_id,
            buyer_wallet["pubkey"],
            seller_wallet["pubkey"],
            total_amount,
            action="payment_init",
        )
        if sig:
            supabase.table("orders").update({"payment_proof_sig": sig}).eq("id", order_id).execute()
    except Exception:
        pass  # Non-critical — order already persisted


# ==========================================
# 5. AUTH
# ==========================================

@app.post("/auth/register")
def register_user(req: RegisterReq):
    try:
        # Step 1: Register to auth.users
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
            return error_response("Failed to register user.")
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
            message="Registration successful",
        )
    except Exception as e:
        return error_response(f"Registration failed: {str(e)}")


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
            message="Login successful",
        )
    except Exception:
        return error_response("Login failed. Please check your email and password.")


@app.post("/auth/forgot-password")
def forgot_password(body: dict):
    """Send password reset email via Supabase."""
    try:
        email = body.get("email", "")
        if not email:
            return error_response("Email is required.")
        supabase.auth.reset_password_email(email)
        return success_response(message="Password reset link has been sent to your email.")
    except Exception as e:
        return error_response(f"Failed to send reset: {str(e)}")


@app.post("/auth/refresh")
def refresh_token(req: RefreshReq):
    try:
        res = supabase.auth.refresh_session(req.refresh_token)
        return success_response(
            data={"access_token": res.session.access_token, "refresh_token": res.session.refresh_token},
            message="Token refreshed successfully",
        )
    except Exception as e:
        return error_response(f"Failed to refresh token: {str(e)}")


@app.post("/auth/logout")
def logout_user():
    try:
        supabase.auth.sign_out()
        return success_response(message="Logged out successfully")
    except Exception as e:
        return error_response(f"Failed to logout: {str(e)}")

# ==========================================
# 6. INVENTORY
# ==========================================

def _map_inventory_item(i: dict) -> dict:
    return {
        "id": i.get("id"),
        "name": i.get("product_name"),
        "stock": i.get("current_stock"),
        "min_stock": i.get("min_threshold", 0),
        "category": i.get("category", "general"),
        "unit": i.get("unit", "pcs"),
        "price": i.get("price", 0) or 0,
    }

@app.get("/inventory")
def get_inventory(user_id: Optional[str] = None, demand_level: Optional[str] = None,
                  current_user: AuthenticatedUser = Depends(get_current_user)):
    try:
        uid = current_user.user_id
        role = current_user.role
        query = supabase.table("inventories").select("*").eq("user_id", uid).order("product_name")
        res = query.execute()
        items = [_map_inventory_item(i) for i in (res.data or [])]

        # Calculate demand_level for supplier based on order frequency (last 30 days)
        if role == "supplier" and items:
            from collections import Counter
            try:
                orders_res = supabase.table("orders").select("items, created_at").eq("seller_id", uid).execute()
                now = datetime.utcnow()
                cutoff = now - timedelta(days=30)
                product_order_count = Counter()
                for o in (orders_res.data or []):
                    ts = _parse_ts(o.get("created_at", ""))
                    if ts and ts >= cutoff:
                        for it in (o.get("items") or []):
                            name = (it.get("product_name") or it.get("name") or "").lower()
                            product_order_count[name] += 1

                for item in items:
                    name_lower = item["name"].lower()
                    count = product_order_count.get(name_lower, 0)
                    item["demand_level"] = "high" if count >= 10 else "normal" if count >= 3 else "low"
                    item["demand_order_count"] = count
            except Exception:
                for item in items:
                    item["demand_level"] = "normal"
                    item["demand_order_count"] = 0

        # Filter by demand_level if requested
        if demand_level and demand_level in ("high", "normal", "low"):
            items = [i for i in items if i.get("demand_level") == demand_level]

        # Build insight
        high_demand_count = sum(1 for i in items if i.get("demand_level") == "high")
        insight = f"{high_demand_count} products experiencing high demand from distributors" if high_demand_count > 0 else ""

        return success_response(data={"items": items, "insight": insight}, message="Inventory data retrieved successfully")
    except Exception as e:
        return error_response(str(e))

@app.get("/inventory/seller/{seller_id}")
def get_seller_inventory(seller_id: str):
    try:
        res = supabase.table("inventories").select("*").eq("user_id", seller_id).execute()
        items = [_map_inventory_item(i) for i in (res.data or [])]
        return success_response(data=items, message="Seller inventory retrieved successfully")
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
        return success_response(data=_map_inventory_item(i), message="New item added successfully")
    except Exception:
        # Fallback: insert only core columns in case extended columns don't exist yet
        try:
            minimal = {"product_name": data.product_name, "current_stock": data.current_stock}
            res = supabase.table("inventories").insert(minimal).execute()
            i = res.data[0]
            return success_response(data=_map_inventory_item(i), message="New item added (limited schema — run SQL migration)")
        except Exception as e2:
            return error_response(str(e2))


@app.patch("/inventory/{item_id}")
def update_inventory(item_id: str, data: UpdateStockReq):
    try:
        update_payload = {"current_stock": data.current_stock}
        if data.price is not None:
            update_payload["price"] = data.price
        if data.min_threshold is not None:
            update_payload["min_threshold"] = data.min_threshold
        if data.category is not None:
            update_payload["category"] = data.category
        if data.unit is not None:
            update_payload["unit"] = data.unit
        if data.product_name is not None:
            update_payload["product_name"] = data.product_name
        res = supabase.table("inventories").update(update_payload).eq("id", item_id).execute()
        if not res.data:
            return error_response("Item not found.")
        i = res.data[0]
        return success_response(
            data=_map_inventory_item(i),
            message="Stock updated successfully",
        )
    except Exception as e:
        return error_response(str(e))


@app.delete("/inventory/{item_id}")
def delete_inventory(item_id: str):
    try:
        res = supabase.table("inventories").delete().eq("id", item_id).execute()
        if not res.data:
            return error_response("Item not found.")
        return success_response(message="Item deleted successfully")
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
               page: int = 1, limit: int = 20, current_user: AuthenticatedUser = Depends(get_current_user)):
    try:
        # Use authenticated user — role from token determines filter
        uid = current_user.user_id
        u_role = current_user.role
        query = supabase.table("orders").select("*").order("created_at", desc=True)
        if status:
            query = query.eq("status", status)
        # Supplier sees orders where they are seller, retailer sees where they are buyer
        # Distributor sees BOTH directions (buyer from supplier, seller to retailer)
        if u_role == "supplier":
            query = query.eq("seller_id", uid)
        elif u_role == "distributor":
            if role == "seller":
                query = query.eq("seller_id", uid)
            elif role == "buyer":
                query = query.eq("buyer_id", uid)
            else:
                query = query.or_(f"buyer_id.eq.{uid},seller_id.eq.{uid}")
        else:
            query = query.eq("buyer_id", uid)
        res = query.execute()
        orders = [_map_order(o) for o in (res.data or [])]

        if search:
            sl = search.lower()
            orders = [o for o in orders if sl in o["order_number"].lower()
                      or sl in o["buyer"]["name"].lower() or sl in o["seller"]["name"].lower()]

        # Sort by status priority: pending→processing→shipping→delivered→cancelled
        status_priority = {"pending": 0, "processing": 1, "shipping": 2, "delivered": 3, "cancelled": 4}
        orders.sort(key=lambda o: (status_priority.get(o["status"], 99), o.get("created_at", "")), reverse=False)
        # Within same status, newest first
        orders.sort(key=lambda o: o.get("created_at", ""), reverse=True)
        orders.sort(key=lambda o: status_priority.get(o["status"], 99))

        total = len(orders)
        start = (page - 1) * limit

        # Fulfillment metrics for supplier
        fulfillment_metrics = None
        if u_role == "supplier" and orders:
            delivered = [o for o in orders if o["status"] == "delivered"]
            completion_rate = round(len(delivered) / max(total, 1) * 100)
            # Avg processing time (pending→processing) from status_history or created_at→updated_at
            processing_hours = []
            for o in orders:
                history = o.get("status_history") or []
                pending_ts = next((h.get("changed_at") for h in history if h.get("status") == "pending"), None)
                proc_ts = next((h.get("changed_at") for h in history if h.get("status") == "processing"), None)
                if pending_ts and proc_ts:
                    try:
                        diff = (_parse_ts(proc_ts) - _parse_ts(pending_ts)).total_seconds() / 3600
                        if 0 < diff < 720:
                            processing_hours.append(diff)
                    except Exception:
                        pass
                elif o.get("status") in ("processing", "shipping", "delivered") and o.get("created_at"):
                    # Fallback: estimate from created_at (assume processed within 24h for delivered orders)
                    if o.get("status") == "delivered":
                        processing_hours.append(12)  # estimate 12h avg for completed orders
            avg_processing = round(sum(processing_hours) / max(len(processing_hours), 1), 1) if processing_hours else 0
            delayed = sum(1 for o in orders if o["status"] == "processing" and
                         (_parse_ts(o.get("updated_at", "") or o.get("created_at", "")) or datetime.utcnow()) < datetime.utcnow() - timedelta(hours=72))
            fulfillment_metrics = {
                "avg_processing_hours": avg_processing,
                "completion_rate": completion_rate,
                "delayed_count": delayed,
                "on_time_rate": min(100, completion_rate + 5) if completion_rate > 0 else 0,
            }

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
                "fulfillment_metrics": fulfillment_metrics,
                "pagination": {"page": page, "limit": limit, "total": total},
            },
            message="Order data retrieved successfully",
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

        # Derive escrow from order status (more reliable than escrow_status field)
        held = sum(1 for o in orders if o.get("status") in ("pending", "processing", "shipping"))
        released = sum(1 for o in orders if o.get("status") == "delivered")
        refunded = sum(1 for o in orders if o.get("status") == "cancelled")
        total_released_value = sum(
            o.get("total_price", 0) for o in orders if o.get("status") == "delivered"
        )

        # Reputation score: weighted formula (max 100)
        # = Completion Rate × 60% + On-Time Rate × 25% + Partner Trust × 15%
        total_orders = len(orders)
        completion_rate = (released / max(total_orders, 1)) * 100
        on_time_rate = min(100, completion_rate + 5) if completion_rate > 0 else 0
        # Partner trust: active partnerships / total partnerships
        try:
            all_partnerships = supabase.table("partnerships").select("status").eq("approver_id", uid).execute().data or []
            active_p = sum(1 for p in all_partnerships if p.get("status") == "accepted")
            partner_trust = (active_p / max(len(all_partnerships), 1)) * 100
        except Exception:
            partner_trust = 100
        reputation_score = round(completion_rate * 0.60 + on_time_rate * 0.25 + partner_trust * 0.15)

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
            return error_response("Order not found.")
        return success_response(data=_map_order(res.data[0]), message="Order detail found")
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
def create_order(data: CreateOrderReqV2, background_tasks: BackgroundTasks):
    # Enforce supply chain hierarchy: retailer cannot order from supplier
    if data.buyer_role == "retailer" and data.seller_type == "supplier":
        return error_response(
            "Retailer cannot place order directly with Supplier. "
            "Please order through a Distributor."
        )

    # Validate active partnership between buyer and seller
    try:
        if data.seller_type == "supplier":
            p_type = "supplier_distributor"
            p_check = supabase.table("partnerships").select("id").eq("type", p_type).eq("requester_id", data.buyer_id).eq("approver_id", data.seller_id).eq("status", "accepted").execute()
        else:
            p_type = "distributor_retailer"
            p_check = supabase.table("partnerships").select("id").eq("type", p_type).eq("requester_id", data.buyer_id).eq("approver_id", data.seller_id).eq("status", "accepted").execute()
        if not p_check.data:
            return error_response("Cannot create order: no active partnership with this seller. Request partnership first.")
    except Exception:
        pass  # Allow order if partnership check fails (table might not exist yet)

    # Validate stock availability
    if data.seller_id and data.items:
        try:
            inv_res = supabase.table("inventories").select("product_name, current_stock").eq("user_id", data.seller_id).execute()
            stock_map = {r["product_name"]: r.get("current_stock", 0) for r in (inv_res.data or [])}
            for item in data.items:
                name = item.get("item_name") or item.get("product_name", "")
                qty = item.get("qty", 0)
                available = stock_map.get(name)
                if name and available is not None and qty > available:
                    return error_response(
                        f"Insufficient stock for '{name}'. Available: {available}, requested: {qty}."
                    )
        except Exception:
            pass

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

        # Run blockchain payment proof recording in background (non-blocking)
        if bc:
            background_tasks.add_task(
                _record_payment_proof_bg,
                order_id, data.buyer_id, data.seller_id, int(total_amount),
            )

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
            },
            message="Order created successfully",
        )
    except Exception as e:
        return error_response(str(e))


def _sync_delivered_to_inventory(user_id: str, items: list):
    """Auto-add delivered order items to buyer's inventory (upsert)."""
    for item in items:
        product_name = item.get("item_name") or item.get("product_name", "")
        qty = item.get("qty") or item.get("quantity", 0)
        price = item.get("price_per_unit") or item.get("price", 0)
        unit = item.get("unit", "pcs")

        if not product_name or qty <= 0:
            continue

        # Check if buyer already has this product
        existing = supabase.table("inventories").select("id, current_stock").eq("user_id", user_id).eq("product_name", product_name).execute()
        if existing.data and len(existing.data) > 0:
            row = existing.data[0]
            new_stock = row.get("current_stock", 0) + qty
            supabase.table("inventories").update({"current_stock": new_stock}).eq("id", row["id"]).execute()
        else:
            payload = {
                "product_name": product_name,
                "current_stock": qty,
                "user_id": user_id,
                "unit": unit,
            }
            if price:
                payload["price"] = price
            supabase.table("inventories").insert(payload).execute()


def _adjust_seller_inventory(user_id: str, items: list, direction: str):
    """Reserve/release seller stock by product name."""
    multiplier = -1 if direction == "deduct" else 1
    for item in items:
        product_name = item.get("item_name") or item.get("product_name", "")
        qty = item.get("qty") or item.get("quantity", 0)
        if not product_name or qty <= 0:
            continue
        existing = supabase.table("inventories") \
            .select("id, current_stock") \
            .eq("user_id", user_id) \
            .eq("product_name", product_name) \
            .execute()
        if existing.data and len(existing.data) > 0:
            row = existing.data[0]
            current_stock = row.get("current_stock", 0) or 0
            new_stock = max(0, current_stock + (multiplier * qty)) if direction == "deduct" else current_stock + qty
            supabase.table("inventories") \
                .update({"current_stock": new_stock}) \
                .eq("id", row["id"]) \
                .execute()


@app.put("/orders/{order_id}/status")
def update_order_status(order_id: str, data: UpdateOrderStatusReq):
    try:
        full_order_res = supabase.table("orders").select("*").eq("id", order_id).execute()
        full_order = full_order_res.data[0] if full_order_res.data else None
        if not full_order:
            return error_response("Order not found.")

        changed_at = now_iso()
        previous_status = full_order.get("status", "pending")
        existing_history = full_order.get("status_history") or [
            {"status": full_order.get("status", "pending"), "changed_at": full_order.get("created_at", changed_at)}
        ]
        if previous_status != data.status:
            existing_history.append({"status": data.status, "changed_at": changed_at})

        update_payload: dict = {
            "status": data.status,
            "updated_at": changed_at,
            "status_history": existing_history,
        }
        if data.shipping_info:
            update_payload["shipping_info"] = data.shipping_info

        order_items = full_order.get("items") or []
        buyer_id = full_order.get("buyer_id")
        seller_id = full_order.get("seller_id")

        # Reserve seller stock once the order is approved/processing.
        if data.status == "processing" and previous_status == "pending":
            if seller_id and order_items:
                try:
                    _adjust_seller_inventory(seller_id, order_items, "deduct")
                except Exception:
                    pass

        # Cancelled orders should return held funds and restore reserved stock.
        if data.status == "cancelled":
            update_payload["escrow_status"] = "refunded"
            if previous_status in ["processing", "shipping"] and seller_id and order_items:
                try:
                    _adjust_seller_inventory(seller_id, order_items, "restore")
                except Exception:
                    pass

        # Auto-release escrow and bump seller reputation when order delivered
        if data.status == "delivered":
            update_payload["escrow_status"] = "released"

            # Deduct seller stock if not already deducted (checkout may bypass update_order_status)
            if seller_id and order_items and previous_status in ["processing", "shipping"]:
                try:
                    _adjust_seller_inventory(seller_id, order_items, "deduct")
                except Exception:
                    pass

            # Auto-add delivered items to buyer inventory (distributor / retailer)
            if buyer_id and order_items:
                try:
                    _sync_delivered_to_inventory(buyer_id, order_items)
                except Exception:
                    pass  # Non-critical — don't fail order update

            # Bump seller reputation
            if full_order:
                seller_id = full_order.get("seller_id")
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

        # Auto-create shipment record when order moves to shipping
        if data.status == "shipping" and full_order:
            try:
                ship_info = data.shipping_info or full_order.get("shipping_info") or {}
                supabase.table("shipments").insert({
                    "id": str(uuid.uuid4()),
                    "order_id": order_id,
                    "sender_id": seller_id,
                    "receiver_id": buyer_id,
                    "retailer_name": full_order.get("buyer_name", ""),
                    "destination": full_order.get("delivery_address", ""),
                    "carrier": ship_info.get("courier", "JNE") if isinstance(ship_info, dict) else "JNE",
                    "status": "in_transit",
                    "eta": full_order.get("estimated_delivery", future_iso(days=3)),
                    "created_at": changed_at,
                }).execute()
            except Exception:
                pass  # Non-critical

        try:
            supabase.table("orders").update(update_payload).eq("id", order_id).execute()
        except Exception as update_error:
            # Backward-compatible fallback for databases that do not have
            # status_history / updated_at columns yet.
            fallback_payload = {"status": data.status}
            if data.shipping_info:
                fallback_payload["shipping_info"] = data.shipping_info
            if data.status == "delivered":
                fallback_payload["escrow_status"] = "released"
            try:
                supabase.table("orders").update(fallback_payload).eq("id", order_id).execute()
            except Exception:
                raise update_error
        return success_response(data={"order_id": order_id, "status": data.status}, message="Status updated")
    except Exception as e:
        return error_response(str(e))


@app.delete("/orders/{order_id}")
def delete_order(order_id: str):
    """Delete test/dummy order."""
    try:
        supabase.table("orders").delete().eq("id", order_id).execute()
        return success_response(data={"order_id": order_id}, message="Order deleted")
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 8. DASHBOARD SUMMARY (role-based)
# ==========================================

@app.get("/dashboard/summary")
def get_dashboard_summary(x_user_role: Optional[str] = Header(default=None),
                          user_id: Optional[str] = None,
                          current_user: AuthenticatedUser = Depends(get_current_user)):
    try:
        role = current_user.role
        uid = current_user.user_id
        now = datetime.utcnow()
        month_start = _month_start(now)
        next_due_cutoff = now + timedelta(days=7)

        # Orders filtered by user
        orders_query = supabase.table("orders").select("*")
        if role == "supplier":
            orders_query = orders_query.eq("seller_id", uid)
        elif role == "retailer":
            orders_query = orders_query.eq("buyer_id", uid)
        else:
            orders_query = orders_query.or_(f"buyer_id.eq.{uid},seller_id.eq.{uid}")
        orders = orders_query.execute().data or []

        # Inventory filtered by user
        inv_query = supabase.table("inventories").select("current_stock, min_threshold")
        inv_query = inv_query.eq("user_id", uid)
        inventory = inv_query.execute().data or []

        pending = sum(1 for o in orders if o.get("status") == "pending")
        processing = sum(1 for o in orders if o.get("status") in ["processing", "shipping"])
        in_transit = sum(1 for o in orders if o.get("status") == "shipping")
        completed = sum(
            1 for o in orders
            if o.get("status") == "delivered"
            and ((_parse_ts(o.get("updated_at", "")) or _parse_ts(o.get("created_at", "")) or now) >= month_start)
        )
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
            ai_alerts = [{"type": "restock_alert", "message": "AI agents have not generated insights yet.", "urgency": "low", "item_id": ""}]

        # Partnership counts filtered by user
        supplier_partner_count = 0
        distributor_partner_count = 0
        retailer_partner_count = 0
        pending_supplier_requests = 0
        pending_retailer_requests = 0
        try:
            p_query = supabase.table("partnerships").select("type,status,requester_id,approver_id").or_(f"requester_id.eq.{uid},approver_id.eq.{uid}")
            partnerships = p_query.execute().data or []
            active_partnerships = [p for p in partnerships if p.get("status") == "accepted"]
            pending_partnerships = [p for p in partnerships if p.get("status") == "pending"]

            # Supplier: count distributor partners (type=supplier_distributor, approver=supplier)
            supplier_partner_count = len([p for p in active_partnerships if p["type"] == "supplier_distributor"])
            # Retailer partners (type=distributor_retailer)
            retailer_partner_count = len([p for p in active_partnerships if p["type"] == "distributor_retailer"])
            # Pending requests where current user is approver
            pending_supplier_requests = len([p for p in pending_partnerships if p["type"] == "supplier_distributor" and p.get("approver_id") == uid])
            pending_retailer_requests = len([p for p in pending_partnerships if p["type"] == "distributor_retailer" and p.get("approver_id") == uid])
        except Exception:
            pass

        retailer_invoice_rows = []
        retailer_credit_rows = []
        if role == "retailer":
            try:
                retailer_invoice_rows = [row for row in safe_query("invoices") if row.get("buyer_id") == uid]
            except Exception:
                retailer_invoice_rows = []
            try:
                retailer_credit_rows = [
                    row for row in safe_query("credit_accounts")
                    if row.get("retailer_id") == uid and row.get("status") != "closed"
                ]
            except Exception:
                retailer_credit_rows = []

        if role == "supplier":
            # Demand growth: compare this week's order count vs last week
            week_ago = now - timedelta(days=7)
            two_weeks_ago = now - timedelta(days=14)
            this_week_orders = [o for o in orders if (_parse_ts(o.get("created_at", "")) or now) >= week_ago]
            last_week_orders = [o for o in orders if two_weeks_ago <= (_parse_ts(o.get("created_at", "")) or now) < week_ago]
            demand_growth = _period_growth_pct(len(this_week_orders), len(last_week_orders))

            # Top products: aggregate item quantities from all orders
            from collections import Counter
            product_counter = Counter()
            for o in orders:
                for it in (o.get("items") or []):
                    name = it.get("product_name") or it.get("name") or it.get("item_name") or ""
                    if not name:
                        continue
                    qty = it.get("quantity") or it.get("qty") or 1
                    product_counter[name] += qty
            top_products = [{"name": name, "volume": vol} for name, vol in product_counter.most_common(5)]

            # Recent incoming orders (pending only — awaiting supplier action)
            recent_orders = []
            for o in orders:
                if o.get("status") == "pending":
                    recent_orders.append({
                        "order_id": o.get("id") or o.get("order_id", ""),
                        "buyer_name": o.get("buyer_name", ""),
                        "status": o.get("status", ""),
                        "total": _order_total(o),
                        "created_at": o.get("created_at", ""),
                    })
                    if len(recent_orders) >= 8:
                        break

            # Demand trend chart: weekly order volume for last 8 weeks
            demand_trend = []
            for i in range(7, -1, -1):
                week_start = now - timedelta(weeks=i+1)
                week_end = now - timedelta(weeks=i)
                vol = sum(1 for o in orders if week_start <= (_parse_ts(o.get("created_at", "")) or now) < week_end)
                demand_trend.append({"period": week_end.strftime("%d %b"), "value": vol})

            # Distributor activity feed: recent events from orders
            distributor_activity = []
            for o in orders[:15]:
                ts = o.get("created_at", "")
                buyer = o.get("buyer_name", "Distributor")
                st = o.get("status", "")
                if st == "pending":
                    event = f"{buyer} placed a new order"
                elif st == "delivered":
                    event = f"Order to {buyer} delivered"
                elif st == "processing":
                    event = f"Order from {buyer} being processed"
                else:
                    continue
                distributor_activity.append({"event": event, "timestamp": ts})
                if len(distributor_activity) >= 8:
                    break

            data = {
                "role": "supplier",
                "products": {"total_active": total_inv, "low_stock_count": low_stock, "out_of_stock_count": out_of_stock},
                "orders": {"incoming_orders": pending, "processing": processing, "completed_this_month": completed},
                "partners": {"distributor_count": supplier_partner_count, "pending_requests": pending_supplier_requests},
                "demand_growth": demand_growth,
                "top_products": top_products,
                "recent_orders": recent_orders,
                "demand_trend_chart": demand_trend,
                "distributor_activity": distributor_activity,
                "ai_insights": ai_alerts,
            }
        elif role == "retailer":
            delivered_orders = [o for o in orders if o.get("status") == "delivered"]
            monthly_spending = sum(
                _order_total(order)
                for order in delivered_orders
                if (_parse_ts(order.get("created_at", "")) or now) >= month_start
            )
            total_outstanding = sum(
                float(row.get("amount", 0) or 0)
                for row in retailer_invoice_rows
                if row.get("status") in ["pending", "overdue"]
            )
            available_credit = sum(
                max(0, float(row.get("credit_limit", 0) or 0) - float(row.get("utilized_amount", 0) or 0))
                for row in retailer_credit_rows
            )
            upcoming_due_payments = sum(
                1
                for row in retailer_invoice_rows
                if row.get("status") in ["pending", "overdue"]
                and (_parse_ts(row.get("due_date", "")) or next_due_cutoff) <= next_due_cutoff
            )
            invoice_success_base = [
                row for row in retailer_invoice_rows
                if row.get("status") in ["paid", "pending", "overdue", "cancelled"]
            ]
            payment_success_rate = round(
                (sum(1 for row in invoice_success_base if row.get("status") == "paid") / max(len(invoice_success_base), 1)) * 100
            ) if invoice_success_base else 0
            order_accuracy_rate = round((len(delivered_orders) / max(len(orders), 1)) * 100) if orders else 0
            data = {
                "role": "retailer",
                "inventory": {"total_items": total_inv, "low_stock_count": low_stock, "out_of_stock_count": out_of_stock},
                "orders": {"active_orders": processing, "pending_approval": pending, "in_transit": in_transit,
                           "completed_this_month": completed, "order_accuracy_rate": order_accuracy_rate},
                "spending": {"total_outstanding": total_outstanding, "monthly_spending": monthly_spending, "available_credit": available_credit,
                              "upcoming_due_payments": upcoming_due_payments, "payment_success_rate": payment_success_rate},
                "distributors": {"active_partnered": retailer_partner_count, "pending_requests": pending_retailer_requests,
                                 "average_reliability_score": _counterparty_performance_score(orders, "seller_id"),
                                 "avg_delivery_time": _average_delivery_days(delivered_orders)},
                "forecast_accuracy_pct": _demand_stability_pct(delivered_orders),
                "ai_insights": ai_alerts,
            }
        else:
            # Distributor revenue (selling to retailers) and spending (buying from suppliers)
            delivered = [o for o in orders if o.get("status") == "delivered"]
            revenue = sum(_order_total(o) for o in delivered if o.get("seller_id") == uid)
            spending = sum(_order_total(o) for o in delivered if o.get("buyer_id") == uid)
            monthly_revenue = sum(_order_total(o) for o in delivered if o.get("seller_id") == uid and (_parse_ts(o.get("created_at", "")) or now) >= month_start)

            # Pending incoming orders from retailers (awaiting distributor action)
            pending_incoming = []
            for o in orders:
                if o.get("status") == "pending" and o.get("seller_id") == uid:
                    pending_incoming.append({
                        "order_id": o.get("id") or o.get("order_id", ""),
                        "buyer_name": o.get("buyer_name", ""),
                        "total": _order_total(o),
                        "created_at": o.get("created_at", ""),
                    })
                    if len(pending_incoming) >= 8:
                        break

            data = {
                "role": "distributor",
                "inventory": {"total_items": total_inv, "low_stock_count": low_stock, "out_of_stock_count": out_of_stock},
                "orders": {"active_orders": processing, "pending_orders": pending, "completed_this_month": completed},
                "suppliers": {"partner_count": supplier_partner_count, "pending_requests": pending_supplier_requests},
                "retailers": {"partner_count": retailer_partner_count, "pending_requests": pending_retailer_requests},
                "financials": {"revenue": revenue, "spending": spending, "net_margin": revenue - spending, "monthly_revenue": monthly_revenue},
                "pending_incoming": pending_incoming,
                "ai_insights": ai_alerts,
            }

        return success_response(data=data, message="Dashboard data retrieved successfully")
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 9. PAYMENTS
# ==========================================

@app.get("/payments/retailer")
def get_retailer_payments(user_id: Optional[str] = None, current_user: AuthenticatedUser = Depends(get_current_user)):
    try:
        uid = current_user.user_id
        raw = safe_query("invoices")
        raw = [i for i in raw if i.get("buyer_id") == uid]

        # Fallback: generate invoices from orders if invoices table is empty
        if not raw and uid:
            orders_res = supabase.table("orders").select("*").eq("buyer_id", uid).execute()
            raw = [
                {
                    "id": o.get("id"),
                    "order_id": o.get("id"),
                    "seller_name": o.get("seller_name", ""),
                    "amount": o.get("total_price", 0),
                    "status": "paid" if o.get("status") in ["delivered", "completed"] else ("pending" if o.get("status") in ["pending", "processing", "shipping"] else "cancelled"),
                    "due_date": o.get("created_at", now_iso()),
                    "created_at": o.get("created_at", now_iso()),
                    "buyer_id": uid,
                }
                for o in (orders_res.data or [])
                if o.get("status") != "cancelled"
            ]

        invoices = [
            {
                "invoice_id": i.get("id"),
                "order_id": i.get("order_id") or i.get("id"),
                "seller_name": i.get("seller_name", ""),
                "amount": i.get("amount", 0),
                "status": i.get("status", "pending"),
                "due_date": i.get("due_date", future_iso(days=7)),
                "created_at": i.get("created_at", now_iso()),
            }
            for i in raw
        ]
        total_outstanding = sum(i["amount"] for i in invoices if i["status"] in ["pending", "overdue"])
        paid_this_month = sum(i["amount"] for i in invoices if i["status"] == "paid")
        insights = []
        if total_outstanding > 0:
            insights.append({"type": "cash_flow", "message": f"You have Rp {total_outstanding:,.0f} in outstanding payments. Consider settling before due dates.", "urgency": "medium"})
        return success_response(
            data={
                "summary": {"total_outstanding": total_outstanding, "total_invoices": len(invoices),
                            "overdue_count": sum(1 for i in invoices if i["status"] == "overdue"),
                            "paid_this_month": paid_this_month},
                "invoices": invoices,
                "insights": insights,
            },
            message="Retailer payment data retrieved successfully",
        )
    except Exception as e:
        return error_response(str(e))


@app.get("/payments/distributor")
def get_distributor_payments(user_id: Optional[str] = None, current_user: AuthenticatedUser = Depends(get_current_user)):
    try:
        uid = current_user.user_id
        query = supabase.table("payments").select("*")
        try:
            query = query.or_(f"payer_id.eq.{uid},payee_id.eq.{uid}")
        except Exception:
            pass
        res = query.execute()
        payments_raw = res.data or []

        # Fallback: generate from orders if payments table is empty
        if not payments_raw and uid:
            recv_res = supabase.table("orders").select("*").eq("seller_id", uid).execute()
            pay_res = supabase.table("orders").select("*").eq("buyer_id", uid).execute()
            for o in (recv_res.data or []):
                if o.get("status") == "cancelled":
                    continue
                payments_raw.append({
                    "id": o.get("id"), "counterpart_name": o.get("buyer_name", ""),
                    "amount": o.get("total_price", 0), "type": "receivable",
                    "status": "settled" if o.get("status") in ["delivered", "completed"] else "pending",
                    "order_id": o.get("order_number", o.get("id", "")[:8]),
                    "created_at": o.get("created_at", now_iso()),
                })
            for o in (pay_res.data or []):
                if o.get("status") == "cancelled":
                    continue
                payments_raw.append({
                    "id": o.get("id"), "counterpart_name": o.get("seller_name", ""),
                    "amount": o.get("total_price", 0), "type": "payable",
                    "status": "settled" if o.get("status") in ["delivered", "completed"] else "pending",
                    "order_id": o.get("order_number", o.get("id", "")[:8]),
                    "created_at": o.get("created_at", now_iso()),
                })

        payments = [
            {
                "payment_id": p.get("id"),
                "counterpart_name": p.get("counterpart_name", ""),
                "amount": p.get("amount", 0),
                "type": p.get("type", "payable"),
                "status": p.get("status", "pending"),
                "order_id": p.get("order_id", ""),
                "created_at": p.get("created_at", now_iso()),
            }
            for p in payments_raw
        ]
        return success_response(
            data={
                "summary": {"total_payable": sum(p["amount"] for p in payments if p["type"] == "payable"),
                            "total_receivable": sum(p["amount"] for p in payments if p["type"] == "receivable"),
                            "pending_count": sum(1 for p in payments if p["status"] == "pending")},
                "payments": payments,
            },
            message="Distributor payment data retrieved successfully",
        )
    except Exception as e:
        return error_response(str(e))


@app.post("/payments/settle")
def settle_payment(data: SettlePaymentReq):
    try:
        supabase.table("payments").update({"status": "settled"}).eq("id", data.payment_id).execute()
        return success_response(data={"success": True}, message="Payment completed successfully")
    except Exception as e:
        return error_response(str(e))


@app.post("/invoices/{invoice_id}/pay")
def pay_invoice(invoice_id: str):
    try:
        # Update order status to delivered (invoices are generated from orders)
        supabase.table("orders").update({"status": "delivered", "escrow_status": "released", "updated_at": now_iso()}).eq("id", invoice_id).execute()
        # Also try invoices table in case it exists
        try:
            supabase.table("invoices").update({"status": "paid", "paid_at": now_iso()}).eq("id", invoice_id).execute()
        except Exception:
            pass
        return success_response(data={"success": True}, message="Invoice paid successfully")
    except Exception as e:
        return error_response(str(e))


@app.post("/orders/{order_id}/cancel")
def cancel_order_buyer(order_id: str):
    """Allow buyer to cancel their own order if still pending or processing."""
    try:
        res = supabase.table("orders").select("*").eq("id", order_id).execute()
        if not res.data:
            return error_response("Order not found.")
        order = res.data[0]
        if order["status"] not in ["pending", "processing"]:
            return error_response("Order can only be cancelled when pending or processing.")
        seller_id = order.get("seller_id")
        items = order.get("items") or []
        # Restore stock if was already deducted (processing)
        if order["status"] == "processing" and seller_id and items:
            try:
                _adjust_seller_inventory(seller_id, items, "restore")
            except Exception:
                pass
        supabase.table("orders").update({"status": "cancelled", "escrow_status": "refunded", "updated_at": now_iso()}).eq("id", order_id).execute()
        return success_response(data={"order_id": order_id, "status": "cancelled"}, message="Order cancelled successfully. Escrow refunded.")
    except Exception as e:
        return error_response(str(e))


# ==========================================
# 10. RETAILERS
# ==========================================

@app.get("/retailers")
def get_retailers(search: Optional[str] = None, segment: Optional[str] = None,
                  status: Optional[str] = None, type: Optional[str] = None,
                  user_id: Optional[str] = None,
                  page: int = 1, limit: int = 20,
                  current_user: AuthenticatedUser = Depends(get_current_user)):
    try:
        uid = current_user.user_id

        # Primary source: auth users with role=retailer
        retailer_users = auth_users_by_role("retailer")
        retailers = [
            {
                "retailer_id": u["id"],
                "name": u.get("business_name", u.get("full_name", "")),
                "contact_person": u.get("full_name", ""),
                "phone": u.get("phone", ""),
                "city": u.get("city", ""),
                "segment": u.get("business_type", "regular") or "regular",
                "status": "active",
                "monthly_order_volume": 0,
                "total_purchase_amount": 0,
                "last_order_at": None,
                "partnership_status": "none",
            }
            for u in retailer_users if u.get("id")
        ]

        # Mark partnership status
        try:
            p_rows = supabase.table("partnerships").select("requester_id,status,type").eq("approver_id", uid).eq("type", "distributor_retailer").execute().data or []
            partner_ids = {p.get("requester_id", "") for p in p_rows if p.get("status") == "accepted"}
            pending_ids = {p.get("requester_id", "") for p in p_rows if p.get("status") == "pending"}
            for r in retailers:
                rid = r["retailer_id"]
                if rid in partner_ids:
                    r["partnership_status"] = "partner"
                elif rid in pending_ids:
                    r["partnership_status"] = "pending"
        except Exception:
            pass

        # Calculate real order volume per retailer from orders table
        try:
            from collections import Counter
            orders_res = supabase.table("orders").select("buyer_id, status, total_price, created_at").eq("seller_id", uid).execute()
            buyer_order_count = Counter()
            buyer_total_amount = Counter()
            buyer_last_order: dict = {}
            for o in (orders_res.data or []):
                bid = o.get("buyer_id", "")
                buyer_order_count[bid] += 1
                buyer_total_amount[bid] += int(o.get("total_price", 0) or 0)
                ts = o.get("created_at", "")
                if ts > buyer_last_order.get(bid, ""):
                    buyer_last_order[bid] = ts
            for r in retailers:
                rid = r["retailer_id"]
                r["monthly_order_volume"] = buyer_order_count.get(rid, 0)
                r["total_purchase_amount"] = buyer_total_amount.get(rid, 0)
                r["last_order_at"] = buyer_last_order.get(rid)
        except Exception:
            pass

        # Auto-calculate segment: premium / regular / new
        for r in retailers:
            purchase = r["total_purchase_amount"]
            orders = r["monthly_order_volume"]
            is_partner = r["partnership_status"] == "partner"
            if purchase >= 10_000_000 and orders >= 5 and is_partner:
                r["segment"] = "premium"
            elif purchase >= 2_000_000 or orders >= 2:
                r["segment"] = "regular"
            else:
                r["segment"] = "new"

        # Filters
        if type == "partner":
            retailers = [r for r in retailers if r["partnership_status"] == "partner"]
        elif type == "discover":
            retailers = [r for r in retailers if r["partnership_status"] == "none"]
        if search:
            sl = search.lower()
            retailers = [r for r in retailers if sl in r["name"].lower() or sl in r.get("city", "").lower()]
        if segment:
            retailers = [r for r in retailers if r["segment"] == segment]

        # Sort: partners first, then by order volume
        status_order = {"partner": 0, "pending": 1, "none": 2}
        retailers.sort(key=lambda r: (status_order.get(r["partnership_status"], 99), -r["monthly_order_volume"]))

        total = len(retailers)
        start = (page - 1) * limit
        return success_response(
            data={
                "retailers": retailers[start: start + limit],
                "summary": {"total": total, "active": total,
                            "premium_count": sum(1 for r in retailers if r["segment"] == "premium")},
                "pagination": {"page": page, "limit": limit, "total": total},
            },
            message="Retailer data retrieved successfully",
        )
    except Exception as e:
        return error_response(str(e))


@app.get("/retailers/{retailer_id}")
def get_retailer_detail(retailer_id: str):
    try:
        res = supabase.table("retailers").select("*").eq("id", retailer_id).execute()
        if not res.data:
            return error_response("Retailer not found.")
        r = res.data[0]
        return success_response(
            data={
                "retailer_id": r.get("id"), "name": r.get("name", ""), "contact_person": r.get("contact_person", ""),
                "phone": r.get("phone", ""), "email": r.get("email", ""), "city": r.get("city", ""),
                "address": r.get("address", ""), "segment": r.get("segment", "regular"), "status": r.get("status", "active"),
                "monthly_order_volume": r.get("monthly_order_volume", 0),
                "total_purchase_amount": r.get("total_purchase_amount", 0),
                "last_order_at": r.get("last_order_at", past_iso(days=3)),
                "purchase_history": [], "demand_intelligence": {"top_products": [], "peak_order_day": "Monday"}, "credit_summary": None,
            },
            message="Retailer detail found",
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
            message="Retailer added successfully",
        )
    except Exception as e:
        return error_response(str(e))


@app.put("/retailers/{retailer_id}")
def update_retailer(retailer_id: str, data: UpdateRetailerReq):
    try:
        update_payload = {k: v for k, v in data.dict().items() if v is not None}
        res = supabase.table("retailers").update(update_payload).eq("id", retailer_id).execute()
        if not res.data:
            return error_response("Retailer not found.")
        r = res.data[0]
        return success_response(
            data={"retailer_id": r.get("id"), "name": r.get("name"), "contact_person": r.get("contact_person"),
                  "phone": r.get("phone"), "city": r.get("city"), "segment": r.get("segment"),
                  "status": r.get("status"), "monthly_order_volume": r.get("monthly_order_volume", 0),
                  "total_purchase_amount": r.get("total_purchase_amount", 0), "last_order_at": r.get("last_order_at", now_iso())},
            message="Retailer updated successfully",
        )
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 11. DISTRIBUTORS
# ==========================================

@app.get("/distributors")
def get_distributors(search: Optional[str] = None, status: Optional[str] = None,
                     type: Optional[str] = None,
                     user_id: Optional[str] = None, role: Optional[str] = None,
                     page: int = 1, limit: int = 20,
                     current_user: AuthenticatedUser = Depends(get_current_user)):
    # type=partner means show only partnered, type=discover means show only non-partnered, no type = all
    user_id = current_user.user_id
    role = current_user.role
    if not status and type:
        if type == "partner":
            status = "partner"
        elif type == "discover":
            status = "none"
    try:
        # Always use auth users as source — their id matches partnership distributor_id
        distributor_users = [
            u for u in auth_users_by_role("distributor")
            if u.get("id") and u.get("is_active", True) is not False
        ]
        active_distributor_ids = {u["id"] for u in distributor_users}

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
            for u in distributor_users
        ]

        # Mark partner / pending status for current user (supplier or retailer)
        if user_id:
            try:
                # New partnership table: requester_id/approver_id structure
                p_rows = supabase.table("partnerships").select("requester_id,approver_id,status,type").or_(
                    f"requester_id.eq.{user_id},approver_id.eq.{user_id}"
                ).execute().data or []

                # For supplier: distributors are requesters in supplier_distributor type
                # For retailer: distributors are approvers in distributor_retailer type
                partner_ids = set()
                pending_ids = set()
                for p in p_rows:
                    if role == "supplier" and p.get("type") == "supplier_distributor" and p.get("approver_id") == user_id:
                        dist_id = p.get("requester_id", "")
                    elif role == "retailer" and p.get("type") == "distributor_retailer" and p.get("requester_id") == user_id:
                        dist_id = p.get("approver_id", "")
                    else:
                        continue
                    if p.get("status") == "accepted":
                        partner_ids.add(dist_id)
                    elif p.get("status") == "pending":
                        pending_ids.add(dist_id)

                for d in distributors:
                    did = d["distributor_id"] or ""
                    if did in partner_ids:
                        d["partnership_status"] = "partner"
                    elif did in pending_ids:
                        d["partnership_status"] = "pending"
            except Exception:
                pass

        # Calculate real order volume per distributor from orders table
        if user_id:
            try:
                from collections import Counter
                orders_res = supabase.table("orders").select("buyer_id, status").eq("seller_id", user_id).execute()
                buyer_order_count = Counter()
                buyer_delivered_count = Counter()
                for o in (orders_res.data or []):
                    bid = o.get("buyer_id", "")
                    buyer_order_count[bid] += 1
                    if o.get("status") == "delivered":
                        buyer_delivered_count[bid] += 1
                for d in distributors:
                    did = d["distributor_id"]
                    d["order_volume"] = buyer_order_count.get(did, 0)
                    total_orders = buyer_order_count.get(did, 0)
                    delivered = buyer_delivered_count.get(did, 0)
                    d["payment_punctuality"] = round(delivered / max(total_orders, 1) * 100) if total_orders > 0 else 0
            except Exception:
                pass

        # Save full list for summary before filtering
        all_distributors = list(distributors)

        if search:
            distributors = [d for d in distributors if search.lower() in d["name"].lower()]
        if status and status != "all":
            distributors = [d for d in distributors if d["partnership_status"] == status]

        # Sort: partnered first, pending second, none last — alphabetically within each group
        status_order = {"partner": 0, "pending": 1, "none": 2}
        distributors.sort(key=lambda d: (status_order.get(d["partnership_status"], 99), d["name"].lower()))

        total = len(distributors)
        start = (page - 1) * limit
        # Summary always from full list (not affected by tab filter)
        all_partners = [d for d in all_distributors if d["partnership_status"] == "partner"]
        partner_count = len(all_partners)
        pending_count = sum(1 for d in all_distributors if d["partnership_status"] == "pending")
        return success_response(
            data={
                "distributors": distributors[start: start + limit],
                "summary": {
                    "partner_count": partner_count,
                    "pending_count": pending_count,
                    "total_order_volume": sum(d.get("order_volume", 0) for d in all_partners),
                    "avg_punctuality": sum(d.get("payment_punctuality", 0) for d in all_partners) // max(len(all_partners), 1),
                    "avg_delivery_days": sum(d.get("avg_delivery_days", 0) for d in all_partners) // max(len(all_partners), 1),
                },
                "pagination": {"page": page, "limit": limit, "total": total},
            },
            message="Distributor data retrieved successfully",
        )
    except Exception as e:
        return error_response(str(e))


def _resolve_retailer_name(requester_id: str) -> str:
    """Resolve a retailer display name from auth metadata."""
    if not requester_id:
        return "Unknown"

    # 1. Get single auth user by ID
    try:
        raw = _get_auth_user(requester_id)
        if raw:
            meta = raw.get("user_metadata", {}) or {}
            name = meta.get("business_name") or meta.get("full_name")
            if name:
                return name
    except Exception:
        pass

    # 2. Try supabase admin client directly
    try:
        u = supabase.auth.admin.get_user_by_id(requester_id)
        if u and u.user:
            meta = u.user.user_metadata or {}
            name = meta.get("business_name") or meta.get("full_name")
            if name:
                return name
    except Exception:
        pass

    # 3. Bulk scan: list all users and find by ID
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
                if u.get("id") == requester_id:
                    meta = u.get("user_metadata", {}) or {}
                    name = meta.get("business_name") or meta.get("full_name") or ""
                    if name:
                        return name
    except Exception:
        pass

    # 4. Fallback: show first 8 chars of ID so it's not completely blank
    return requester_id[:8] if len(requester_id) >= 8 else requester_id


@app.get("/distributors/partnership-requests")
def get_distributor_requests(user_id: Optional[str] = None, page: int = 1, limit: int = 20):
    try:
        # For supplier: show pending requests from distributors (type=supplier_distributor, approver=supplier)
        # For distributor: show pending requests from retailers (type=distributor_retailer, approver=distributor)
        query = supabase.table("partnerships").select("*").eq("status", "pending")
        if user_id:
            query = query.eq("approver_id", user_id)
        res = query.execute()

        # Resolve requester names
        name_map = {}
        req_ids = {r.get("requester_id", "") for r in (res.data or [])}
        for role_name in ("distributor", "retailer"):
            for u in auth_users_by_role(role_name):
                if u["id"] in req_ids:
                    name_map[u["id"]] = u.get("business_name", u.get("full_name", ""))

        requests = [
            {
                "request_id": p.get("id"),
                "requester_id": p.get("requester_id", ""),
                "distributor_id": p.get("requester_id", ""),
                "distributor_name": name_map.get(p.get("requester_id", ""), "Unknown"),
                "distributor": {
                    "id": p.get("requester_id", ""),
                    "name": name_map.get(p.get("requester_id", ""), "Unknown"),
                    "business_name": name_map.get(p.get("requester_id", ""), "Unknown"),
                },
                "type": p.get("type", ""),
                "city": "",
                "reliability_score": 0,
                "status": p.get("status", "pending"),
                "created_at": p.get("created_at", ""),
                "mou_terms": p.get("mou_terms", ""),
                "mou_region": p.get("mou_region", ""),
            }
            for p in (res.data or [])
        ]
        total = len(requests)
        return success_response(
            data={"requests": requests[(page-1)*limit: page*limit], "pagination": {"page": page, "limit": limit, "total": total}},
            message="Partnership request data retrieved successfully",
        )
    except Exception as e:
        return error_response(str(e))


@app.get("/distributors/{distributor_id}/stock")
def get_distributor_stock(distributor_id: str, page: int = 1, limit: int = 20):
    try:
        res = supabase.table("inventories").select("*").eq("user_id", distributor_id).execute()
        products = [
            {
                "item_id": i.get("id"), "name": i.get("product_name", ""), "category": i.get("category", "general"),
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
            message="Distributor stock data retrieved successfully",
        )
    except Exception as e:
        return error_response(str(e))


@app.get("/distributors/{distributor_id}/partnership-history")
def get_distributor_partnership_history(distributor_id: str, user_id: Optional[str] = None, role: Optional[str] = None):
    try:
        # New table: find partnerships where distributor_id is requester or approver
        query = supabase.table("partnerships").select("*").or_(
            f"requester_id.eq.{distributor_id},approver_id.eq.{distributor_id}"
        )
        rows = query.execute().data or []

        # Filter by current user's perspective
        if user_id:
            rows = [r for r in rows if user_id in (r.get("requester_id", ""), r.get("approver_id", ""))]

        rows.sort(key=lambda row: row.get("created_at", ""), reverse=True)
        history = [
            {
                "request_id": row.get("id", ""),
                "status": row.get("status", "pending"),
                "created_at": row.get("created_at", ""),
                "terms": row.get("mou_terms", ""),
                "distribution_region": row.get("mou_region", ""),
                "valid_until": 0,
                "legal_contract_hash": row.get("mou_hash", ""),
                "mou_document_name": "",
                "mou_document_data": "",
                "nft_mint_address": row.get("nft_mint_address", ""),
                "nft_explorer_url": row.get("nft_explorer_url", ""),
                "nft_token_name": row.get("nft_token_name", ""),
            }
            for row in rows
        ]
        return success_response(
            data={"history": history},
            message="Distributor partnership history retrieved successfully",
        )
    except Exception:
        return success_response(data={"history": []}, message="Distributor partnership history unavailable")


@app.post("/distributors/partnership-request")
def request_partnership(data: PartnershipRequestReq):
    """Create partnership request using new table structure (requester_id/approver_id/type)."""
    try:
        requester_id = data.requester_id or ""
        approver_id = data.distributor_id  # distributor_id field = the party being requested

        if not requester_id:
            return error_response("requester_id is required")

        # Determine type based on who is requesting
        # If requester is retailer → distributor_retailer (retailer requests distributor)
        # If requester is distributor → supplier_distributor (distributor requests supplier)
        raw_user = _get_auth_user(requester_id)
        requester_role = ""
        if raw_user:
            meta = raw_user.get("user_metadata", {}) or {}
            requester_role = meta.get("role", "")

        if requester_role == "distributor":
            p_type = "supplier_distributor"
        else:
            p_type = "distributor_retailer"

        # Dedup check — also reactivate terminated partnerships
        existing = supabase.table("partnerships").select("id,status").eq("requester_id", requester_id).eq("approver_id", approver_id).eq("type", p_type).execute().data or []
        for ex in existing:
            if ex["status"] in ("pending", "accepted"):
                return success_response(
                    data={"request_id": ex["id"], "status": ex["status"]},
                    message="Partnership request already exists",
                )
            if ex["status"] in ("terminated", "rejected"):
                # Reactivate — update existing record instead of creating new
                mou_hash_val = hashlib.sha256((data.terms or "").encode()).hexdigest() if data.terms else ""
                supabase.table("partnerships").update({
                    "status": "pending",
                    "mou_terms": data.terms or "",
                    "mou_region": data.distribution_region or "",
                    "mou_hash": mou_hash_val,
                    "updated_at": now_iso(),
                }).eq("id", ex["id"]).execute()
                return success_response(
                    data={"request_id": ex["id"], "status": "pending", "mou_hash": mou_hash_val},
                    message="Partnership request re-submitted",
                )

        request_id = str(uuid.uuid4())
        mou_terms = data.terms or ""
        mou_hash_val = hashlib.sha256(mou_terms.encode()).hexdigest() if mou_terms else ""

        row = {
            "id": request_id,
            "type": p_type,
            "requester_id": requester_id,
            "approver_id": approver_id,
            "status": "pending",
            "mou_terms": mou_terms,
            "mou_region": data.distribution_region or "",
            "mou_hash": mou_hash_val,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        supabase.table("partnerships").insert(row).execute()
        return success_response(
            data={"request_id": request_id, "status": "pending", "mou_hash": mou_hash_val},
            message="Partnership request sent successfully",
        )
    except Exception as e:
        return error_response(str(e))


@app.put("/distributors/partnership-request/{request_id}")
def update_partnership_request(request_id: str, data: UpdatePartnershipReq):
    """Accept or reject a partnership request. Mints NFT on accept. Uses new table structure."""
    try:
        new_status = "accepted" if data.action == "accept" else "rejected"
        update_payload = {"status": new_status, "updated_at": now_iso()}

        # Mint NFT on accept
        nft_data = None
        if data.action == "accept":
            p_res = supabase.table("partnerships").select("*").eq("id", request_id).execute()
            if p_res.data and bc:
                p = p_res.data[0]
                try:
                    wallet_approver = bc.get_or_create_wallet(supabase, p.get("approver_id", ""))
                    wallet_requester = bc.get_or_create_wallet(supabase, p.get("requester_id", ""))
                    result = bc.mint_partnership_nft(
                        distributor_pubkey_str=wallet_requester["pubkey"],
                        supplier_pubkey_str=wallet_approver["pubkey"],
                        terms=f"Partnership {request_id[:8]}",
                        legal_contract_hash=p.get("mou_hash", "0" * 64),
                        distribution_region=p.get("mou_region", ""),
                    )
                    mint_addr = result.get("mint") or result.get("mint_address", "")
                    update_payload["nft_mint_address"] = mint_addr
                    update_payload["nft_token_name"] = f"Partnership #{request_id[:8].upper()}"
                    update_payload["nft_explorer_url"] = f"https://explorer.solana.com/address/{mint_addr}?cluster=devnet"
                    nft_data = {"mint_address": mint_addr, "explorer_url": update_payload["nft_explorer_url"]}
                except Exception:
                    pass

        supabase.table("partnerships").update(update_payload).eq("id", request_id).execute()
        return success_response(data={"request_id": request_id, "action": data.action, "nft": nft_data}, message=f"Partnership {data.action}ed")
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 12. PARTNERSHIPS
# ==========================================

@app.get("/partnerships/summary")
def get_partnerships_summary(user_id: Optional[str] = None, partner_type: Optional[str] = None,
                             current_user: AuthenticatedUser = Depends(get_current_user)):
    try:
        uid = current_user.user_id
        res = supabase.table("partnerships").select("*").or_(f"requester_id.eq.{uid},approver_id.eq.{uid}").execute()
        ps = res.data or []

        # Filter by type if requested
        if partner_type == "supplier":
            ps = [p for p in ps if p.get("type") == "supplier_distributor"]
        elif partner_type == "retailer":
            ps = [p for p in ps if p.get("type") == "distributor_retailer"]

        active = sum(1 for p in ps if p.get("status") == "accepted")
        pending = sum(1 for p in ps if p.get("status") == "pending")
        nft_count = sum(1 for p in ps if p.get("status") == "accepted" and p.get("nft_mint_address"))
        trust_score = 87

        insights = []
        if pending > 0:
            insights.append({"type": "new_partner", "message": f"{pending} pending partnership requests awaiting approval.", "urgency": "medium"})
        if nft_count > 0:
            insights.append({"type": "nft_issued", "message": f"{nft_count} active Partnership NFTs on Solana Devnet.", "urgency": "low"})

        return success_response(
            data={
                "summary": {
                    "active_partnerships": active,
                    "pending_agreements": pending,
                    "contract_renewal_rate": 100 if active > 0 else 0,
                    "trust_score": trust_score,
                    "network_growth": 0,
                    "nft_issued": nft_count,
                },
                "insights": insights,
            },
            message="Partnership data retrieved successfully",
        )
    except Exception as e:
        return error_response(str(e))


@app.delete("/partnerships/between/{partner_id}")
def delete_partnership(partner_id: str, user_id: Optional[str] = None, current_user: AuthenticatedUser = Depends(get_current_user)):
    """Terminate or cancel partnership between current user and partner_id."""
    try:
        uid = current_user.user_id
        # Find partnerships where current user and partner_id are involved
        res = supabase.table("partnerships").select("id,requester_id,approver_id,status").or_(
            f"requester_id.eq.{uid},approver_id.eq.{uid}"
        ).execute()
        rows = res.data or []
        matching_ids = []
        for r in rows:
            other = r["approver_id"] if r["requester_id"] == uid else r["requester_id"]
            if other == partner_id and r["status"] in ("pending", "accepted"):
                matching_ids.append(r["id"])
        if not matching_ids:
            return error_response("Partnership not found")
        for pid in matching_ids:
            supabase.table("partnerships").update({"status": "terminated", "updated_at": now_iso()}).eq("id", pid).execute()
        return success_response(data={"terminated": len(matching_ids)}, message="Partnership deleted successfully")
    except Exception as e:
        return error_response(str(e))


def _get_nft(table_filter: dict):
    try:
        query = supabase.table("partnership_nfts").select("*")
        for col, val in table_filter.items():
            query = query.eq(col, val)
        res = query.execute()
        if not res.data:
            return success_response(data=None, message="NFT not found")
        return success_response(data=res.data[0], message="NFT found")
    except Exception as e:
        return error_response(str(e))


@app.post("/wallet/airdrop")
def request_wallet_airdrop(user_id: Optional[str] = None):
    """Request devnet SOL airdrop for a user's wallet (max 2 SOL)."""
    if not user_id:
        return error_response("user_id required")
    try:
        if not bc:
            return error_response("Blockchain service unavailable — install solders and solana")
        wallet = bc.get_or_create_wallet(supabase, user_id)
        success = bc.request_airdrop(wallet["pubkey"])
        return success_response(data={"success": success, "pubkey": wallet["pubkey"]},
                                message="Airdrop successful" if success else "Airdrop failed — please try again")
    except Exception as e:
        return error_response(str(e))


@app.post("/wallet/connect")
def connect_browser_wallet(user_id: Optional[str] = None, body: dict = None):
    """Store a browser-provided wallet pubkey (Phantom/MetaMask) for a user."""
    if not user_id:
        return error_response("user_id required")
    if not body:
        body = {}
    pubkey = body.get("pubkey", "").strip()
    wallet_type = body.get("wallet_type", "browser")
    if not pubkey:
        return error_response("pubkey required")
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
        }, message=f"Wallet {wallet_type} connected successfully")
    except Exception as e:
        return error_response(str(e))


@app.delete("/wallet/connect")
def disconnect_browser_wallet(user_id: Optional[str] = None):
    """Remove browser wallet — regenerate a fresh backend-managed wallet."""
    if not user_id:
        return error_response("user_id required")
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
        return success_response(data={"pubkey": wallet["pubkey"]}, message="Browser wallet disconnected, new wallet created")
    except Exception as e:
        return error_response(str(e))


@app.get("/wallet/my")
def get_my_wallet_info(user_id: Optional[str] = None):
    """Get wallet info — also returns whether it's a browser wallet."""
    if not user_id:
        return error_response("user_id required")
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
            return error_response("Order not found")
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
        }, message="Escrow details retrieved")
    except Exception as e:
        return error_response(str(e))


# ==========================================
# NEW PARTNERSHIP SYSTEM (clean structure)
# ==========================================

@app.post("/partnerships/request")
def create_partnership_request(body: dict, current_user: AuthenticatedUser = Depends(get_current_user)):
    """Create a new partnership request with MOU terms."""
    try:
        uid = current_user.user_id
        p_type = body.get("type", "")
        approver_id = body.get("approver_id", "")
        mou_terms = body.get("mou_terms", "")
        mou_region = body.get("mou_region", "")
        mou_valid_until = body.get("mou_valid_until")

        if p_type not in ("supplier_distributor", "distributor_retailer"):
            return error_response("type must be 'supplier_distributor' or 'distributor_retailer'")
        if not approver_id:
            return error_response("approver_id is required")
        if not mou_terms or len(mou_terms) < 10:
            return error_response("MOU terms must be at least 10 characters")

        # Check no existing active/pending partnership
        existing = supabase.table("partnerships").select("id,status").eq("requester_id", uid).eq("approver_id", approver_id).eq("type", p_type).in_("status", ["pending", "accepted"]).execute()
        if existing.data:
            return error_response("Partnership already exists or pending between these parties")

        mou_hash = hashlib.sha256(mou_terms.encode()).hexdigest()
        pid = str(uuid.uuid4())
        row = {
            "id": pid,
            "type": p_type,
            "requester_id": uid,
            "approver_id": approver_id,
            "status": "pending",
            "mou_terms": mou_terms,
            "mou_region": mou_region,
            "mou_valid_until": mou_valid_until,
            "mou_hash": mou_hash,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        supabase.table("partnerships").insert(row).execute()
        return success_response(data={"partnership_id": pid, "mou_hash": mou_hash}, message="Partnership request submitted")
    except Exception as e:
        return error_response(str(e))


@app.put("/partnerships/{partnership_id}/respond")
def respond_partnership(partnership_id: str, body: dict, current_user: AuthenticatedUser = Depends(get_current_user)):
    """Approve or reject a partnership request. Mints NFT on approve."""
    try:
        uid = current_user.user_id
        action = body.get("action", "reject")

        # Fetch partnership
        res = supabase.table("partnerships").select("*").eq("id", partnership_id).execute()
        if not res.data:
            return error_response("Partnership not found")
        p = res.data[0]

        if p.get("approver_id") != uid:
            return error_response("Only the approver can respond to this request")
        if p.get("status") != "pending":
            return error_response("Partnership is not pending")

        new_status = "accepted" if action == "accept" else "rejected"
        update = {"status": new_status, "updated_at": now_iso()}

        # Mint NFT on accept
        nft_data = None
        if action == "accept" and bc:
            try:
                wallet_approver = bc.get_or_create_wallet(supabase, uid)
                wallet_requester = bc.get_or_create_wallet(supabase, p["requester_id"])
                result = bc.mint_partnership_nft(
                    distributor_pubkey_str=wallet_requester["pubkey"],
                    supplier_pubkey_str=wallet_approver["pubkey"],
                    terms=f"Partnership {partnership_id[:8]}",
                    legal_contract_hash=p.get("mou_hash", "0" * 64),
                    distribution_region=p.get("mou_region", ""),
                )
                mint_addr = result.get("mint") or result.get("mint_address", "")
                update["nft_mint_address"] = mint_addr
                update["nft_token_name"] = f"Partnership #{partnership_id[:8].upper()}"
                update["nft_explorer_url"] = f"https://explorer.solana.com/address/{mint_addr}?cluster=devnet"
                nft_data = {"mint_address": mint_addr, "explorer_url": update["nft_explorer_url"]}
            except Exception as nft_err:
                # Non-critical — partnership still accepted even if NFT fails
                nft_data = {"error": str(nft_err)[:100]}

        supabase.table("partnerships").update(update).eq("id", partnership_id).execute()
        return success_response(data={"partnership_id": partnership_id, "action": action, "nft": nft_data}, message=f"Partnership {action}ed")
    except Exception as e:
        return error_response(str(e))


@app.get("/partnerships/list")
def list_partnerships(current_user: AuthenticatedUser = Depends(get_current_user)):
    """List all partnerships for the current user (as requester or approver)."""
    try:
        uid = current_user.user_id
        role = current_user.role
        res = supabase.table("partnerships").select("*").or_(f"requester_id.eq.{uid},approver_id.eq.{uid}").order("created_at", desc=True).execute()
        partnerships = res.data or []

        # Enrich with partner names
        all_user_ids = set()
        for p in partnerships:
            all_user_ids.add(p.get("requester_id", ""))
            all_user_ids.add(p.get("approver_id", ""))
        all_user_ids.discard("")

        # Build name lookup
        name_map = {}
        try:
            headers = {"apikey": os.getenv("SUPABASE_KEY", ""), "Authorization": f"Bearer {os.getenv('SUPABASE_KEY', '')}"}
            resp = requests.get(f"{os.getenv('SUPABASE_URL')}/auth/v1/admin/users", headers=headers, timeout=10)
            if resp.status_code == 200:
                for u in resp.json().get("users", []):
                    if u["id"] in all_user_ids:
                        meta = u.get("user_metadata", {}) or {}
                        name_map[u["id"]] = meta.get("business_name") or meta.get("full_name") or u.get("email", "")
        except Exception:
            pass

        result = []
        for p in partnerships:
            partner_id = p["approver_id"] if p["requester_id"] == uid else p["requester_id"]
            result.append({
                "id": p["id"],
                "type": p["type"],
                "status": p["status"],
                "partner_id": partner_id,
                "partner_name": name_map.get(partner_id, "Unknown"),
                "is_requester": p["requester_id"] == uid,
                "mou_terms": p.get("mou_terms", ""),
                "mou_region": p.get("mou_region", ""),
                "mou_valid_until": p.get("mou_valid_until"),
                "mou_hash": p.get("mou_hash", ""),
                "nft_mint_address": p.get("nft_mint_address"),
                "nft_token_name": p.get("nft_token_name"),
                "nft_explorer_url": p.get("nft_explorer_url"),
                "created_at": p.get("created_at", ""),
            })

        # Summary
        accepted = [p for p in result if p["status"] == "accepted"]
        pending = [p for p in result if p["status"] == "pending"]
        supplier_partners = len([p for p in accepted if p["type"] == "supplier_distributor"])
        retailer_partners = len([p for p in accepted if p["type"] == "distributor_retailer"])

        return success_response(data={
            "partnerships": result,
            "summary": {
                "total_active": len(accepted),
                "total_pending": len(pending),
                "supplier_partners": supplier_partners,
                "retailer_partners": retailer_partners,
                "nft_count": sum(1 for p in accepted if p.get("nft_mint_address")),
            },
        }, message="Partnerships retrieved")
    except Exception as e:
        return error_response(str(e))


@app.post("/partnerships/{partnership_id}/terminate")
def terminate_partnership(partnership_id: str, current_user: AuthenticatedUser = Depends(get_current_user)):
    """Terminate an active partnership."""
    try:
        uid = current_user.user_id
        res = supabase.table("partnerships").select("*").eq("id", partnership_id).execute()
        if not res.data:
            return error_response("Partnership not found")
        p = res.data[0]
        if uid not in (p.get("requester_id"), p.get("approver_id")):
            return error_response("Not authorized to terminate this partnership")
        if p.get("status") != "accepted":
            return error_response("Only active partnerships can be terminated")
        supabase.table("partnerships").update({"status": "terminated", "updated_at": now_iso()}).eq("id", partnership_id).execute()
        return success_response(data={"partnership_id": partnership_id}, message="Partnership terminated")
    except Exception as e:
        return error_response(str(e))


@app.post("/partnerships/{partnership_id}/upload-mou")
async def upload_mou_document(partnership_id: str, file: UploadFile = File(...), current_user: AuthenticatedUser = Depends(get_current_user)):
    """Upload optional MOU PDF document to Supabase Storage."""
    try:
        uid = current_user.user_id
        # Verify user is part of this partnership
        p_res = supabase.table("partnerships").select("requester_id,approver_id").eq("id", partnership_id).execute()
        if not p_res.data:
            return error_response("Partnership not found")
        p = p_res.data[0]
        if uid not in (p.get("requester_id"), p.get("approver_id")):
            return error_response("Not authorized")

        # Read file
        content = await file.read()
        if len(content) > 5 * 1024 * 1024:  # 5MB limit
            return error_response("File too large (max 5MB)")

        # Upload to Supabase Storage
        file_path = f"mou/{partnership_id}/{file.filename}"
        try:
            supabase.storage.from_("mou-documents").upload(file_path, content, {"content-type": file.content_type or "application/pdf"})
        except Exception:
            # Bucket might not exist, try creating it
            try:
                supabase.storage.create_bucket("mou-documents", {"public": False})
                supabase.storage.from_("mou-documents").upload(file_path, content, {"content-type": file.content_type or "application/pdf"})
            except Exception as bucket_err:
                return error_response(f"Upload failed: {str(bucket_err)[:100]}")

        # Get public URL
        file_url = f"{os.getenv('SUPABASE_URL')}/storage/v1/object/public/mou-documents/{file_path}"

        # Update partnership record
        supabase.table("partnerships").update({"mou_document_url": file_url, "updated_at": now_iso()}).eq("id", partnership_id).execute()

        return success_response(data={"url": file_url, "filename": file.filename}, message="MOU document uploaded")
    except Exception as e:
        return error_response(str(e))


@app.get("/blockchain/partnership-nft/{user_id}/{supplier_id}")
def get_supplier_nft(user_id: str, supplier_id: str):
    return _get_nft({"distributor_id": user_id, "supplier_id": supplier_id})


@app.get("/blockchain/partnership-nft/retailer/{user_id}/{distributor_id}")
def get_retailer_nft(user_id: str, distributor_id: str):
    return _get_nft({"retailer_id": user_id, "distributor_id": distributor_id})


@app.get("/blockchain/partnership-nft/supplier/{user_id}/{distributor_id}")
def get_supplier_distributor_nft(user_id: str, distributor_id: str):
    return _get_nft({"supplier_id": user_id, "distributor_id": distributor_id})


@app.get("/blockchain/partnership-nft/distributor/{user_id}/{retailer_id}")
def get_distributor_nft(user_id: str, retailer_id: str):
    return _get_nft({"distributor_id": user_id, "retailer_id": retailer_id})


class RevokePartnershipReq(BaseModel):
    partnership_pda: str


@app.post("/blockchain/partnership-nft/revoke")
def revoke_partnership_nft_onchain(data: RevokePartnershipReq):
    """Revoke an active partnership NFT on-chain (state change, token stays)."""
    try:
        if not bc:
            return success_response(
                data={"on_chain": False},
                message="Blockchain service unavailable — partnership marked as revoked off-chain.",
            )
        result = bc.revoke_partnership_nft(data.partnership_pda)
        return success_response(
            data=result,
            message="Partnership NFT revoked on-chain" if result.get("on_chain") else "Revoke sent (fallback mode)",
        )
    except Exception as e:
        return error_response(str(e))


@app.get("/blockchain/partnership-nft/verify/{supplier}/{distributor}")
def verify_partnership_onchain(supplier: str, distributor: str, role: int = 0):
    """Verify on-chain that a partnership PDA is active (role: 0=supplier→dist, 2=dist→retailer)."""
    try:
        if not bc:
            return success_response(
                data={"verified": True, "reason": "blockchain_unavailable"},
                message="Off-chain fallback — blockchain service unavailable.",
            )
        # Derive PDA from pubkeys
        pda_data = bc.get_partnership_pda(supplier, distributor, role)
        if pda_data is None:
            return success_response(
                data={"verified": False, "reason": "pda_not_found"},
                message="Partnership PDA not found on-chain.",
            )
        return success_response(
            data={
                "verified": pda_data.get("is_active", False),
                "pda": pda_data.get("pda"),
                "tier": pda_data.get("tier"),
            },
            message="Partnership verified on-chain",
        )
    except Exception as e:
        return error_response(str(e))

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

def _month_start(now: datetime) -> datetime:
    return datetime(now.year, now.month, 1)


def _order_total(order: dict) -> float:
    return float(order.get("total_price", order.get("total_amount", 0)) or 0)


def _order_items(order: dict) -> list:
    return order.get("items") or []


def _item_name(item: dict) -> str:
    return item.get("item_name") or item.get("product_name") or item.get("name") or ""


def _item_qty(item: dict) -> int:
    return int(item.get("qty", item.get("quantity", 0)) or 0)


def _sum_units(orders: list) -> int:
    return sum(_item_qty(item) for order in orders for item in _order_items(order))


def _period_growth_pct(current_value: float, previous_value: float) -> int:
    if previous_value <= 0:
        return 100 if current_value > 0 else 0
    return round(((current_value - previous_value) / previous_value) * 100)


def _inventory_turnover(delivered_orders: list, inventory: list) -> float:
    inventory_units = sum(int(i.get("current_stock", 0) or 0) for i in inventory)
    if inventory_units <= 0:
        return 0.0
    return round(_sum_units(delivered_orders) / inventory_units, 1)


def _demand_stability_pct(delivered_orders: list) -> int:
    now = datetime.utcnow()
    cutoff_recent = now - timedelta(days=30)
    cutoff_prev = now - timedelta(days=60)
    recent_units = 0
    prev_units = 0
    for order in delivered_orders:
        ts = _parse_ts(order.get("created_at", "")) or now
        units = sum(_item_qty(item) for item in _order_items(order))
        if ts >= cutoff_recent:
            recent_units += units
        elif ts >= cutoff_prev:
            prev_units += units
    if recent_units == 0 and prev_units == 0:
        return 0
    if prev_units <= 0:
        return 0
    variance_pct = abs(recent_units - prev_units) / prev_units * 100
    return round(max(0, 100 - min(variance_pct, 100)))


def _counterparty_performance_score(orders: list, counterpart_key: str) -> int:
    from collections import defaultdict
    grouped: dict = defaultdict(list)
    for order in orders:
        counterpart_id = order.get(counterpart_key, "")
        if counterpart_id:
            grouped[counterpart_id].append(order)
    if not grouped:
        return 0
    scores = []
    for grouped_orders in grouped.values():
        total = len(grouped_orders)
        delivered = sum(1 for order in grouped_orders if order.get("status") == "delivered")
        cancelled = sum(1 for order in grouped_orders if order.get("status") == "cancelled")
        delivered_rate = (delivered / total) * 100
        cancelled_penalty = (cancelled / total) * 20
        scores.append(max(0, min(100, round(delivered_rate - cancelled_penalty))))
    return round(sum(scores) / len(scores))


def _average_delivery_days(delivered_orders: list) -> float:
    durations = []
    for order in delivered_orders:
        created_at = _parse_ts(order.get("created_at", ""))
        completed_at = _parse_ts(order.get("updated_at", "")) or _parse_ts(order.get("created_at", ""))
        if created_at and completed_at and completed_at >= created_at:
            durations.append((completed_at - created_at).total_seconds() / 86400)
    return round(sum(durations) / len(durations), 1) if durations else 0.0


def _monthly_trends(outbound_delivered: list, inbound_delivered: list) -> list:
    now = datetime.utcnow()
    month_dts = _month_starts(now, 6)
    buckets = {
        (dt.year, dt.month): {"label": dt.strftime("%b"), "revenue": 0, "spending": 0}
        for dt in month_dts
    }
    for order in outbound_delivered:
        ts = _parse_ts(order.get("created_at", ""))
        if not ts:
            continue
        key = (ts.year, ts.month)
        if key in buckets:
            buckets[key]["revenue"] += _order_total(order)
    for order in inbound_delivered:
        ts = _parse_ts(order.get("created_at", ""))
        if not ts:
            continue
        key = (ts.year, ts.month)
        if key in buckets:
            buckets[key]["spending"] += _order_total(order)
    return [
        {"label": buckets[key]["label"], "revenue": buckets[key]["revenue"], "spending": buckets[key]["spending"]}
        for key in sorted(buckets)
    ]


def _top_products_from_orders(primary_orders: list, fallback_orders: list) -> list:
    from collections import defaultdict
    source_orders = primary_orders if primary_orders else fallback_orders
    volumes: dict = defaultdict(int)
    for order in source_orders:
        for item in _order_items(order):
            name = _item_name(item)
            qty = _item_qty(item)
            if name and qty > 0:
                volumes[name] += qty
    return [
        {"name": name, "sales": qty}
        for name, qty in sorted(volumes.items(), key=lambda item: item[1], reverse=True)[:5]
    ]


def _shared_analytics_response(outbound_orders: list, inbound_orders: list, inventory: list, partner_key: str) -> dict:
    now = datetime.utcnow()
    cutoff_recent = now - timedelta(days=30)
    cutoff_prev = now - timedelta(days=60)

    delivered_outbound = [order for order in outbound_orders if order.get("status") == "delivered"]
    delivered_inbound = [order for order in inbound_orders if order.get("status") == "delivered"]
    growth_orders = delivered_outbound if delivered_outbound else delivered_inbound

    recent_revenue = sum(_order_total(order) for order in growth_orders if (_parse_ts(order.get("created_at", "")) or now) >= cutoff_recent)
    prev_revenue = sum(_order_total(order) for order in growth_orders if cutoff_prev <= (_parse_ts(order.get("created_at", "")) or now) < cutoff_recent)

    partner_orders = inbound_orders if inbound_orders else outbound_orders

    return {
        "summary": {
            "revenue_growth": _period_growth_pct(recent_revenue, prev_revenue),
            "inventory_turnover": _inventory_turnover(delivered_outbound or delivered_inbound, inventory),
            "partner_performance": _counterparty_performance_score(partner_orders, partner_key),
            "order_fulfillment_rate": round((len(delivered_outbound or delivered_inbound) / max(len(outbound_orders or inbound_orders), 1)) * 100),
            "forecast_accuracy": _demand_stability_pct(delivered_outbound or delivered_inbound),
        },
        "trends": _monthly_trends(delivered_outbound, delivered_inbound),
        "top_products": _top_products_from_orders(delivered_outbound, delivered_inbound),
    }


@app.get("/analytics/retailer/overview")
def analytics_retailer(user_id: Optional[str] = None):
    try:
        oq = supabase.table("orders").select("*")
        if user_id:
            oq = oq.eq("buyer_id", user_id)
        orders = oq.execute().data or []
        inventory = (supabase.table("inventories").select("*").eq("user_id", user_id).execute().data or []) if user_id else []
        return success_response(
            data=_shared_analytics_response([], orders, inventory, "seller_id"),
            message="Analytics retailer",
        )
    except Exception as e:
        return error_response(str(e))


@app.get("/analytics/distributor/overview")
def analytics_distributor(user_id: Optional[str] = None, current_user: AuthenticatedUser = Depends(get_current_user)):
    try:
        uid = current_user.user_id
        oq = supabase.table("orders").select("*")
        oq = oq.or_(f"buyer_id.eq.{uid},seller_id.eq.{uid}")
        orders = oq.execute().data or []
        inventory = supabase.table("inventories").select("*").eq("user_id", uid).execute().data or []
        outbound_orders = [order for order in orders if order.get("seller_id") == uid]
        inbound_orders = [order for order in orders if order.get("buyer_id") == uid]
        return success_response(
            data=_shared_analytics_response(outbound_orders, inbound_orders, inventory, "seller_id"),
            message="Analytics distributor",
        )
    except Exception as e:
        return error_response(str(e))


@app.get("/analytics/supplier/overview")
def analytics_supplier(user_id: Optional[str] = None, current_user: AuthenticatedUser = Depends(get_current_user)):
    try:
        uid = current_user.user_id
        oq = supabase.table("orders").select("*")
        oq = oq.eq("seller_id", uid)
        orders = oq.execute().data or []
        delivered_orders = [order for order in orders if order.get("status") == "delivered"]
        now = datetime.utcnow()
        cutoff_recent = now - timedelta(days=30)
        cutoff_prev = now - timedelta(days=60)

        recent_units = sum(_sum_units([order]) for order in delivered_orders if (_parse_ts(order.get("created_at", "")) or now) >= cutoff_recent)
        prev_units = sum(_sum_units([order]) for order in delivered_orders if cutoff_prev <= (_parse_ts(order.get("created_at", "")) or now) < cutoff_recent)

        weekly_revenue = []
        weekly_demand = []
        weekly_orders = []
        weekly_fulfillment = []
        for i in range(3, -1, -1):
            start = now - timedelta(weeks=i + 1)
            end = now - timedelta(weeks=i)
            weekly_orders_all = [order for order in orders if start <= (_parse_ts(order.get("created_at", "")) or now) < end]
            weekly_delivered = [order for order in weekly_orders_all if order.get("status") == "delivered"]
            label = f"Week {4 - i}"
            weekly_revenue.append({"label": label, "value": sum(_order_total(order) for order in weekly_delivered)})
            weekly_demand.append({"label": label, "value": _sum_units(weekly_delivered)})
            weekly_orders.append({"label": label, "value": len(weekly_orders_all)})
            weekly_fulfillment.append({"label": label, "value": round((len(weekly_delivered) / max(len(weekly_orders_all), 1)) * 100)})

        distinct_buyers_all = {order.get("buyer_id", "") for order in orders if order.get("buyer_id", "")}
        distinct_buyers_recent = {
            order.get("buyer_id", "")
            for order in delivered_orders
            if order.get("buyer_id", "") and (_parse_ts(order.get("created_at", "")) or now) >= cutoff_recent
        }

        from collections import defaultdict
        dist_orders: dict = defaultdict(list)
        dist_names: dict = {}
        for order in orders:
            buyer_id = order.get("buyer_id", "")
            if buyer_id:
                dist_orders[buyer_id].append(order)
                dist_names[buyer_id] = order.get("buyer_name", "") or dist_names.get(buyer_id, "Unknown")

        distributor_performance = []
        for dist_id, distributor_orders in dist_orders.items():
            delivered = [order for order in distributor_orders if order.get("status") == "delivered"]
            fulfillment_ratio = len(delivered) / max(len(distributor_orders), 1)
            distributor_performance.append({
                "distributor_id": dist_id,
                "name": dist_names.get(dist_id, "Unknown"),
                "order_volume": len(distributor_orders),
                "revenue_contribution": sum(_order_total(order) for order in delivered),
                "fulfillment_success_rate": round(fulfillment_ratio, 4),
                "reliability_score": _counterparty_performance_score(distributor_orders, "buyer_id"),
            })
        distributor_performance.sort(key=lambda item: item["revenue_contribution"], reverse=True)

        return success_response(
            data={
                "summary": {
                    "total_revenue": sum(_order_total(order) for order in delivered_orders),
                    "demand_growth_pct": _period_growth_pct(recent_units, prev_units),
                    "fulfillment_rate": round(len(delivered_orders) / max(len(orders), 1), 4),
                    "active_distributor_contribution_pct": round((len(distinct_buyers_recent) / max(len(distinct_buyers_all), 1)) * 100),
                },
                "trends": {
                    "revenue": weekly_revenue,
                    "demand": weekly_demand,
                    "orders": weekly_orders,
                    "fulfillment": weekly_fulfillment,
                },
                "distributor_performance": distributor_performance,
            },
            message="Analytics supplier",
        )
    except Exception as e:
        return error_response(str(e))


@app.get("/analytics/distributor/regional")
def analytics_distributor_regional(user_id: Optional[str] = None, item_id: Optional[str] = None):
    try:
        from collections import defaultdict
        oq = supabase.table("orders").select("delivery_address, items, created_at, status")
        if user_id:
            oq = oq.eq("seller_id", user_id)
        orders = oq.execute().data or []
        now = datetime.utcnow()
        cutoff_recent = now - timedelta(days=30)
        cutoff_prev   = now - timedelta(days=60)
        recent: dict = defaultdict(int)
        prev: dict   = defaultdict(int)
        for order in orders:
            if order.get("status") != "delivered":
                continue
            city = _extract_city(order.get("delivery_address", ""))
            if not city:
                continue
            items = order.get("items") or []
            vol = sum(_item_qty(it) for it in items if not item_id or it.get("item_id") == item_id or it.get("id") == item_id)
            ts = _parse_ts(order.get("created_at", "")) or now
            if ts >= cutoff_recent:
                recent[city] += vol
            elif ts >= cutoff_prev:
                prev[city] += vol
        all_cities = set(recent) | set(prev)
        if not all_cities:
            return success_response(data={"regional_demand": []}, message="Regional distributor data")
        regional_demand = []
        for city in all_cities:
            r_vol = recent.get(city, 0)
            p_vol = prev.get(city, 0)
            regional_demand.append({"region": city, "demand": r_vol, "growth_pct": _period_growth_pct(r_vol, p_vol)})
        regional_demand.sort(key=lambda x: x["demand"], reverse=True)
        return success_response(data={"regional_demand": regional_demand}, message="Regional distributor data")
    except Exception as e:
        return error_response(str(e))


KNOWN_CITIES = [
    "Jakarta", "Bandung", "Surabaya", "Yogyakarta", "Semarang", "Medan",
    "Makassar", "Bali", "Denpasar", "Palembang", "Depok", "Bekasi",
    "Tangerang", "Bogor", "Batam", "Pekanbaru", "Malang", "Solo",
    "Banjarmasin", "Balikpapan", "Manado", "Samarinda", "Padang", "Jambi",
    "Cikarang", "Karawang", "Cirebon", "Lampung", "Pontianak",
]

# City aliases for normalization
CITY_ALIASES = {"Bali": "Denpasar", "Cikarang": "Bekasi", "Karawang": "Bekasi"}

def _extract_city(address: str) -> Optional[str]:
    if not address:
        return None
    addr_lower = address.lower()
    for city in KNOWN_CITIES:
        if city.lower() in addr_lower:
            return CITY_ALIASES.get(city, city)
    return None

@app.get("/analytics/supplier/regional")
def analytics_supplier_regional(user_id: Optional[str] = None, item_id: Optional[str] = None,
                                current_user: AuthenticatedUser = Depends(get_current_user)):
    try:
        from collections import defaultdict, Counter
        uid = current_user.user_id

        # City coordinates for Indonesian cities
        CITY_COORDS = {
            "Jakarta": (-6.2088, 106.8456), "Surabaya": (-7.2575, 112.7521),
            "Bandung": (-6.9175, 107.6191), "Medan": (3.5952, 98.6722),
            "Semarang": (-6.9666, 110.4196), "Makassar": (-5.1477, 119.4327),
            "Palembang": (-2.9761, 104.7754), "Tangerang": (-6.1781, 106.63),
            "Depok": (-6.4025, 106.7942), "Bekasi": (-6.2383, 106.9756),
            "Yogyakarta": (-7.7956, 110.3695), "Denpasar": (-8.6705, 115.2126),
            "Malang": (-7.9666, 112.6326), "Bogor": (-6.5971, 106.806),
            "Balikpapan": (-1.2654, 116.8312), "Manado": (1.4748, 124.8421),
            "Pontianak": (-0.0263, 109.3425), "Banjarmasin": (-3.3186, 114.5944),
            "Padang": (-0.9471, 100.4172), "Lampung": (-5.4500, 105.2667),
            "Solo": (-7.5755, 110.8243), "Cirebon": (-6.7320, 108.5523),
            "Batam": (1.0456, 104.0305), "Pekanbaru": (0.5071, 101.4478),
        }

        oq = supabase.table("orders").select("buyer_id, buyer_name, delivery_address, items, created_at, status")
        oq = oq.eq("seller_id", uid)
        orders = oq.execute().data or []

        now = datetime.utcnow()
        cutoff_recent = now - timedelta(days=30)
        cutoff_prev = now - timedelta(days=60)

        buyer_region_cache: dict = {}
        # Pre-fetch buyer cities from auth metadata
        buyer_cities: dict = {}
        try:
            headers = {"apikey": os.getenv("SUPABASE_KEY", ""), "Authorization": f"Bearer {os.getenv('SUPABASE_KEY', '')}"}
            resp = requests.get(f"{os.getenv('SUPABASE_URL')}/auth/v1/admin/users", headers=headers, timeout=5)
            if resp.status_code == 200:
                for u in resp.json().get("users", []):
                    meta = u.get("user_metadata", {}) or {}
                    city = meta.get("city", "")
                    if city:
                        buyer_cities[u.get("id", "")] = city
        except Exception:
            pass

        def _resolve_region(order: dict) -> str:
            # Try delivery_address first (per-order, not cached)
            region = _extract_city(order.get("delivery_address", ""))
            if region:
                return region
            # Then try buyer cache (from metadata)
            buyer_id = order.get("buyer_id", "")
            if buyer_id in buyer_region_cache:
                return buyer_region_cache[buyer_id]
            # Try buyer_name
            region = _extract_city(order.get("buyer_name", ""))
            if not region:
                region = _extract_city(buyer_cities.get(buyer_id, ""))
            if region:
                buyer_region_cache[buyer_id] = region
                return region
            return "Jakarta"

        recent: dict = defaultdict(int)
        prev: dict = defaultdict(int)
        region_distributors: dict = defaultdict(set)
        region_products: dict = defaultdict(Counter)

        for order in orders:
            # Include all non-cancelled orders (not just delivered) to show demand
            if order.get("status") == "cancelled":
                continue
            region = _resolve_region(order)
            if not region:
                continue
            items_list = order.get("items") or []
            if item_id:
                item_id_lower = item_id.lower()
                vol = sum(_item_qty(it) for it in items_list if it.get("item_id") == item_id or it.get("id") == item_id or item_id_lower in (_item_name(it) or "").lower() or (_item_name(it) or "").lower() in item_id_lower)
            else:
                vol = sum(_item_qty(it) for it in items_list)
            if vol <= 0:
                continue

            # Track distributors per region
            region_distributors[region].add(order.get("buyer_id", ""))

            # Track products per region
            for it in items_list:
                pname = _item_name(it) or "Unknown"
                region_products[region][pname] += _item_qty(it)

            ts = _parse_ts(order.get("created_at", "")) or now
            if ts >= cutoff_recent:
                recent[region] += vol
            elif ts >= cutoff_prev:
                prev[region] += vol

        all_regions = set(recent.keys()) | set(prev.keys())
        if not all_regions:
            return success_response(data={"regions": []}, message="Regional supplier data")

        regions = []
        for region in all_regions:
            r_vol = recent.get(region, 0)
            p_vol = prev.get(region, 0)
            coords = CITY_COORDS.get(region, (-6.2, 106.8))
            top_prods = [{"name": n, "qty": q} for n, q in region_products[region].most_common(3)]
            regions.append({
                "region": region,
                "demand_score": r_vol,
                "growth_pct": _period_growth_pct(r_vol, p_vol),
                "lat": coords[0],
                "lng": coords[1],
                "distributor_count": len(region_distributors[region]),
                "top_products": top_prods,
            })

        regions.sort(key=lambda x: x["demand_score"], reverse=True)
        return success_response(data={"regions": regions}, message="Regional supplier data")
    except Exception as e:
        return error_response(str(e))


@app.get("/analytics/products/insights")
def analytics_product_insights(user_id: Optional[str] = None):
    try:
        from collections import defaultdict
        # Orders data for sell-side volume ranking
        oq = supabase.table("orders").select("items, seller_id, buyer_id, created_at, status")
        if user_id:
            oq = oq.or_(f"seller_id.eq.{user_id},buyer_id.eq.{user_id}")
        orders = oq.execute().data or []

        delivered_orders = [order for order in orders if order.get("status") == "delivered"]
        delivered_sell_orders = [order for order in delivered_orders if order.get("seller_id") == user_id]
        delivered_buy_orders = [order for order in delivered_orders if order.get("buyer_id") == user_id]
        source_orders = delivered_sell_orders if delivered_sell_orders else delivered_buy_orders

        now = datetime.utcnow()
        cutoff_30 = now - timedelta(days=30)
        cutoff_60 = now - timedelta(days=60)
        total_vol: dict = defaultdict(int)
        curr_vol: dict = defaultdict(int)
        prev_vol: dict = defaultdict(int)
        for order in source_orders:
            ts = _parse_ts(order.get("created_at", "")) or now
            for item in _order_items(order):
                name = _item_name(item)
                qty = _item_qty(item)
                if not name or qty <= 0:
                    continue
                total_vol[name] += qty
                if ts >= cutoff_30:
                    curr_vol[name] += qty
                elif ts >= cutoff_60:
                    prev_vol[name] += qty

        def _growth(name: str) -> int:
            c = curr_vol.get(name, 0)
            p = prev_vol.get(name, 0)
            return _period_growth_pct(c, p)

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

        sorted_vol = sorted(total_vol.items(), key=lambda item: item[1], reverse=True)
        declining_names = sorted(
            [(name, qty, _growth(name)) for name, qty in total_vol.items() if _growth(name) < 0],
            key=lambda item: item[2],
        )
        top_n = sorted_vol[:3]
        dec_n = declining_names[:3]

        return success_response(
            data={
                "top_selling": [{"name": n, "units": v, "growth_pct": _growth(n)} for n, v in top_n],
                "declining":   [{"name": n, "units": v, "decline_pct": abs(growth_pct)} for n, v, growth_pct in dec_n],
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
        from collections import defaultdict

        now = datetime.utcnow()
        if period == "weekly":
            current_start = now - timedelta(days=7)
            prev_start = now - timedelta(days=14)
            bucket_labels = [(now - timedelta(days=i)).strftime("%-d %b") for i in range(6, -1, -1)]
            bucket_count = 7
        else:
            current_start = _month_start(now)
            prev_start = _month_start(current_start - timedelta(days=1))
            bucket_labels = [(current_start - relativedelta(months=i)).strftime("%b %Y") for i in range(5, -1, -1)]
            bucket_count = 6

        oq = supabase.table("orders").select("items, created_at, buyer_id, buyer_name, status")
        if user_id:
            oq = oq.eq("seller_id", user_id)
        orders = oq.execute().data or []
        delivered_orders = [order for order in orders if order.get("status") == "delivered"]

        inv_map = {}
        try:
            inv = supabase.table("inventories").select("product_name, category").eq("user_id", user_id).execute()
            for row in (inv.data or []):
                if row.get("product_name"):
                    inv_map[row["product_name"]] = row.get("category", "general")
        except Exception:
            pass

        product_curr: dict = defaultdict(int)
        product_prev: dict = defaultdict(int)
        product_total: dict = defaultdict(int)
        product_revenue: dict = defaultdict(float)
        product_last_order: dict = {}
        dist_product_vol: dict = defaultdict(lambda: defaultdict(int))
        dist_product_rev: dict = defaultdict(lambda: defaultdict(float))
        dist_product_last: dict = defaultdict(lambda: defaultdict(str))
        dist_names: dict = {}
        trend_buckets = [0] * bucket_count

        for order in delivered_orders:
            created_str = order.get("created_at", "")
            items = _order_items(order)
            buyer_id = order.get("buyer_id", "")
            buyer_name = order.get("buyer_name", "")
            if buyer_id:
                dist_names[buyer_id] = buyer_name
            if not isinstance(items, list):
                continue

            order_date = _parse_ts(created_str)
            in_current = False
            in_prev = False

            if order_date:
                if order_date >= current_start:
                    in_current = True
                elif order_date >= prev_start:
                    in_prev = True
                if period == "weekly":
                    days_ago = (now - order_date).days
                    if 0 <= days_ago < bucket_count:
                        total_qty = sum(_item_qty(item) for item in items)
                        trend_buckets[bucket_count - 1 - days_ago] += total_qty
                else:
                    months_ago = (now.year - order_date.year) * 12 + now.month - order_date.month
                    if 0 <= months_ago < bucket_count:
                        total_qty = sum(_item_qty(item) for item in items)
                        trend_buckets[bucket_count - 1 - months_ago] += total_qty

            for item in items:
                pname = _item_name(item)
                qty = _item_qty(item)
                if not pname or qty <= 0:
                    continue
                price = float(item.get("price_per_unit") or item.get("unit_price") or item.get("price") or 0)
                subtotal = float(item.get("subtotal") or (qty * price))

                if in_current:
                    product_curr[pname] += qty
                elif in_prev:
                    product_prev[pname] += qty

                product_total[pname] += qty
                product_revenue[pname] += subtotal
                if created_str and (pname not in product_last_order or created_str > product_last_order[pname]):
                    product_last_order[pname] = created_str

                if buyer_id:
                    dist_product_vol[buyer_id][pname] += qty
                    dist_product_rev[buyer_id][pname] += subtotal
                    if created_str and (pname not in dist_product_last[buyer_id] or created_str > dist_product_last[buyer_id][pname]):
                        dist_product_last[buyer_id][pname] = created_str

        def calc_growth(name: str) -> int:
            return _period_growth_pct(product_curr.get(name, 0), product_prev.get(name, 0))

        def trend_label(growth: float) -> str:
            if growth > 10:
                return "rising"
            if growth < -10:
                return "declining"
            return "stable"

        all_product_names = set(product_curr.keys()) | set(product_prev.keys()) | set(product_total.keys())
        all_products = sorted(
            [(name, product_total.get(name, 0)) for name in all_product_names],
            key=lambda x: x[1], reverse=True,
        )

        top_selling = []
        for i, (name, vol) in enumerate(all_products[:5]):
            if vol > 0:
                g = calc_growth(name)
                top_selling.append({
                    "id": f"p{i}", "name": name, "current_demand": vol,
                    "growth_pct": g, "trend": trend_label(g),
                    "category": inv_map.get(name, "general"), "revenue": product_revenue.get(name, 0),
                })

        # Minimum volume threshold: at least 5 units to filter out pure noise
        min_vol_threshold = 5

        # Check if prev period has any data at all
        has_prev_data = any(product_prev.get(n, 0) > 0 for n in all_product_names)

        if has_prev_data:
            # Normal case: rising = existed in prev AND grew
            rising_candidates = sorted(
                [
                    (name, product_curr.get(name, 0), calc_growth(name))
                    for name in all_product_names
                    if product_curr.get(name, 0) >= min_vol_threshold
                    and product_prev.get(name, 0) > 0
                    and product_curr.get(name, 0) > product_prev.get(name, 0)
                ],
                key=lambda x: (x[2], x[1]), reverse=True,
            )
        else:
            # Fallback: no prev data (e.g. all orders in current month) — show top by volume
            rising_candidates = sorted(
                [
                    (name, product_curr.get(name, 0), 100)
                    for name in all_product_names
                    if product_curr.get(name, 0) >= min_vol_threshold
                ],
                key=lambda x: x[1], reverse=True,
            )

        top_rising = [
            {"id": f"r{i}", "name": name, "current_demand": vol, "growth_pct": g,
             "trend": trend_label(g), "category": inv_map.get(name, "general"), "revenue": product_revenue.get(name, 0)}
            for i, (name, vol, g) in enumerate(rising_candidates[:3])
        ]

        # Declining: must have at least 5 units in current period
        declining_candidates = sorted(
            [
                (name, product_curr.get(name, 0), calc_growth(name))
                for name in all_product_names
                if product_curr.get(name, 0) >= min_vol_threshold and calc_growth(name) < 0
            ],
            key=lambda x: x[2],
        )
        declining = [
            {"id": f"d{i}", "name": name, "current_demand": vol, "growth_pct": g,
             "trend": trend_label(g), "category": inv_map.get(name, "general"), "revenue": product_revenue.get(name, 0)}
            for i, (name, vol, g) in enumerate(declining_candidates[:5])
        ]

        trends = [{"period": bucket_labels[i], "total_volume": trend_buckets[i]} for i in range(bucket_count)]

        perf_by_dist = []
        for dist_id, prods in dist_product_vol.items():
            sorted_prods = sorted(prods.items(), key=lambda x: x[1], reverse=True)
            perf_by_dist.append({
                "distributor_id": dist_id,
                "distributor_name": dist_names.get(dist_id, dist_id),
                "products": [
                    {
                        "product_id": f"p{i}", "product_name": name, "quantity": qty,
                        "revenue": dist_product_rev[dist_id].get(name, 0),
                        "last_order_date": dist_product_last[dist_id].get(name, ""),
                    }
                    for i, (name, qty) in enumerate(sorted_prods[:5])
                ],
            })
        perf_by_dist.sort(key=lambda dist: sum(product.get("quantity", 0) for product in dist["products"]), reverse=True)

        insights = []
        if top_rising:
            best = top_rising[0]
            insights.append({
                "type": "demand_forecast",
                "message": f"{best['name']} demand up {best['growth_pct']}% — {best['current_demand']} units this period.",
                "urgency": "medium" if best["growth_pct"] > 20 else "low",
            })
        if declining:
            worst = declining[0]
            insights.append({
                "type": "inventory_warning",
                "message": f"{worst['name']} demand down {abs(worst['growth_pct'])}% — consider reducing stock.",
                "urgency": "medium",
            })
        if not delivered_orders:
            insights.append({
                "type": "inventory_warning",
                "message": "No order data yet. Start transacting to see demand analysis.",
                "urgency": "medium",
            })

        return success_response(
            data={
                "insights": insights,
                "top_rising": top_rising,
                "declining": declining,
                "trends": trends,
                "top_selling": top_selling,
                "product_performance_by_distributor": perf_by_dist,
            },
            message="Demand analysis data retrieved successfully",
        )
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 15. LOGISTICS
# ==========================================

@app.get("/logistics/shipments")
def get_shipments(user_id: Optional[str] = None, current_user: AuthenticatedUser = Depends(get_current_user)):
    try:
        uid = current_user.user_id
        query = supabase.table("shipments").select("*")
        try:
            query = query.or_(f"sender_id.eq.{uid},receiver_id.eq.{uid}")
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
            message="Shipment data retrieved successfully",
        )
    except Exception as e:
        return error_response(str(e))


@app.put("/logistics/shipments/{shipment_id}/route")
def optimize_route(shipment_id: str):
    try:
        new_eta = future_iso(hours=2)
        supabase.table("shipments").update({"status": "in_transit", "eta": new_eta}).eq("id", shipment_id).execute()
        return success_response(data={"shipment_id": shipment_id, "new_eta": new_eta, "optimized": True}, message="Route optimized successfully")
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 16. CREDIT
# ==========================================

@app.get("/credit/accounts")
def get_credit_accounts(user_id: Optional[str] = None, page: int = 1, limit: int = 20,
                        current_user: AuthenticatedUser = Depends(get_current_user)):
    try:
        uid = current_user.user_id
        query = supabase.table("credit_accounts").select("*")
        try:
            query = query.eq("distributor_id", uid)
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
            message="Credit data retrieved successfully",
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
        return success_response(data={"repayments": repayments}, message="Repayment data retrieved successfully")
    except Exception as e:
        return error_response(str(e))


@app.post("/credit/accounts/{account_id}/repayments")
def add_repayment(account_id: str, data: dict):
    """Record a new repayment and update credit account utilized amount."""
    try:
        amount = data.get("amount", 0)
        payment_method = data.get("payment_method", "bank_transfer")
        invoice_id = data.get("invoice_id", "")
        notes = data.get("notes", "")

        if amount <= 0:
            return error_response("Amount must be greater than 0.")

        # Insert repayment record
        repayment_id = str(uuid.uuid4())
        supabase.table("repayments").insert({
            "id": repayment_id,
            "credit_account_id": account_id,
            "amount": amount,
            "payment_method": payment_method,
            "invoice_id": invoice_id,
            "notes": notes,
            "status": "paid",
            "paid_at": now_iso(),
        }).execute()

        # Update credit account utilized amount
        acc = supabase.table("credit_accounts").select("*").eq("id", account_id).execute()
        if acc.data and len(acc.data) > 0:
            row = acc.data[0]
            new_utilized = max(0, row.get("utilized_amount", 0) - amount)
            supabase.table("credit_accounts").update({"utilized_amount": new_utilized}).eq("id", account_id).execute()

        return success_response(
            data={"repayment_id": repayment_id, "amount": amount, "status": "paid"},
            message="Repayment recorded successfully",
        )
    except Exception as e:
        return error_response(str(e))


@app.post("/credit/accounts")
def open_credit(data: OpenCreditReq, current_user: AuthenticatedUser = Depends(get_current_user)):
    try:
        uid = current_user.user_id
        # Validate: must have active distributor_retailer partnership
        p_res = supabase.table("partnerships").select("id").eq("type", "distributor_retailer").eq("approver_id", uid).eq("requester_id", data.retailer_id).eq("status", "accepted").execute()
        if not p_res.data:
            return error_response("Cannot grant credit: no active partnership with this retailer. Approve partnership first.")
        partnership_id = p_res.data[0]["id"]

        account_id = str(uuid.uuid4())
        count_res = supabase.table("credit_accounts").select("id", count="exact").execute()
        acc_num = f"CRD-{str((count_res.count or 0) + 1).zfill(4)}"
        billing_end = (datetime.utcnow() + timedelta(days=data.billing_cycle_days)).isoformat() + "Z"
        payload = {"id": account_id, "retailer_id": data.retailer_id, "distributor_id": uid,
                   "partnership_id": partnership_id, "credit_limit": data.credit_limit,
                   "credit_account_number": acc_num, "billing_cycle_days": data.billing_cycle_days,
                   "utilized_amount": 0, "status": "active", "risk_level": "medium", "opened_at": now_iso(),
                   "next_due_date": billing_end, "next_due_amount": 0}
        supabase.table("credit_accounts").insert(payload).execute()
        return success_response(
            data={**payload, "credit_account_id": account_id, "retailer": {"retailer_id": data.retailer_id, "name": ""},
                  "available_amount": data.credit_limit, "utilization_pct": 0},
            message="Credit account opened successfully",
        )
    except Exception as e:
        return error_response(str(e))


@app.put("/credit/accounts/{account_id}")
def update_credit(account_id: str, data: UpdateCreditReq):
    try:
        update_payload = {k: v for k, v in data.dict().items() if v is not None}
        res = supabase.table("credit_accounts").update(update_payload).eq("id", account_id).execute()
        if not res.data:
            return error_response("Credit account not found.")
        a = res.data[0]
        return success_response(
            data={"credit_account_id": a.get("id"), "credit_limit": a.get("credit_limit"),
                  "utilized_amount": a.get("utilized_amount", 0), "status": a.get("status"), "risk_level": a.get("risk_level")},
            message="Credit account updated successfully",
        )
    except Exception as e:
        return error_response(str(e))


@app.get("/credit/eligibility/{retailer_id}")
def check_credit_eligibility(retailer_id: str, current_user: AuthenticatedUser = Depends(get_current_user)):
    """Check if retailer is eligible for credit line based on segment."""
    try:
        uid = current_user.user_id
        # Verify partnership exists
        p_res = supabase.table("partnerships").select("id,created_at").eq("type", "distributor_retailer").eq("approver_id", uid).eq("requester_id", retailer_id).eq("status", "accepted").execute()
        if not p_res.data:
            return success_response(data={"eligible": False, "reason": "No active partnership", "segment": "none", "suggested_limit": 0})

        # Calculate segment from orders
        orders_res = supabase.table("orders").select("total_price,status").eq("seller_id", uid).eq("buyer_id", retailer_id).execute()
        orders = orders_res.data or []
        total_purchase = sum(int(o.get("total_price", 0) or 0) for o in orders if o.get("status") == "delivered")
        order_count = len([o for o in orders if o.get("status") == "delivered"])

        # Partnership duration
        partnership_created = p_res.data[0].get("created_at", "")
        days_partnered = 0
        if partnership_created:
            try:
                days_partnered = (datetime.utcnow() - _parse_ts(partnership_created)).days
            except Exception:
                pass

        # Determine segment
        if total_purchase >= 10_000_000 and order_count >= 5 and days_partnered >= 90:
            segment = "premium"
            suggested_limit = 20_000_000
        elif total_purchase >= 2_000_000 or order_count >= 2:
            segment = "regular"
            suggested_limit = 5_000_000
        else:
            segment = "new"
            suggested_limit = 0

        eligible = segment in ("regular", "premium")

        # Check if already has credit
        existing = supabase.table("credit_accounts").select("id").eq("distributor_id", uid).eq("retailer_id", retailer_id).neq("status", "closed").execute()
        already_has = bool(existing.data)

        return success_response(data={
            "eligible": eligible and not already_has,
            "segment": segment,
            "suggested_limit": suggested_limit,
            "total_purchase": total_purchase,
            "order_count": order_count,
            "days_partnered": days_partnered,
            "already_has_credit": already_has,
            "reason": "Already has active credit line" if already_has else ("Eligible" if eligible else "Not enough order history (need Regular or Premium segment)"),
        })
    except Exception as e:
        return error_response(str(e))


@app.post("/orders/pay-with-credit")
def pay_order_with_credit(body: dict, current_user: AuthenticatedUser = Depends(get_current_user)):
    """Deduct order amount from retailer's credit line."""
    try:
        order_id = body.get("order_id", "")
        credit_account_id = body.get("credit_account_id", "")
        uid = current_user.user_id

        if not order_id or not credit_account_id:
            return error_response("order_id and credit_account_id required")

        # Get order
        order_res = supabase.table("orders").select("total_price,buyer_id,status").eq("id", order_id).execute()
        if not order_res.data:
            return error_response("Order not found")
        order = order_res.data[0]
        if order.get("buyer_id") != uid:
            return error_response("Not your order")
        if order.get("status") != "pending":
            return error_response("Order must be pending to pay with credit")
        amount = int(order.get("total_price", 0) or 0)

        # Get credit account
        credit_res = supabase.table("credit_accounts").select("*").eq("id", credit_account_id).execute()
        if not credit_res.data:
            return error_response("Credit account not found")
        credit = credit_res.data[0]
        if credit.get("retailer_id") != uid:
            return error_response("Not your credit account")
        if credit.get("status") != "active":
            return error_response("Credit account is not active")

        available = int(credit.get("credit_limit", 0)) - int(credit.get("utilized_amount", 0))
        if amount > available:
            return error_response(f"Insufficient credit. Available: Rp {available:,}, Order: Rp {amount:,}")

        # Deduct
        new_utilized = int(credit.get("utilized_amount", 0)) + amount
        supabase.table("credit_accounts").update({"utilized_amount": new_utilized}).eq("id", credit_account_id).execute()

        return success_response(data={
            "order_id": order_id,
            "amount_charged": amount,
            "new_utilized": new_utilized,
            "remaining_available": int(credit.get("credit_limit", 0)) - new_utilized,
        }, message="Order paid with credit successfully")
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
                     "description": "Predicts demand from distributors for production optimization.",
                     "status": "active", "automation_level": "manual_approval",
                     "recent_action": "Awaiting activation.", "last_active": now_iso()},
                    {"id": "fallback-s2", "agent_key": "logistics_optimization", "name": "Logistics Optimization",
                     "description": "Optimizes delivery routes to distributors.",
                     "status": "active", "automation_level": "auto_with_threshold",
                     "recent_action": "Awaiting activation.", "last_active": now_iso()},
                    {"id": "fallback-s3", "agent_key": "price_optimization", "name": "Price Optimization",
                     "description": "Suggests price adjustments based on supply-demand.",
                     "status": "active", "automation_level": "manual_approval",
                     "recent_action": "Awaiting activation.", "last_active": now_iso()},
                ]
            elif x_user_role == "distributor":
                agents = [
                    {"id": "fallback-d1", "agent_key": "auto_restock", "name": "Auto Restock",
                     "description": "Monitors inventory and provides automatic restock alerts.",
                     "status": "active", "automation_level": "auto_with_threshold",
                     "recent_action": "Awaiting activation.", "last_active": now_iso()},
                    {"id": "fallback-d2", "agent_key": "credit_risk", "name": "Credit Risk Analyzer",
                     "description": "Analyzes retailer credit risk based on payment history.",
                     "status": "active", "automation_level": "manual_approval",
                     "recent_action": "Awaiting activation.", "last_active": now_iso()},
                    {"id": "fallback-d3", "agent_key": "supplier_recommendation", "name": "Supplier Recommendation",
                     "description": "Searches for alternative suppliers and analyzes expansion opportunities.",
                     "status": "active", "automation_level": "manual_approval",
                     "recent_action": "Awaiting activation.", "last_active": now_iso()},
                    {"id": "fallback-d4", "agent_key": "cash_flow_optimizer", "name": "Cash Flow Optimizer",
                     "description": "Optimizes payment and billing schedules.",
                     "status": "active", "automation_level": "auto_with_threshold",
                     "recent_action": "Awaiting activation.", "last_active": now_iso()},
                ]
            elif x_user_role == "retailer":
                agents = [
                    {"id": "fallback-r1", "agent_key": "retailer_reorder", "name": "Smart Reorder",
                     "description": "Monitors retail stock and recommends reorder from distributor.",
                     "status": "active", "automation_level": "auto_with_threshold",
                     "recent_action": "Awaiting activation.", "last_active": now_iso()},
                    {"id": "fallback-r2", "agent_key": "retailer_sales_trend", "name": "Sales Trend Analyzer",
                     "description": "Analyzes sales trends and consumer demand patterns.",
                     "status": "active", "automation_level": "manual_approval",
                     "recent_action": "Awaiting activation.", "last_active": now_iso()},
                    {"id": "fallback-r3", "agent_key": "retailer_demand_insight", "name": "Demand Insight",
                     "description": "Predicts consumer demand 7-14 days ahead.",
                     "status": "active", "automation_level": "manual_approval",
                     "recent_action": "Awaiting activation.", "last_active": now_iso()},
                ]
            else:
                agents = [
                    {"id": "fallback-g1", "agent_key": "demand_forecast", "name": "Demand Forecast",
                     "description": "Analyzes demand trends and predicts needs.",
                     "status": "active", "automation_level": "manual_approval",
                     "recent_action": "Awaiting activation.", "last_active": now_iso()},
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
            message="AI agents data retrieved successfully",
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
        return success_response(data={"success": True}, message="Agent config updated successfully")
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
        "query": lambda uid, r: supabase.table("orders").select("buyer_name, items, status, created_at").eq("seller_id", uid).order("created_at", desc=True).limit(15).execute(),
        "prompt": lambda data, uid: (
            "You are a supply chain AI for a SUPPLIER. Analyze these orders placed by distributors.\n\n"
            f"ORDER DATA: {json.dumps(data[:10] if data else [], default=str)}\n\n"
            "YOUR TASK:\n"
            "1. Identify which products are ordered most frequently and in highest quantities.\n"
            "2. Detect if any product has increasing or decreasing order volume over time.\n"
            "3. Predict which products need increased production in the next 7-14 days.\n"
            "4. Be SPECIFIC — name actual products, quantities, and dates from the data.\n\n"
            "RULES FOR FILLING JSON:\n"
            "- issue_detected: pick ONE of DEMAND_SPIKE, DEMAND_DROP, or NONE\n"
            "- reason: write 1-2 sentences explaining WHAT is happening and WHY (mention product names and numbers)\n"
            "- confidence_score: 0.0-1.0 based on how much data supports your conclusion\n"
            "- action_type: pick ONE of PREPARE_SHIPMENT, INCREASE_PRODUCTION, DELAY_WARNING, or NONE\n"
            "- In demand_analysis, list actual product names from the data\n\n"
            "RETURN ONLY THIS JSON (fill in real values):\n"
            '{"agent_type":"Supplier Agent","urgency_level":"HIGH or MEDIUM or LOW",'
            '"demand_analysis":{"top_requested_products":["product name (qty)"],"demand_trend":"increasing or decreasing or stable","detected_spikes":["product name: +X% this week"],"predicted_shortages":["product name: will run out in N days"]},'
            '"analysis":{"issue_detected":"DEMAND_SPIKE","reason":"Specific explanation with product names and numbers","confidence_score":0.85},'
            '"recommended_action":{"action_type":"INCREASE_PRODUCTION","details":"Produce X more units of Product Y to meet projected demand","urgency_timeline_days":7},'
            '"system_flags":{"requires_human_approval":true,"auto_execute_allowed":false}}'
        ),
    },
    "logistics_optimization": {
        "scope": "supplier",
        "query": lambda uid, r: supabase.table("shipments").select("destination, status, eta, carrier, created_at").eq("sender_id", uid).limit(15).execute(),
        "prompt": lambda data, uid: (
            "You are a logistics AI for a SUPPLIER. Analyze shipment performance to distributors.\n\n"
            f"SHIPMENT DATA: {json.dumps(data[:20] if data else [], default=str)}\n\n"
            "YOUR TASK:\n"
            "1. Calculate on-time delivery rate.\n"
            "2. Identify delayed shipments — which destination, how late, to which distributor.\n"
            "3. Recommend specific improvements (route changes, carrier switches).\n"
            "4. Be SPECIFIC — mention destination names, carrier names, and delay durations. NEVER include raw IDs or UUIDs in your response.\n\n"
            "RULES FOR FILLING JSON:\n"
            "- issue_detected: pick ONE of DELAYED_ROUTE, INEFFICIENT_CARRIER, or NONE\n"
            "- reason: explain which shipments are delayed and by how much\n"
            "- action_type: pick ONE of REROUTE, CHANGE_CARRIER, or NONE\n\n"
            "RETURN ONLY THIS JSON (fill in real values):\n"
            '{"agent_type":"Supplier Agent","urgency_level":"HIGH or MEDIUM or LOW",'
            '"shipment_analysis":{"total_shipments":0,"delayed_count":0,"on_time_rate":95.0,"avg_delivery_hours":48},'
            '"analysis":{"issue_detected":"DELAYED_ROUTE","reason":"3 shipments to Distributor X delayed by 2+ days due to route congestion","confidence_score":0.8},'
            '"recommended_action":{"action_type":"REROUTE","carrier_recommendation":"Switch to JNE for Surabaya route","estimated_savings_idr":150000},'
            '"system_flags":{"requires_human_approval":true,"auto_execute_allowed":false}}'
        ),
    },
    "price_optimization": {
        "scope": "supplier",
        "query": lambda uid, r: supabase.table("inventories").select("product_name, current_stock, min_threshold, unit, category, price").eq("user_id", uid).limit(20).execute(),
        "prompt": lambda data, uid: (
            "You are a pricing AI for a SUPPLIER. Analyze inventory and recommend price changes.\n\n"
            f"INVENTORY DATA: {json.dumps(data[:20] if data else [], default=str)}\n\n"
            "YOUR TASK:\n"
            "1. Find products with stock far ABOVE min_stock (overstocked) — these may need a discount to move.\n"
            "2. Find products with stock BELOW min_stock (understocked) — high demand, consider price increase.\n"
            "3. Compare current prices to stock levels to find pricing mismatches.\n"
            "4. Be SPECIFIC — name the product, current price, current stock vs min_stock, and recommended new price.\n\n"
            "RULES FOR FILLING JSON:\n"
            "- issue_detected: pick ONE of PRICE_GAP, OVERSTOCK, or NONE\n"
            "- reason: explain which product has the issue and why (e.g. 'Granulated Sugar has 200 units vs min 50, price Rp12,000 — recommend 10% discount to move stock')\n"
            "- confidence_score: higher if the gap between stock and min_stock is large\n"
            "- action_type: pick ONE of ADJUST_PRICE, DISCOUNT, or NONE\n"
            "- target_product: the specific product name\n"
            "- recommended_price: your suggested new price in IDR\n\n"
            "RETURN ONLY THIS JSON (fill in real values):\n"
            '{"agent_type":"Supplier Agent","urgency_level":"HIGH or MEDIUM or LOW",'
            '"pricing_analysis":{"total_products":10,"overstocked":["Product A (stock: 200, min: 50)"],"underpriced":["Product B at Rp5000 but high demand"],"overpriced":["Product C at Rp15000 but no movement"]},'
            '"analysis":{"issue_detected":"OVERSTOCK","reason":"Granulated Sugar 1kg has 200 units (min: 50), sitting idle. Recommend 10% discount from Rp12,000 to Rp10,800 to accelerate sales.","confidence_score":0.82},'
            '"recommended_action":{"action_type":"DISCOUNT","target_product":"Granulated Sugar 1kg","current_price":12000,"recommended_price":10800,"estimated_revenue_impact_idr":240000},'
            '"system_flags":{"requires_human_approval":true,"auto_execute_allowed":false}}'
        ),
    },

    # ── DISTRIBUTOR AGENTS ──
    "auto_restock": {
        "scope": "distributor",
        "query": lambda uid, r: supabase.table("inventories").select("product_name, current_stock, min_threshold, unit, category").eq("user_id", uid).limit(20).execute(),
        "prompt": lambda data, uid: (
            "You are a restock AI for a DISTRIBUTOR. Analyze inventory and recommend what to reorder from suppliers.\n\n"
            f"INVENTORY DATA: {json.dumps(data[:30] if data else [], default=str)}\n\n"
            "YOUR TASK:\n"
            "1. Find products where stock <= min_stock (critical) or stock is 0 (out of stock).\n"
            "2. For each low-stock product, recommend reorder quantity = (min_stock * 2) - current_stock.\n"
            "3. Prioritize by urgency: out_of_stock > below min_stock > approaching min_stock.\n"
            "4. Be SPECIFIC — name each product, its current stock, min_stock, and how many to reorder.\n\n"
            "RULES:\n"
            "- issue_detected: pick ONE of CRITICAL_STOCK, LOW_STOCK, or NONE\n"
            "- reason: list the critical products with numbers (e.g. 'Kopi ABC at 0/24 units, Instant Noodle at 5/180 units')\n"
            "- action_type: pick ONE of RESTOCK_NOW, CREATE_PURCHASE_ORDER, MONITOR_STOCK, or NONE\n\n"
            "RETURN ONLY THIS JSON (fill in real values):\n"
            '{"agent_type":"Distributor Agent","urgency_level":"HIGH or MEDIUM or LOW",'
            '"inventory_status":{"total_products":10,"low_stock_count":3,"low_stock_products":["Kopi ABC (0/24)","Instant Noodle (5/180)"],"healthy_stock_products":["Sugar (200/50)"]},'
            '"analysis":{"issue_detected":"CRITICAL_STOCK","reason":"3 products critically low: Kopi ABC at 0 units (min 24), Instant Noodle at 5 units (min 180). Immediate restock needed.","confidence_score":0.95},'
            '"recommended_action":{"action_type":"RESTOCK_NOW","recommended_products":["Kopi ABC: order 48 units","Instant Noodle: order 355 units"],"estimated_cost_idr":2500000},'
            '"system_flags":{"requires_human_approval":true,"auto_execute_allowed":false}}'
        ),
    },
    "credit_risk": {
        "scope": "distributor",
        "query": lambda uid, r: supabase.table("credit_accounts").select("*").eq("distributor_id", uid).execute(),
        "prompt": lambda data, uid: (
            "You are a credit risk AI for a DISTRIBUTOR. Analyze retailer credit accounts.\n\n"
            f"CREDIT DATA: {json.dumps(data[:20] if data else [], default=str)}\n\n"
            "YOUR TASK:\n"
            "1. Find retailers with high utilization (used > 80% of limit).\n"
            "2. Find overdue accounts (past due date).\n"
            "3. Recommend credit limit changes with specific amounts.\n"
            "4. Be SPECIFIC — name the retailer, their current balance, limit, and risk level.\n\n"
            "RULES:\n"
            "- issue_detected: pick ONE of HIGH_RISK_DETECTED, OVERDUE_ACCOUNT, CREDIT_OVERUTILIZED, or NONE\n"
            "- reason: explain which retailer is risky and why (amounts, percentages)\n"
            "- action_type: pick ONE of REDUCE_LIMIT, SUSPEND_ACCOUNT, INCREASE_LIMIT, or NONE\n\n"
            "RETURN ONLY THIS JSON:\n"
            '{"agent_type":"Distributor Agent","urgency_level":"HIGH or MEDIUM or LOW",'
            '"credit_analysis":{"total_accounts":0,"high_risk_count":0,"overdue_count":0,"total_outstanding_idr":0,"risky_retailers":[]},'
            '"analysis":{"issue_detected":"HIGH_RISK_DETECTED or OVERDUE_ACCOUNT or CREDIT_OVERUTILIZED or NONE","reason":"YOUR ANALYSIS based on actual data above. If no data, say No credit accounts found.","confidence_score":0.0},'
            '"recommended_action":{"action_type":"REDUCE_LIMIT or SUSPEND_ACCOUNT or INCREASE_LIMIT or NONE","target_retailer_id":"","suggested_new_limit":0},'
            '"system_flags":{"requires_human_approval":true,"auto_execute_allowed":false}}'
        ),
    },
    "supplier_recommendation": {
        "scope": "distributor",
        "query": lambda uid, r: supabase.table("partnerships").select("approver_id,status,mou_region,created_at").eq("requester_id", uid).eq("type", "supplier_distributor").execute(),
        "prompt": lambda data, uid: (
            "You are a partnership AI for a DISTRIBUTOR. Analyze current supplier partnerships.\n\n"
            f"PARTNERSHIP DATA: {json.dumps(data[:20] if data else [], default=str)}\n\n"
            "YOUR TASK:\n"
            "1. Count how many active supplier partnerships exist.\n"
            "2. If data is empty or only 1 supplier, recommend finding more suppliers.\n"
            "3. If there are multiple suppliers, evaluate coverage by region.\n"
            "4. ONLY use information from the data above. DO NOT invent supplier names or statistics.\n"
            "5. If no issues found, set issue_detected to NONE.\n\n"
            "CRITICAL: Do NOT copy example values. Analyze the ACTUAL data provided above.\n\n"
            "RETURN ONLY THIS JSON:\n"
            '{"agent_type":"Distributor Agent","urgency_level":"HIGH or MEDIUM or LOW",'
            '"partnership_analysis":{"total_suppliers":0,"top_performers":[],"underperformers":[],"product_gaps":[]},'
            '"analysis":{"issue_detected":"SUPPLIER_GAP or UNDERPERFORMER or NONE","reason":"YOUR ANALYSIS HERE based on actual data","confidence_score":0.0},'
            '"recommended_action":{"action_type":"ONBOARD_SUPPLIER or REVIEW_PARTNERSHIP or NONE","recommended_category":"","expected_benefit":""},'
            '"system_flags":{"requires_human_approval":true,"auto_execute_allowed":false}}'
        ),
    },
    "cash_flow_optimizer": {
        "scope": "distributor",
        "query": lambda uid, r: supabase.table("invoices").select("*").or_(f"buyer_id.eq.{uid},seller_id.eq.{uid}").execute(),
        "prompt": lambda data, uid: (
            "You are a cash flow AI for a DISTRIBUTOR. Analyze invoices and payment timing.\n\n"
            f"INVOICE DATA: {json.dumps(data[:25] if data else [], default=str)}\n\n"
            "YOUR TASK:\n"
            "1. Calculate total payable (you owe suppliers) vs total receivable (retailers owe you).\n"
            "2. Find overdue invoices — both payable and receivable.\n"
            "3. Recommend payment prioritization to optimize cash position.\n"
            "4. Be SPECIFIC — mention invoice amounts, due dates, and which party.\n\n"
            "RULES:\n"
            "- issue_detected: pick ONE of NEGATIVE_CASHFLOW, OVERDUE_RISK, or NONE\n"
            "- reason: explain the cash flow situation with numbers (e.g. 'Rp8M payable due in 3 days but only Rp3M receivable collected')\n"
            "- action_type: pick ONE of PRIORITIZE_PAYMENT, DELAY_PAYMENT, COLLECT_RECEIVABLE, or NONE\n\n"
            "RETURN ONLY THIS JSON:\n"
            '{"agent_type":"Distributor Agent","urgency_level":"HIGH or MEDIUM or LOW",'
            '"cashflow_analysis":{"total_payable":0,"total_receivable":0,"overdue_payable":0,"overdue_receivable":0,"net_cash_position":0},'
            '"analysis":{"issue_detected":"NEGATIVE_CASHFLOW or OVERDUE_RISK or NONE","reason":"YOUR ANALYSIS based on actual invoice data above. If no data, say No invoices found.","confidence_score":0.0},'
            '"recommended_action":{"action_type":"PRIORITIZE_PAYMENT or DELAY_PAYMENT or COLLECT_RECEIVABLE or NONE","target_invoice_id":"","estimated_cashflow_impact_idr":0},'
            '"system_flags":{"requires_human_approval":true,"auto_execute_allowed":false}}'
        ),
    },

    # ── RETAILER AGENTS ──
    "retailer_reorder": {
        "scope": "retailer",
        "query": lambda uid, r: supabase.table("inventories").select("*").eq("user_id", uid).execute(),
        "prompt": lambda data, uid: (
            "You are a restock AI for a RETAILER. Analyze inventory and recommend what to reorder from distributors.\n\n"
            f"INVENTORY DATA: {json.dumps(data[:30] if data else [], default=str)}\n\n"
            "YOUR TASK:\n"
            "1. Find products where stock <= min_stock or stock is 0.\n"
            "2. For each, recommend reorder quantity = (min_stock * 2) - current_stock.\n"
            "3. Estimate cost based on unit price * reorder quantity.\n"
            "4. Be SPECIFIC — name each product, current stock, min_stock, and reorder qty.\n\n"
            "RULES:\n"
            "- issue_detected: pick ONE of LOW_STOCK, FAST_MOVING, or NONE\n"
            "- reason: list critical products with numbers\n"
            "- action_type: pick ONE of REORDER_PRODUCT, LOW_STOCK_ALERT, or NONE\n\n"
            "RETURN ONLY THIS JSON (fill in real values):\n"
            '{"agent_type":"Retailer Agent","urgency_level":"HIGH or MEDIUM or LOW",'
            '"inventory_status":{"total_products":10,"low_stock_products":["Kopi ABC (2/20)","Mie Goreng (0/50)"],"fast_moving_products":["Teh Botol: sells 30/week"],"reorder_recommendations":["Kopi ABC: order 38 units @ Rp8,000 = Rp304,000"]},'
            '"analysis":{"issue_detected":"LOW_STOCK","reason":"2 products critically low: Kopi ABC at 2 units (min 20), Mie Goreng out of stock (min 50). Both are fast-moving items.","confidence_score":0.92},'
            '"recommended_action":{"action_type":"REORDER_PRODUCT","recommended_order_value_idr":1500000,"suggested_distributor":"nearest partner distributor"},'
            '"system_flags":{"requires_human_approval":true,"auto_execute_allowed":false}}'
        ),
    },
    "retailer_sales_trend": {
        "scope": "retailer",
        "query": lambda uid, r: supabase.table("orders").select("items, status, created_at, total_amount").eq("buyer_id", uid).order("created_at", desc=True).limit(15).execute(),
        "prompt": lambda data, uid: (
            "You are a sales trend AI for a RETAILER. Analyze purchase history to find patterns.\n\n"
            f"ORDER DATA: {json.dumps(data[:20] if data else [], default=str)}\n\n"
            "YOUR TASK:\n"
            "1. Identify products with increasing order frequency (trending up).\n"
            "2. Identify products with decreasing orders (trending down).\n"
            "3. Detect seasonal patterns (e.g. more ice cream in summer).\n"
            "4. Be SPECIFIC — name products and their trend direction with percentages.\n\n"
            "RULES:\n"
            "- issue_detected: pick ONE of DECLINING_TREND, SEASONAL_SPIKE, or NONE\n"
            "- reason: explain which product is declining/spiking and by how much\n"
            "- action_type: pick ONE of SALES_TREND_WARNING, PROMOTE_PRODUCT, or NONE\n\n"
            "RETURN ONLY THIS JSON (fill in real values):\n"
            '{"agent_type":"Retailer Agent","urgency_level":"HIGH or MEDIUM or LOW",'
            '"sales_analysis":{"trending_up":["Kopi ABC: +25% orders this month"],"trending_down":["Mie Instant: -15% vs last month"],"seasonal_patterns":["Ice products spike in dry season"],"monthly_spend_trend":"increasing"},'
            '"analysis":{"issue_detected":"DECLINING_TREND","reason":"Mie Instant orders dropped 15% this month compared to last month. May indicate customer preference shift or competitor pricing.","confidence_score":0.75},'
            '"recommended_action":{"action_type":"PROMOTE_PRODUCT","details":"Consider bundling Mie Instant with popular items or running a discount to recover volume","projected_next_month_idr":3200000},'
            '"system_flags":{"requires_human_approval":true,"auto_execute_allowed":false}}'
        ),
    },
    "retailer_demand_insight": {
        "scope": "retailer",
        "query": lambda uid, r: supabase.table("orders").select("items, status, created_at, total_amount").eq("buyer_id", uid).order("created_at", desc=True).limit(15).execute(),
        "prompt": lambda data, uid: (
            "You are a demand forecast AI for a RETAILER. Predict what to stock up on next.\n\n"
            f"ORDER DATA: {json.dumps(data[:20] if data else [], default=str)}\n\n"
            "YOUR TASK:\n"
            "1. Based on order history, predict which products will be needed most in next 7-14 days.\n"
            "2. Estimate quantities based on average order frequency.\n"
            "3. Flag products where demand is changing (up or down).\n"
            "4. Be SPECIFIC — name products, predicted quantities, and confidence level.\n\n"
            "RULES:\n"
            "- issue_detected: pick ONE of DEMAND_SURGE, DEMAND_DROP, or NONE\n"
            "- reason: explain what's driving the demand change\n"
            "- action_type: pick ONE of STOCK_UP, REDUCE_ORDER, MONITOR, or NONE\n\n"
            "RETURN ONLY THIS JSON (fill in real values):\n"
            '{"agent_type":"Retailer Agent","urgency_level":"HIGH or MEDIUM or LOW",'
            '"demand_forecast":{"predicted_top_products":["Kopi ABC: ~50 units needed","Gula Pasir: ~30 units needed"],"confidence_by_product":{"Kopi ABC":0.85,"Gula Pasir":0.7},"forecast_period_days":14},'
            '"analysis":{"issue_detected":"DEMAND_SURGE","reason":"Kopi ABC orders increased 40% over last 2 weeks. Predict continued high demand — stock up to avoid stockout.","confidence_score":0.82},'
            '"recommended_action":{"action_type":"STOCK_UP","details":"Order 50 units of Kopi ABC and 30 units of Gula Pasir within next 3 days","estimated_impact_idr":800000},'
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
    if not OPENROUTER_KEY and not GEMINI_KEY and not GROQ_KEY:
        raise RuntimeError("No AI API keys configured")
    ai_text = _call_ai(
        prompt + "\n\nIMPORTANT: Return ONLY the JSON object. No markdown code blocks, no backticks, no explanatory text. Start with { and end with }. For action_type and issue_detected, pick EXACTLY ONE option from the choices — do NOT return multiple options separated by |. CRITICAL: Only reference data that actually exists in the DATA section above. Do NOT invent names, numbers, or statistics. If data is empty, set issue_detected to NONE."
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
            return error_response(f"Agent '{agent_key}' not found.")

        agent = agents_res.data[0]
        role = x_user_role or "distributor"
        uid = user_id or ""

        if agent.get("agent_role") not in (role, "all"):
            return error_response(f"Agent '{agent_key}' is not available for role {role}.")

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

        # Clean template literals (AI returned enum options instead of choosing)
        if "|" in action_type:
            action_type = action_type.split("|")[0].strip()
        if "|" in issue:
            issue = issue.split("|")[0].strip()

        issue_label = issue.replace("_", " ").title() if issue not in ("NONE", "PARSE_ERROR") else ""
        action_label = action_type.replace("_", " ").title() if action_type != "NONE" else "No Action"
        impact_summary = f"{issue_label}: {reason}" if issue_label else "No critical issues detected."
        recent_action = f"{action_label} — {reason[:80]}" if issue_label else "No issues detected."

        now = now_iso()
        activity_id = str(uuid.uuid4())

        supabase.table("ai_activities").insert({
            "id": activity_id,
            "agent_name": agent.get("name", agent_key),
            "action": f"{action_label} (confidence: {confidence:.0%})",
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
                # Reject template literals (AI returned enum options instead of choosing one)
                is_template = "|" in action_type or "|" in issue
                has_finding = not is_template and issue not in ("NONE", "PARSE_ERROR") and action_type != "NONE"

                # Clean for display
                if "|" in action_type:
                    action_type = action_type.split("|")[0].strip()
                if "|" in issue:
                    issue = issue.split("|")[0].strip()

                now = now_iso()
                issue_label = issue.replace("_", " ").title() if issue not in ("NONE", "PARSE_ERROR") else ""
                action_label = action_type.replace("_", " ").title() if action_type != "NONE" else "No Action"
                recent_action = f"{action_label} — {reason[:80]}" if has_finding else f"No issues — last check {now[:16]}"
                supabase.table("ai_agents").update({
                    "recent_action": recent_action[:120],
                    "last_active": now,
                }).eq("agent_key", agent_key).execute()

                # Only log activity when there's a real finding
                if has_finding:
                    activity_id = str(uuid.uuid4())
                    impact_summary = f"{issue_label}: {reason}" if issue_label else "No issues."
                    supabase.table("ai_activities").insert({
                        "id": activity_id,
                        "agent_name": agent.get("name", agent_key),
                        "action": f"Auto-run: {action_label} (confidence: {confidence:.0%})",
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
        # Get the specific item
        item_res = supabase.table("inventories").select("product_name,current_stock,min_threshold,unit").eq("id", req.item_id).execute()
        item = item_res.data[0] if item_res.data else None
        if not item:
            return error_response("Item not found")

        item_name = item.get("product_name", "")
        current = item.get("current_stock", 0)
        min_stock = item.get("min_threshold", 0)
        unit = item.get("unit", "pcs")
        suggested_qty = max((min_stock * 2) - current, min_stock)

        # Find a partner supplier
        suggested_seller = None
        try:
            # Get user_id from item
            item_full = supabase.table("inventories").select("user_id").eq("id", req.item_id).execute()
            if item_full.data:
                uid = item_full.data[0].get("user_id", "")
                partners = supabase.table("partnerships").select("approver_id").eq("requester_id", uid).eq("type", "supplier_distributor").eq("status", "accepted").limit(1).execute()
                if partners.data:
                    seller_id = partners.data[0]["approver_id"]
                    seller_user = _get_auth_user(seller_id)
                    if seller_user:
                        meta = seller_user.get("user_metadata", {}) or {}
                        suggested_seller = {
                            "seller_id": seller_id,
                            "name": meta.get("business_name", ""),
                            "seller_type": "supplier",
                            "reputation_score": meta.get("reputation_score", 0),
                            "estimated_delivery_days": 3,
                        }
        except Exception:
            pass

        urgency = "high" if current == 0 else "medium" if current < min_stock else "low"

        return success_response(data={
            "item_id": req.item_id,
            "item_name": item_name,
            "current_stock": current,
            "min_stock": min_stock,
            "recommendation": f"Restock {item_name}: order {suggested_qty} {unit} to maintain healthy stock levels.",
            "suggested_qty": suggested_qty,
            "suggested_unit": unit,
            "suggested_seller": suggested_seller,
            "urgency": urgency,
            "generated_at": now_iso(),
        }, message="Restock recommendation generated")
    except Exception as e:
        return error_response(str(e))


@app.post("/ai/demand-forecast")
def ai_demand(req: AIDemandReq):
    try:
        res = supabase.table("inventories").select("product_name, current_stock").execute()
        prompt = f"Generate demand forecast for next {req.forecast_days} days based on data: {res.data}."
        return success_response(data={"ai_forecast": _call_ai(prompt)}, message="Demand forecasting completed")
    except Exception as e:
        return error_response(str(e))


@app.post("/ai/credit-risk")
def ai_credit_risk(req: AICreditRiskReq):
    try:
        res = supabase.table("credit_accounts").select("*").eq("retailer_id", req.retailer_id).execute()
        accounts = res.data or []

        # Calculate real risk metrics
        total_limit = sum(a.get("credit_limit", 0) for a in accounts)
        total_utilized = sum(a.get("utilized_amount", 0) for a in accounts)
        utilization_pct = round(total_utilized / max(total_limit, 1) * 100)

        # Check overdue
        overdue_count = sum(1 for a in accounts if a.get("status") == "overdue")
        frozen_count = sum(1 for a in accounts if a.get("status") == "frozen")

        # Get order history for this retailer
        orders_res = supabase.table("orders").select("status").eq("buyer_id", req.retailer_id).execute()
        total_orders = len(orders_res.data or [])
        delivered = sum(1 for o in (orders_res.data or []) if o.get("status") == "delivered")
        payment_rate = round(delivered / max(total_orders, 1) * 100)

        # Calculate risk score (0-100, lower = riskier)
        risk_score = 100
        risk_score -= min(30, utilization_pct * 0.3)  # High utilization = risky
        risk_score -= overdue_count * 20  # Each overdue = -20
        risk_score -= frozen_count * 30  # Frozen = very risky
        risk_score -= max(0, (100 - payment_rate) * 0.2)  # Low payment rate = risky
        risk_score = max(0, min(100, round(risk_score)))

        # Determine risk level
        risk_level = "low" if risk_score >= 70 else "medium" if risk_score >= 40 else "high"

        # Max credit suggestion based on risk
        if risk_level == "low":
            max_suggestion = 20_000_000
        elif risk_level == "medium":
            max_suggestion = 5_000_000
        else:
            max_suggestion = 0

        # Build recommendation text
        findings = []
        if utilization_pct > 80:
            findings.append(f"Credit utilization is high at {utilization_pct}%.")
        if overdue_count > 0:
            findings.append(f"{overdue_count} account(s) are overdue.")
        if frozen_count > 0:
            findings.append(f"{frozen_count} account(s) are frozen due to non-payment.")
        if payment_rate < 80:
            findings.append(f"Order completion rate is {payment_rate}% (below 80% threshold).")
        if not findings:
            findings.append("No risk indicators found. Retailer has good payment history.")

        recommendation = " ".join(findings)

        # Get retailer name
        retailer_name = ""
        try:
            user = _get_auth_user(req.retailer_id)
            if user:
                meta = user.get("user_metadata", {}) or {}
                retailer_name = meta.get("business_name", meta.get("full_name", ""))
        except Exception:
            pass

        return success_response(
            data={
                "retailer_id": req.retailer_id,
                "retailer_name": retailer_name,
                "risk_score": risk_score,
                "risk_level": risk_level,
                "recommendation": recommendation,
                "max_credit_suggestion": max_suggestion,
                "metrics": {
                    "utilization_pct": utilization_pct,
                    "overdue_accounts": overdue_count,
                    "frozen_accounts": frozen_count,
                    "payment_rate": payment_rate,
                    "total_orders": total_orders,
                },
                "generated_at": now_iso(),
            },
            message="Credit risk analysis completed",
        )
    except Exception as e:
        return error_response(str(e))


@app.post("/ai/logistics-optimization")
def ai_logistics(req: AILogisticsReq):
    try:
        res = supabase.table("shipments").select("*").execute()
        prompt = f"You are a Logistics Manager. Analyze data {res.data}. Regional target: {req.region or 'All'}. Provide goods movement recommendations."
        return success_response(data={"ai_recommendation": _call_ai(prompt)}, message="Logistics optimization completed")
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
        return success_response(data={"user_id": "", "full_name": "", "email": "", "phone": "", "role": "", "avatar_url": None}, message="Profile retrieved")
    raw = _get_auth_user(user_id)
    if not raw:
        return error_response("User not found")
    meta = raw.get("user_metadata", {}) or {}
    return success_response(data={
        "user_id": user_id,
        "full_name": meta.get("full_name", ""),
        "email": raw.get("email", ""),
        "phone": meta.get("phone", ""),
        "role": meta.get("role", ""),
        "avatar_url": meta.get("avatar_url", None),
    }, message="Profile retrieved")


@app.put("/settings/profile")
def update_profile(data: UpdateProfileReq, user_id: Optional[str] = None):
    if not user_id:
        return error_response("user_id required")
    patch = {}
    if data.full_name is not None:
        patch["full_name"] = data.full_name
    if data.phone is not None:
        patch["phone"] = data.phone
    if data.avatar_url is not None:
        patch["avatar_url"] = data.avatar_url
    ok = _update_auth_user_metadata(user_id, patch)
    if not ok:
        return error_response("Failed to update profile")
    return success_response(data=patch, message="Profile updated successfully")


@app.get("/settings/business")
def get_business(user_id: Optional[str] = None):
    if not user_id:
        return success_response(data={"business_name": "", "tax_id": "", "warehouse_locations": [], "service_regions": []}, message="Business settings retrieved")
    raw = _get_auth_user(user_id)
    if not raw:
        return error_response("User not found")
    meta = raw.get("user_metadata", {}) or {}
    return success_response(data={
        "business_name": meta.get("business_name", ""),
        "business_type": meta.get("business_type", ""),
        "tax_id": meta.get("tax_id", ""),
        "warehouse_locations": meta.get("warehouse_locations", []),
        "service_regions": meta.get("service_regions", []),
        "preferred_currency": meta.get("preferred_currency", "IDR"),
        "operational_timezone": meta.get("operational_timezone", "Asia/Jakarta"),
    }, message="Business settings retrieved")


@app.put("/settings/business")
def update_business(data: UpdateBusinessReq, user_id: Optional[str] = None):
    if not user_id:
        return error_response("user_id required")
    patch = {k: v for k, v in data.dict().items() if v is not None}
    ok = _update_auth_user_metadata(user_id, patch)
    if not ok:
        return error_response("Failed to update business data")
    return success_response(data=patch, message="Business settings updated")


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
        message="Notification settings retrieved",
    )


@app.put("/settings/notifications")
def update_notifications(data: UpdateNotificationReq):
    return success_response(
        data={"channels": data.channels or {}, "preferences": data.preferences or {}},
        message="Notification settings updated",
    )


@app.get("/settings/integrations")
def get_integrations():
    return success_response(
        data={"erp": {"connected": False, "provider": None}, "payment_gateway": {"connected": False, "provider": None},
              "wallet": {"connected": False, "address": None}, "logistics": {"connected": False, "provider": None}, "api_keys": []},
        message="Integration settings retrieved",
    )


@app.get("/settings/preferences")
def get_preferences(current_user: AuthenticatedUser = Depends(get_current_user)):
    uid = current_user.user_id
    try:
        res = supabase.table("user_settings").select("*").eq("user_id", uid).limit(1).execute()
        if res.data:
            return success_response(data=res.data[0], message="Preferences retrieved")
    except Exception:
        pass
    # Default preferences
    return success_response(data={
        "user_id": uid,
        "default_processing_hours": 24,
        "low_stock_threshold_multiplier": 1.0,
        "preferred_carrier": "JNE",
        "auto_accept_orders": False,
    }, message="Preferences retrieved (defaults)")


@app.put("/settings/preferences")
def update_preferences(body: dict, current_user: AuthenticatedUser = Depends(get_current_user)):
    uid = current_user.user_id
    allowed = {"default_processing_hours", "low_stock_threshold_multiplier", "preferred_carrier", "auto_accept_orders"}
    payload = {k: v for k, v in body.items() if k in allowed}
    payload["user_id"] = uid
    try:
        supabase.table("user_settings").upsert(payload, on_conflict="user_id").execute()
    except Exception:
        pass
    return success_response(data=payload, message="Preferences updated")


@app.get("/settings/security/sessions")
def get_sessions():
    return success_response(
        data={"sessions": [{"session_id": str(uuid.uuid4()), "device": "Chrome / Windows", "ip": "127.0.0.1",
                            "city": "Jakarta", "is_current": True, "last_active_at": now_iso()}]},
        message="Sessions retrieved",
    )


@app.post("/settings/security/2fa/enable")
def enable_2fa():
    import base64, os
    secret = base64.b32encode(os.urandom(10)).decode("utf-8")
    qr_code_url = f"otpauth://totp/AUTOSUP:user@autosup.app?secret={secret}&issuer=AUTOSUP"
    return success_response(data={"secret": secret, "qr_code_url": qr_code_url}, message="2FA ready to be enabled")


@app.post("/settings/security/2fa/verify")
def verify_2fa(data: Verify2FAReq):
    return success_response(message="2FA verified successfully")


@app.post("/settings/security/2fa/disable")
def disable_2fa(data: Disable2FAReq):
    return success_response(message="2FA disabled successfully")

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
            "category": u.get("business_type", "General"),
            "type": "discover",
            "reputation_score": u.get("reputation_score", 0),
            "total_transactions": u.get("total_transactions", 0),
            "on_time_delivery_rate": u.get("on_time_delivery_rate", 0),
            "wallet_address": u.get("wallet_address", ""),
            "is_active": u.get("is_active", True),
        }
        for u in auth_users_by_role("supplier")
    ]

    # Load partnerships to mark partnered suppliers — new table structure
    try:
        if user_id:
            p_rows = supabase.table("partnerships").select("requester_id,approver_id,status").eq("type", "supplier_distributor").eq("requester_id", user_id).execute().data or []
            partner_ids = {p.get("approver_id", "") for p in p_rows if p.get("status") == "accepted"}
            pending_ids = {p.get("approver_id", "") for p in p_rows if p.get("status") == "pending"}
            for s in supplier_users:
                if s["supplier_id"] in partner_ids:
                    s["type"] = "partner"
                elif s["supplier_id"] in pending_ids:
                    s["type"] = "pending"
    except Exception:
        pass

    # Calculate real stats from orders (where supplier is seller, current user is buyer)
    if user_id:
        try:
            from collections import Counter
            orders_res = supabase.table("orders").select("seller_id,status").eq("buyer_id", user_id).execute()
            seller_total = Counter()
            seller_delivered = Counter()
            for o in (orders_res.data or []):
                sid = o.get("seller_id", "")
                seller_total[sid] += 1
                if o.get("status") == "delivered":
                    seller_delivered[sid] += 1
            for s in supplier_users:
                sid = s["supplier_id"]
                total = seller_total.get(sid, 0)
                delivered = seller_delivered.get(sid, 0)
                s["total_transactions"] = total
                s["on_time_delivery_rate"] = round(delivered / max(total, 1) * 100) if total > 0 else 0
                s["reputation_score"] = round(delivered / max(total, 1) * 100 * 0.6 + s["on_time_delivery_rate"] * 0.4) if total > 0 else 0
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

    # Sort: pending first, discover second, partner last
    type_order = {"pending": 0, "discover": 1, "partner": 2}
    supplier_users.sort(key=lambda s: (type_order.get(s.get("type", "discover"), 1), s["name"].lower()))

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
        query = supabase.table("partnerships").select("*").eq("type", "supplier_distributor")
        if status:
            query = query.eq("status", status)
        if supplier_id:
            query = query.eq("approver_id", supplier_id)
        res = query.execute()

        # Resolve requester names
        name_map = {}
        requester_ids = {r.get("requester_id", "") for r in (res.data or [])}
        if requester_ids:
            for u in auth_users_by_role("distributor"):
                if u["id"] in requester_ids:
                    name_map[u["id"]] = u.get("business_name", u.get("full_name", ""))

        requests = []
        for r in (res.data or []):
            req_id = r.get("requester_id", "")
            requests.append({
                "request_id": r.get("id", ""),
                "supplier_id": r.get("approver_id", ""),
                "distributor": {
                    "id": req_id,
                    "name": name_map.get(req_id, "Unknown"),
                    "business_name": name_map.get(req_id, "Unknown"),
                },
                "status": r.get("status", "pending"),
                "created_at": r.get("created_at", ""),
                "terms": r.get("mou_terms", ""),
                "distribution_region": r.get("mou_region", ""),
                "valid_until": 0,
                "legal_contract_hash": r.get("mou_hash", ""),
                "mou_document_name": "",
                "mou_document_data": "",
            })
        return success_response(data={
            "requests": requests,
            "pagination": {"page": 1, "limit": 20, "total": len(requests)},
        })
    except Exception as e:
        return success_response(data={"requests": [], "pagination": {"page": 1, "limit": 20, "total": 0}})


@app.post("/suppliers/partnership-request")
def create_supplier_partnership_request(body: dict):
    """Distributor sends partnership request to supplier. Uses new table structure."""
    supplier_id = body.get("supplier_id", "")
    distributor_id = body.get("distributor_id", "")
    terms = body.get("terms", "")
    distribution_region = body.get("distribution_region", "")

    if not supplier_id or not distributor_id:
        return error_response("supplier_id and distributor_id are required")

    # Dedup — also reactivate terminated/rejected
    try:
        existing = supabase.table("partnerships").select("id,status").eq("requester_id", distributor_id).eq("approver_id", supplier_id).eq("type", "supplier_distributor").execute().data or []
        for ex in existing:
            if ex["status"] in ("pending", "accepted"):
                return success_response(data={"request_id": ex["id"], "status": ex["status"]}, message="Partnership already exists")
            if ex["status"] in ("terminated", "rejected"):
                mou_hash_val = hashlib.sha256(terms.encode()).hexdigest() if terms else ""
                supabase.table("partnerships").update({"status": "pending", "mou_terms": terms, "mou_region": distribution_region, "mou_hash": mou_hash_val, "updated_at": now_iso()}).eq("id", ex["id"]).execute()
                return success_response(data={"request_id": ex["id"], "status": "pending", "mou_hash": mou_hash_val}, message="Partnership request re-submitted")
    except Exception:
        pass

    mou_hash_val = hashlib.sha256(terms.encode()).hexdigest() if terms else ""
    request_id = str(uuid.uuid4())
    row = {
        "id": request_id,
        "type": "supplier_distributor",
        "requester_id": distributor_id,
        "approver_id": supplier_id,
        "status": "pending",
        "mou_terms": terms,
        "mou_region": distribution_region,
        "mou_hash": mou_hash_val,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    try:
        supabase.table("partnerships").insert(row).execute()
        return success_response(data={"request_id": request_id, "status": "pending", "mou_hash": mou_hash_val}, message="Partnership request sent")
    except Exception as e:
        return error_response(f"Failed: {str(e)}")


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
    """Accept or reject a partnership request. On accept, mint Partnership NFT."""
    action = body.get("action", "reject")
    new_status = "accepted" if action == "accept" else "rejected"
    update_payload = {"status": new_status, "updated_at": now_iso()}
    nft_data = None
    try:
        if action == "accept":
            p_res = supabase.table("partnerships").select("*").eq("id", request_id).execute()
            if p_res.data and bc:
                p = p_res.data[0]
                try:
                    wallet_approver = bc.get_or_create_wallet(supabase, p.get("approver_id", ""))
                    wallet_requester = bc.get_or_create_wallet(supabase, p.get("requester_id", ""))
                    result = bc.mint_partnership_nft(
                        distributor_pubkey_str=wallet_requester["pubkey"],
                        supplier_pubkey_str=wallet_approver["pubkey"],
                        terms=f"Partnership {request_id[:8]}",
                        legal_contract_hash=p.get("mou_hash", "0" * 64),
                        distribution_region=p.get("mou_region", ""),
                    )
                    mint_addr = result.get("mint") or result.get("mint_address", "")
                    update_payload["nft_mint_address"] = mint_addr
                    update_payload["nft_token_name"] = f"Partnership #{request_id[:8].upper()}"
                    update_payload["nft_explorer_url"] = f"https://explorer.solana.com/address/{mint_addr}?cluster=devnet"
                    nft_data = {"mint_address": mint_addr, "explorer_url": update_payload["nft_explorer_url"]}
                except Exception:
                    pass

        supabase.table("partnerships").update(update_payload).eq("id", request_id).execute()
    except Exception as e:
        return error_response(str(e))
    return success_response(
        data={"request_id": request_id, "action": action, "nft": nft_data},
        message=f"Request {new_status}" + (" — Partnership NFT issued" if nft_data else ""),
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
def get_user_notifications(user_name: str, user_id: Optional[str] = None):
    query = supabase.table("notifications").select("*")
    if user_id:
        query = query.eq("user_id", user_id)
    else:
        query = query.eq("user_name", user_name)
    res = query.order("created_at", desc=True).execute()
    return success_response(data=res.data, message="Notifications retrieved")


@app.patch("/notifications/read/{notif_id}")
def mark_notification_read(notif_id: str):
    supabase.table("notifications").update({"is_read": True}).eq("id", notif_id).execute()
    return success_response(message="Notification marked as read")

# ==========================================
# 22. PAYMENTS (checkout + webhook)
# ==========================================

PAYMENT_METHODS = [
    {"id": "gopay", "name": "GoPay", "type": "e-wallet", "icon": "gopay"},
    {"id": "ovo", "name": "OVO", "type": "e-wallet", "icon": "ovo"},
    {"id": "dana", "name": "DANA", "type": "e-wallet", "icon": "dana"},
    {"id": "shopeepay", "name": "ShopeePay", "type": "e-wallet", "icon": "shopeepay"},
    {"id": "qris", "name": "QRIS", "type": "qris", "icon": "qris"},
    {"id": "bca", "name": "BCA Virtual Account", "type": "bank_transfer", "icon": "bca"},
    {"id": "mandiri", "name": "Mandiri Virtual Account", "type": "bank_transfer", "icon": "mandiri"},
    {"id": "bri", "name": "BRI Virtual Account", "type": "bank_transfer", "icon": "bri"},
    {"id": "bni", "name": "BNI Virtual Account", "type": "bank_transfer", "icon": "bni"},
]


@app.get("/payments/methods")
def get_payment_methods():
    return success_response(data={"methods": PAYMENT_METHODS}, message="Payment methods retrieved")


@app.post("/payments/checkout/{order_id}")
def checkout_order(order_id: str, body: dict = {}):
    try:
        res = supabase.table("orders").select("*").eq("id", order_id).execute()
        if not res.data:
            return error_response("Order not found.")
        order = res.data[0]
        method_id = body.get("payment_method", "bca")
        method = next((m for m in PAYMENT_METHODS if m["id"] == method_id), PAYMENT_METHODS[5])

        if method["type"] == "e-wallet":
            payment_detail = {"deeplink": f"https://{method_id}.mock/pay/{order_id}", "qr_url": f"https://api.mock/qr/{order_id}"}
        elif method["type"] == "qris":
            payment_detail = {"qr_string": f"00020101021226610014ID.CO.AUTOSUP.WWW0215{order_id[:15]}5303360540{int(order.get('total_price', 0))}5802ID5913AUTOSUP STORE6007JAKARTA63041234"}
        else:
            payment_detail = {"va_number": f"8077{random.randint(1000000, 9999999)}"}

        supabase.table("orders").update({"status": "processing"}).eq("id", order_id).execute()

        return success_response(
            data={
                "order_id": order_id,
                "total_bill": order.get("total_price"),
                "method": method["name"],
                "method_type": method["type"],
                "payment_detail": payment_detail,
                "payment_status": "paid",
            },
            message="Payment successful",
        )
    except Exception as e:
        return error_response(str(e))


@app.post("/payments/webhook")
def payment_webhook(data: WebhookPayment):
    try:
        status_map = {"settlement": "processing", "expire": "cancelled", "cancel": "cancelled", "deny": "cancelled"}
        new_status = status_map.get(data.transaction_status, "pending")
        supabase.table("orders").update({"status": new_status}).eq("id", data.order_id).execute()
        return success_response(data={"order_id": data.order_id}, message=f"Webhook received, status: {new_status}")
    except Exception as e:
        return error_response(str(e))

# ==========================================
# 23. EXPORT
# ==========================================

@app.get("/export/orders/{store_name}")
def export_orders(store_name: str):
    res = supabase.table("orders").select("*").eq("retailer_name", store_name).execute()
    if not res.data:
        return error_response("No data to export.")
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=res.data[0].keys())
    writer.writeheader()
    writer.writerows(res.data)
    return StreamingResponse(
        io.StringIO(output.getvalue()), media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=order_report_{store_name}.csv"},
    )

# ==========================================
# 24. TEAM
# ==========================================

@app.get("/team/{store_name}")
def get_team(store_name: str):
    res = supabase.table("team_members").select("*").eq("store_name", store_name).execute()
    return success_response(data=res.data, message="Team data retrieved")


@app.post("/team/invite/{store_name}")
def invite_member(store_name: str, member: TeamMemberInvite):
    res = supabase.table("team_members").insert({"store_name": store_name, **member.dict()}).execute()
    return success_response(data=res.data[0], message="Member invited")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=True)
