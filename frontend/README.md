# AUTOSUP Frontend

Frontend AUTOSUP adalah dashboard operasional untuk dua role utama: `distributor` dan `supplier`. Aplikasi ini dibangun sebagai App Router project di atas Next.js dan menjadi permukaan utama untuk authentication, monitoring stok, supplier partnership, order tracking, dan AI-assisted restock flow.

Dokumen ini ditujukan untuk developer internal. Fokusnya adalah cara menjalankan project, memahami struktur frontend, dan tahu dokumen mana yang menjadi acuan implementasi. Untuk saat ini, project masih berada di fase awal dan beberapa route, hooks, dan helper masih bersifat skeletal.

## Core MVP

Frontend ini mengikuti scope Core MVP yang sudah didefinisikan di `frontend/PRD.md`:
- authentication dan role-based access
- dashboard monitoring
- inventory management
- suppliers dan partnership
- orders dan tracking
- AI restock recommendation

Role dan naming yang harus dianggap fixed:
- role: `supplier`, `distributor`
- inventory status: `in_stock`, `low_stock`, `out_of_stock`
- order status: `pending`, `processing`, `shipping`, `delivered`, `cancelled`

## Tech Stack

- Next.js `16.2.4` dengan App Router
- React `19`
- Tailwind CSS `4`
- Shadcn/UI dan Radix UI
- Zustand
- React Query
- Axios
- Google reCAPTCHA v3

Backend yang menjadi pasangan frontend ini:
- FastAPI untuk API layer
- Supabase untuk auth dan database
- Google Gemini API untuk AI use cases

## Quick Start

Jalankan dari folder `frontend/`.

```bash
npm install
npm run dev
```

Frontend lokal akan jalan di:

```text
http://localhost:3000
```

Command lain yang perlu dipakai saat development:

```bash
npm run lint
npm run build
npm run start
```

Panduan penggunaan command:
- `npm run dev`: jalankan local dev server
- `npm run lint`: cek linting project
- `npm run build`: verifikasi build App Router
- `npm run start`: jalankan hasil production build

## Konfigurasi Environment

Frontend membutuhkan file `.env.local` untuk konfigurasi lokal.

Variable yang sudah diketahui dari dokumen saat ini:

```env
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_site_key_here
```

Catatan:
- Login flow mengharuskan `recaptcha_token`, jadi reCAPTCHA v3 perlu disiapkan untuk environment lokal yang dipakai.
- Base API development saat ini mengacu ke `api-contract.md`:

```text
http://localhost:8000/api/v1
```

- Jangan memperkenalkan env contract baru tanpa keputusan eksplisit dari tim atau tanpa update di dokumen source of truth.

## Struktur Folder

Struktur utama frontend saat ini:

```text
frontend/
  app/
  components/
  hooks/
  lib/
  public/
  store/
  AGENTS.md
  CLAUDE.md
  PRD.md
  autosup.md
```

Fungsi folder:
- `app/`: route App Router dan layout halaman
- `components/`: reusable UI components
- `hooks/`: data hooks dan feature hooks
- `lib/`: API helper, utilities, constants, shared helpers
- `public/`: static assets
- `store/`: Zustand stores untuk global state

## Route dan Feature Surface Saat Ini

Route yang sudah ada di repo:
- `app/auth/login/page.tsx`
- `app/dashboard/layout.tsx`
- `app/dashboard/dashboard/page.tsx`
- `app/dashboard/inventory/page.tsx`
- `app/dashboard/orders/page.tsx`
- `app/dashboard/suppliers/page.tsx`

Hooks dan helper yang sudah disiapkan:
- `hooks/useAuth.ts`
- `hooks/useInventory.ts`
- `hooks/useOrders.ts`
- `store/useAuthStore.ts`
- `lib/api.ts`

Status saat ini:
- beberapa file route masih kosong atau skeletal
- hooks dan helper inti juga masih menjadi placeholder
- dokumen produk dan aturan implementasi sudah disiapkan sebagai fondasi sebelum implementasi penuh

## Source of Truth

Sebelum mengubah kode frontend, baca dokumen-dokumen ini:

1. `api-contract.md`
   - source of truth untuk endpoint, request/response shape, role naming, dan enum status
2. `frontend/PRD.md`
   - source of truth untuk scope MVP, behavior produk, dan acceptance criteria
3. `frontend/AGENTS.md`
   - workflow agent, boundaries, stop conditions, dan handoff rules
4. `frontend/CLAUDE.md`
   - tech stack, coding conventions, dan implementation guardrails
5. `frontend/autosup.md`
   - visi produk, pain points, dan framing UX

Jika ada konflik:
- `api-contract.md` menang untuk kontrak data
- `frontend/PRD.md` menang untuk scope dan behavior produk
- `frontend/AGENTS.md` dan `frontend/CLAUDE.md` mengatur cara implementasi frontend

## Konvensi Kerja Frontend

Aturan kerja yang perlu dijaga:
- UI harus role-aware untuk `distributor` dan `supplier`
- API call sebaiknya masuk lewat helper dan hooks, bukan fetch acak di komponen
- jangan gunakan `alert()` untuk error handling
- siapkan loading state, empty state, error state, dan happy path state
- tampilkan trust layer seperti partnership, escrow, dan reputation sebagai backend-driven result
- jangan menciptakan endpoint baru atau mengubah enum agar menyesuaikan UI

Prinsip implementasi:
- pertahankan scope tetap di Core MVP
- utamakan reusable component
- gunakan mock data hanya jika backend belum siap, tetapi shape-nya tetap harus mengikuti `api-contract.md`

## Status Implementasi

Repo frontend ini masih berada di fase bootstrap menuju implementasi penuh. Dokumen sudah lebih matang daripada code surface saat ini.

Artinya:
- README ini adalah panduan masuk
- `PRD.md` mendefinisikan apa yang harus dibangun
- `AGENTS.md` mendefinisikan cara agent bekerja
- `CLAUDE.md` mendefinisikan aturan implementasi dan stack

Saat mulai coding, anggap beberapa file yang ada sekarang sebagai skeleton awal, bukan implementasi final.

## Verifikasi Saat Development

Sebelum menutup perubahan frontend, biasakan cek:

```bash
npm run lint
```

Untuk perubahan yang menyentuh route structure, App Router boundary, shared layout, atau wiring besar, pertimbangkan:

```bash
npm run build
```

Jika command verifikasi belum dijalankan, sebutkan itu secara eksplisit saat handoff.
