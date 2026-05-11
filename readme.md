# AUTOSUP

**AI-powered supply chain operating system for Indonesian MSMEs on Solana.**

AUTOSUP is a full-stack supply chain platform connecting **suppliers**, **distributors**, and **retailers** through an AI-driven operational dashboard, blockchain-based trust layer, and intelligent restock/forecast engine. Built for medium-scale businesses that need structured order flows, partnership reputation, and data-driven inventory decisions — without exposing users to raw crypto complexity.

---

## Contents

- [Why AUTOSUP](#-why-autosup)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Repository Structure](#-repository-structure)
- [Quick Start](#-quick-start)
- [Roles & Access](#-roles--access)
- [Features](#-features)
- [Trust Layer](#-trust-layer)
- [API Contract](#-api-contract)
- [Development](#-development)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 🎯 Why AUTOSUP

| Problem | AUTOSUP Solution |
|---------|-----------------|
| Inventory monitoring is manual and reactive | AI-powered restock alerts with suggested seller and quantity |
| Supplier/distributor relationships are unstructured | Partnership NFTs (Solana) + on-chain reputation scoring |
| Order tracking lacks transparency | Real-time status pipeline with escrow-held payments |
| No data-driven restock decisions | Demand forecasting, geo heatmaps, product performance insights |
| Multiple roles share the same view | Role-aware dashboards: supplier, distributor, retailer |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend — Next.js App Router (TypeScript + Tailwind + Radix)  │
│  Role-aware dashboards · AI agents · Analytics · Orders         │
├─────────────────────────────────────────────────────────────────┤
│  Backend — FastAPI (Python)                                     │
│  Auth · CRUD · AI orchestration · Blockchain proxy              │
├─────────────────────────────────────────────────────────────────┤
│  AI Layer — Google Gemini                                       │
│  Restock recommendations · Demand forecasting · Credit risk     │
├─────────────────────────────────────────────────────────────────┤
│  Trust Layer — Solana Devnet (Rust / Anchor)                    │
│  Partnership NFTs · Smart Escrow · On-chain Reputation          │
└─────────────────────────────────────────────────────────────────┘
```

**Supply chain hierarchy (MVP):**
```
Supplier ──→ Distributor ──→ Retailer ──→ Consumer
```

Distributors buy from suppliers, sell to retailers. Retailers serve end consumers. Logistics partners are managed entities (not login roles).

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16 (App Router) · TypeScript · Tailwind CSS · Shadcn/UI · Radix UI · Zustand · React Query (TanStack) |
| **Charts** | Recharts |
| **QR / 2FA** | qrcode.react |
| **Backend** | FastAPI · Python 3.10+ |
| **Database** | PostgreSQL (Supabase) · Supabase Auth (JWT) |
| **AI** | Google Gemini API |
| **Blockchain** | Solana Devnet · Rust · Anchor |
| **Package Manager** | npm |

---

## 📂 Repository Structure

```
autosup/
├── backend/                    # Python FastAPI service
│   ├── main.py                 # Application entry
│   ├── main_teammate.py        # Teammate agent logic
│   ├── requirements.txt        # Python dependencies
│   └── README.md
├── contracts/                  # Solana smart contracts (Rust/Anchor)
├── frontend/                   # Next.js dashboard application
│   ├── app/
│   │   ├── auth/               # Login & register pages
│   │   └── dashboard/          # Role-aware dashboard pages
│   │       ├── ai-agents/      # AI agent configuration
│   │       ├── analytics/      # 3-role analytics views
│   │       ├── credit/         # Credit line management
│   │       ├── dashboard/      # Main role dashboard
│   │       ├── demand/         # Demand intelligence
│   │       ├── distributors/   # Distributor discovery & partners
│   │       ├── geo/            # Regional demand heatmap
│   │       ├── inventory/      # Stock management
│   │       ├── logistics/      # Shipment tracking
│   │       ├── orders/         # Order creation & tracking
│   │       ├── partnerships/   # 3-role partnership view
│   │       ├── payment/        # Payments & invoices
│   │       ├── retailers/      # Retailer CRM (distributor)
│   │       ├── settings/       # Profile, 2FA, notifications
│   │       └── suppliers/      # Supplier discovery & partners
│   ├── components/             # Reusable UI components
│   ├── hooks/                  # React Query hooks
│   ├── lib/                    # API client, mocks, utils
│   ├── store/                  # Zustand stores
│   └── package.json
└── docs/                       # Additional documentation
```

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| [Node.js](https://nodejs.org/) | **18.x LTS** or newer |
| [npm](https://www.npmjs.com/) | **9.x** or newer |
| [Python](https://www.python.org/) | **3.10+** (for backend) |

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Default local URL: `http://localhost:3000`

```bash
npm run lint       # ESLint check
npm run build      # Production build
```

### Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Default API URL: `http://localhost:8000`

### Environment Variables

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
```

---

## 👤 Roles & Access

| Role | Description | Key Actions |
|------|-------------|-------------|
| **Supplier** | Product producer/manufacturer | Manage products · Process incoming orders from distributors · Monitor regional demand · Review distributor partnerships |
| **Distributor** | Middle-tier buyer & seller | Manage inventory · Order from suppliers · Sell to retailers · Manage credit lines · Track logistics |
| **Retailer** | End-business (cafés, restaurants, bakeries) | Purchase from distributors · Track internal inventory · Manage payments & invoices · View analytics |

---

## ✨ Features

### 📊 Dashboard (per-role)
- Role-specific KPI cards (low stock, active orders, partner count, revenue)
- AI insights panel with urgency badges
- Quick-action buttons (create order, find partners)

### 📦 Inventory
- Real-time stock monitoring (`in_stock` · `low_stock` · `out_of_stock`)
- AI restock recommendations with suggested seller, quantity, and delivery estimate
- One-click "Create Order" from restock panel

### 📋 Orders
- **3-role order flow**: Supplier ↔ Distributor ↔ Retailer
- Outgoing / Incoming tabs for distributors
- Shipping info with courier, tracking number, and tracking URL
- Status pipeline: `pending → processing → shipping → delivered`
- "Terima Barang" (confirm delivery) for buyers
- Escrow status: `held` · `released` · `refunded`

### 🤝 Partnerships
- Partner discovery and request/approve flow
- Partnership NFT badges (Solana) with explorer links
- Trust score and reliability metrics per partner
- 3-role views (distributor sees suppliers + retailers)

### 📈 Analytics
- **Supplier**: Revenue, Demand, Orders, Fulfillment tabs with trend charts + distributor performance ranking + product insights (top selling, declining, stock risk)
- **Distributor**: Revenue vs Spending bar chart + top products
- **Retailer**: Revenue vs Spending trends + forecast accuracy

### 🗺️ Geo Mapping (Supplier only)
- Regional demand heatmap with color-coded demand scores
- Product filter dropdown
- Region detail panel with growth metrics
- Demand score ranking table

### 💰 Payments & Credit
- Invoice management (draft · sent · pending · paid · overdue · cancelled)
- Credit line accounts with utilization tracking
- Payment settlement flow
- AI cash flow optimization insights

### 🤖 AI Agents
- Configurable automation levels: Manual Approval · Auto with Threshold · Auto Execute
- Agent types: Auto Restock · Demand Forecast · Price Optimization · Cash Flow Optimizer
- Activity log with impact summaries

### ⚙️ Settings
- Profile editing (syncs across auth store)
- Business info management (name, type, NPWP, warehouse/branch locations)
- 2FA setup with QR code (qrcode.react) and TOTP verification
- Notification channel and preference toggles (optimistic UI updates)
- Web3 wallet integration placeholder

---

## 🔐 Trust Layer

AUTOSUP surfaces blockchain trust without exposing users to wallets or crypto flows:

| Component | Purpose |
|-----------|---------|
| **Partnership NFTs** | Soulbound tokens minted on Solana Devnet for verified supplier/distributor/retailer relationships |
| **Smart Escrow** | IDR-denominated payment holds released on delivery confirmation |
| **Reputation Score** | On-chain score aggregated from fulfillment rate, payment punctuality, and delivery performance |
| **NFT Badges** | Visual chips in the UI with explorer links — no wallet required for end users |

---

## 📋 API Contract

The primary source of truth for endpoints, request/response shapes, roles, and enums is `frontend/plan/api-contract.md`.

Key conventions:
- Base URL: `http://localhost:8000`
- Auth: JWT via `Authorization: Bearer <token>`
- Role header: `x-user-role` for role-aware endpoints
- Generic buyer/seller pattern for orders
- Status enums are fixed contracts (do not change without updating all consumers)

---

## 🔧 Development

### Decision Priority
1. `frontend/plan/api-contract.md` — data contracts & enums
2. `frontend/plan/PRD.md` — product scope & acceptance criteria
3. `frontend/plan/CONTEXT.md` — session continuity & progress tracking

### Code Conventions
- Role-aware UX: `supplier` · `distributor` · `retailer`
- Dashboard-first UI, not marketing-first
- Mock data shapes must match API contracts
- No `alert()` — use proper error states
- All states required: loading, empty, error, happy path
- Trust layer surfaced as backend-driven result, not browser-side crypto

### Git Conventions
- `feat(scope): description` — new features
- `refactor(scope): description` — restructures
- `fix(scope): description` — bug fixes
- `chore: description` — tooling, config, ignores
- `docs: description` — documentation only

---

## 🗺 Roadmap

| Phase | Status | Focus |
|-------|--------|-------|
| **MVP Core** | ✅ Done | 3-role dashboards, inventory, orders, suppliers, distributors, partnerships, analytics, geo, demand, payment, settings, AI agents |
| **Backend Integration** | 🔄 In Progress | Connecting hooks to live FastAPI endpoints, real auth flow |
| **AI Enhancement** | 📋 Planned | Gemini-powered demand forecasting, dynamic pricing, anomaly detection |
| **Trust Layer** | 📋 Planned | Partnership NFT minting, smart escrow settlement, on-chain reputation |
| **Mobile PWA** | 📋 Planned | Responsive mobile-first experience |

---

## 📝 License

MIT

---

<div align="center">

**Built for Indonesian MSME supply chains**

[Report Bug](https://github.com/AbdulHalim26/autosup/issues) · [Request Feature](https://github.com/AbdulHalim26/autosup/issues)

</div>
