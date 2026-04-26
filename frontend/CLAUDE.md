@AGENTS.md

# AUTOSUP Frontend AI Instructions

Dokumen ini berisi instruksi khusus untuk AI yang bekerja di folder `frontend/`.
Tujuannya agar implementasi konsisten dengan PRD, API contract, dan arsitektur tim.

## 1. Project Context

AUTOSUP adalah platform supply chain untuk dua role utama:
- `distributor`
- `supplier`

Frontend ini dipakai untuk dashboard operasional yang responsif, cepat, dan mudah dipakai oleh UMKM. Fokus Core MVP saat ini:
- authentication dan role-based access
- dashboard monitoring
- inventory management
- suppliers dan partnership
- orders dan tracking
- AI restock recommendation

Source of truth produk dan API:
- `frontend/PRD.md`
- `api-contract.md`
- `frontend/autosup.md`

Jika ada konflik:
1. `api-contract.md` menang untuk endpoint, role, status enum, dan response shape
2. `frontend/PRD.md` menang untuk scope MVP dan behavior produk
3. `frontend/autosup.md` menang untuk visi produk dan framing UX

## 2. Tech Stack

### Frontend
- Framework: Next.js 14+ dengan App Router
- Styling: Tailwind CSS
- Component Library: Shadcn/UI dan/atau Radix UI
- State Management: Zustand sebagai default untuk global app state; React Context hanya untuk scope sempit
- Deployment: Vercel

### Backend and Data
- Backend API: FastAPI
- Language: Python 3.10+
- Validation: Pydantic
- Database: PostgreSQL via Supabase
- Auth: Supabase Auth dengan JWT
- Backend hosting: Render atau Railway

### AI Layer
- Provider: Google Gemini API
- Use cases utama:
  - smart inventory dan restock recommendation
  - credit risk analysis
  - demand forecasting
- Output AI dari backend harus diperlakukan sebagai JSON terstruktur, bukan free-form text

### Web3 Layer
- Chain: Solana Devnet
- Smart contract language: Rust
- Framework: Anchor
- Use cases utama:
  - Partnership SBT / Soulbound Token
  - reputation scoring on-chain

Catatan penting: frontend tidak menjadi pemilik logic blockchain. Frontend hanya menampilkan hasil trust layer dari backend.

## 3. Product and UX Rules

### Role awareness
- Semua pengalaman harus menyesuaikan role `distributor` atau `supplier`
- Jangan tampilkan CTA distributor di workspace supplier
- Jangan tampilkan action supplier di workspace distributor
- Dashboard, empty state, CTA, dan navigation harus role-aware

### MVP boundaries
- Kerjakan hanya fitur yang masuk Core MVP di `frontend/PRD.md`
- Jangan menambahkan credit management, geo mapping, analytics lanjutan, retailer management, atau wallet-native flow sebagai fitur utama tanpa instruksi baru
- AI recommendation di MVP bersifat assistive, bukan auto-order penuh

### UX principles
- Dashboard harus cepat dibaca dan fokus pada tindakan
- Empty state harus membantu user memulai langkah berikutnya
- Error message harus ramah, singkat, dan kontekstual
- Jangan gunakan `alert()`
- Gunakan toast, inline validation, atau status banner untuk feedback

### Trust layer rules
- Escrow, partnership NFT, dan supplier reputation ditampilkan sebagai hasil sistem
- Jangan memaksa user connect wallet untuk flow MVP umum
- Wallet address hanya relevan pada konteks partnership dan reputation surface

## 4. Coding Rules

### General
- Gunakan TypeScript secara ketat
- Utamakan server/client boundary yang jelas di App Router
- Ikuti pola Next.js modern; jangan mengandalkan asumsi lama
- Sebelum mengubah pola framework, cek dokumentasi Next.js lokal bila dibutuhkan

### Data access
- Semua komunikasi ke backend harus melalui helper API dan custom hook, bukan fetch acak di komponen UI
- Bungkus API call dalam lapisan yang rapi, misalnya:
  - `lib/api.ts` untuk request helper
  - `hooks/useAuth.ts`
  - `hooks/useInventory.ts`
  - `hooks/useOrders.ts`
- Gunakan response envelope dari `api-contract.md`:
  - `success`
  - `data`
  - `message`
  - `error_code` bila gagal

### State management
- Gunakan Zustand untuk state global seperti session, user profile, active role, dan UI state lintas halaman
- Jangan simpan data server yang seharusnya bisa di-refetch sebagai global state tanpa alasan jelas
- State form lokal tetap di komponen atau form layer masing-masing

### Components
- Prioritaskan komponen reusable untuk:
  - status badge
  - summary card
  - table/list inventory
  - supplier card/list
  - order status timeline
  - AI insight card
- Gunakan Shadcn/UI atau Radix UI bila ada komponen dasar yang cocok
- Jangan membuat komponen custom yang kompleks jika primitive library sudah memadai

### Styling
- Gunakan Tailwind utility classes
- Gunakan desain dashboard yang padat, rapi, dan fokus kerja
- Hindari layout marketing, hero page, atau halaman dekoratif
- Gunakan color cues yang konsisten untuk state:
  - navy `#0F172A`
  - blue `#3B82F6`
  - green `#22C55E`
  - orange `#F59E0B`
  - red `#EF4444`

## 5. Data and API Conventions

### Auth
- Endpoint protected wajib kirim `Authorization: Bearer <supabase_jwt_token>`
- Handle token refresh dengan mulus bila memungkinkan
- Login wajib mengirim `recaptcha_token`

### Roles
- Gunakan hanya role berikut:
  - `supplier`
  - `distributor`
- Jangan membuat alias role lain di UI atau data model

### Inventory
- Gunakan status backend apa adanya:
  - `in_stock`
  - `low_stock`
  - `out_of_stock`
- Inventory adalah source utama untuk trigger AI recommendation

### Orders
- Gunakan hanya status berikut:
  - `pending`
  - `processing`
  - `shipping`
  - `delivered`
  - `cancelled`
- Ketika status `delivered`, frontend hanya menampilkan bahwa escrow release dan reputation update diproses backend

### Suppliers and partnership
- Supplier listing minimal perlu membedakan:
  - `partner`
  - `discover`
- Partnership accept/reject hanya boleh dilakukan oleh role `supplier`
- Partnership NFT diperlakukan sebagai metadata hasil backend, bukan action on-chain langsung dari frontend

### AI output
- Asumsikan hasil AI sudah divalidasi backend dan dikirim sebagai JSON siap pakai
- Frontend cukup merender urgency, recommendation text, suggested quantity, dan suggested supplier

## 6. File and Architecture Conventions

Gunakan struktur ini sebagai arah kerja:
- `app/` untuk routes App Router
- `components/` untuk reusable UI
- `hooks/` untuk data hooks dan feature hooks
- `store/` untuk Zustand stores
- `lib/` untuk API client, utilities, constants, dan shared helpers

Konvensi umum:
- Satu file, satu tanggung jawab utama
- Nama komponen pakai PascalCase
- Nama hook pakai `useXxx`
- Nama store jelas, misalnya `useAuthStore`
- Jangan campur hardcoded mock besar ke dalam komponen; taruh di file mock terpisah bila perlu

## 7. Implementation Preferences for AI

Saat menulis atau mengubah kode frontend:
- Mulai dari PRD dan API contract, bukan dari tebakan
- Pilih solusi paling sederhana yang sesuai pola repo
- Utamakan komponen reusable dibanding copy-paste UI
- Jaga perubahan tetap terlokalisasi ke scope fitur yang sedang dikerjakan
- Jika backend belum siap, gunakan mock data yang bentuknya tetap mengikuti `api-contract.md`
- Jangan mengubah naming endpoint, enum, atau response envelope tanpa instruksi eksplisit

Saat membuat halaman baru:
- sediakan loading state
- sediakan empty state
- sediakan error state
- sediakan happy path state
- pertimbangkan role gating sejak awal

Saat membuat form:
- validasi field wajib
- tampilkan error inline bila relevan
- disable submit saat request berjalan
- tampilkan success/error feedback yang jelas

## 8. Non-Goals

AI yang bekerja di frontend tidak boleh:
- menciptakan flow blockchain langsung dari browser tanpa kebutuhan jelas
- menambah fitur di luar Core MVP hanya karena terlihat menarik
- mengubah kontrak API seenaknya
- memakai `alert()` untuk error handling
- membuat UI yang terasa seperti landing page marketing

## 9. Definition of Good Output

Output dianggap baik jika:
- konsisten dengan `frontend/PRD.md`
- konsisten dengan `api-contract.md`
- role-aware untuk distributor dan supplier
- mudah diimplementasikan lanjut oleh tim
- memakai pola Next.js + Tailwind + Shadcn/Radix + Zustand yang rapi
- siap di-deploy ke Vercel tanpa asumsi aneh
