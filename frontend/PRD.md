# PRD AUTOSUP Frontend Core MVP

Status: Draft  
Audience: Product, UI/UX, Frontend, Backend  
Bahasa: Indonesia

## 1. Ringkasan Produk

AUTOSUP adalah platform supply chain untuk distributor dan supplier yang membantu bisnis mengelola stok, membangun kemitraan, dan menjalankan proses restock dengan lebih cepat, terstruktur, dan terpercaya.

Masalah utama yang ingin diselesaikan:
- Monitoring stok masih manual dan sering terlambat.
- Proses restock masih panjang: cek stok, catat, cari supplier, lalu chat manual.
- Hubungan dengan supplier tidak terkelola dalam satu sistem.
- Tracking order dan status pengiriman belum transparan.
- Pengambilan keputusan restock masih reaktif, bukan berbasis data.

Tujuan Core MVP:
- Memberikan visibilitas operasional harian untuk distributor dan supplier.
- Menjadi sistem kerja utama untuk inventory, supplier partnership, dan order tracking.
- Membantu distributor mengambil keputusan restock lebih cepat lewat AI recommendation.
- Menampilkan trust layer seperti partnership dan escrow secara sederhana tanpa membebani user dengan flow blockchain.

Target pengguna:
- `distributor`: bisnis yang membeli barang dari supplier untuk dijual kembali atau dipakai dalam operasional.
- `supplier`: pihak yang menyediakan barang, menerima partnership request, dan memproses order dari distributor.

Nilai utama produk:
- Satu tempat untuk inventory, supplier, order, dan insight operasional.
- Pengalaman kerja yang role-aware tetapi tetap memakai alur sistem yang konsisten.
- Trust dan automation hadir sebagai enabler, bukan sebagai kompleksitas tambahan bagi user.

## 2. Role dan Prinsip Sistem

### Role

**Distributor**
- Mengelola inventaris internal.
- Mencari dan menilai supplier.
- Mengirim partnership request.
- Membuat order ke supplier partner.
- Meminta AI restock recommendation untuk item yang menipis.

**Supplier**
- Mengelola stok produk yang dijual.
- Memantau distributor partner.
- Meninjau dan merespons partnership request.
- Memproses incoming order dan mengubah status fulfillment.

### Alur kerja inti

1. User register atau login dengan role `distributor` atau `supplier`.
2. Sistem mengarahkan user ke dashboard sesuai role.
3. Distributor memantau inventory dan low stock.
4. Distributor meninjau supplier lalu membangun partnership.
5. Distributor membuat order manual atau dari AI recommendation.
6. Supplier menerima order, memproses, lalu memperbarui status.
7. Sistem menampilkan hasil trust layer seperti partnership success, escrow progress, dan supplier reputation sebagai outcome dari backend.

### Status penting

**Inventory status**
- `in_stock`
- `low_stock`
- `out_of_stock`

**Order status**
- `pending`
- `processing`
- `shipping`
- `delivered`
- `cancelled`

### Prinsip produk MVP

- Backend adalah source of truth untuk status, summary, dan data operasional.
- Experience harus role-aware: metrik, CTA, dan empty state menyesuaikan role.
- AI pada MVP bersifat assistive: memberi rekomendasi dan mempercepat order, bukan auto-order penuh.
- Blockchain dan escrow diperlakukan sebagai backend-driven trust layer yang surfaced di UI secara sederhana.

## 3. Fitur MVP

### 3.1 Authentication dan Role-Based Access

**Tujuan**  
Memastikan user bisa masuk ke sistem dengan aman, dikenali role-nya, dan diarahkan ke workspace yang relevan.

**Role terkait**  
`distributor`, `supplier`

**User stories**
- Sebagai `distributor`, saya ingin register dan login dengan role saya, sehingga saya langsung masuk ke workspace distributor.
- Sebagai `supplier`, saya ingin login dengan aman, sehingga saya bisa mengelola partnership dan incoming order tanpa melihat fitur yang bukan milik saya.

**Acceptance criteria**
- Given user mengirim form register valid dengan role yang dipilih, when API `POST /auth/register` berhasil, then sistem menyimpan hasil autentikasi dan mengarahkan user ke dashboard sesuai role.
- Given user login dengan email, password, dan `recaptcha_token` valid, when API `POST /auth/login` berhasil, then session aktif dan data role digunakan untuk routing awal.
- Given `recaptcha_token` tidak dikirim atau gagal divalidasi, when backend mengembalikan `CAPTCHA_MISSING` atau `CAPTCHA_FAILED`, then login diblokir dan user melihat pesan error yang ramah.
- Given access token kedaluwarsa tetapi refresh token masih valid, when aplikasi memanggil `POST /auth/refresh`, then session diperbarui tanpa memaksa user login ulang.
- Given user belum login dan membuka halaman terproteksi, when session tidak tersedia, then user diarahkan ke halaman login.

**Dependensi/API**
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`

### 3.2 Dashboard Monitoring

**Tujuan**  
Memberikan ringkasan operasional yang cepat dibaca dan relevan terhadap role user.

**Role terkait**  
`distributor`, `supplier`

**User stories**
- Sebagai `distributor`, saya ingin melihat stok total, item low stock, order aktif, supplier partner, dan AI insight, sehingga saya tahu prioritas operasional hari ini.
- Sebagai `supplier`, saya ingin melihat incoming order, partner aktif, produk aktif, dan indikator demand operasional, sehingga saya bisa memprioritaskan fulfillment dan stok.

**Acceptance criteria**
- Given user yang sudah login membuka dashboard, when API `GET /dashboard/summary` berhasil, then sistem menampilkan summary cards dan insight yang relevan untuk role user.
- Given user ber-role `distributor`, when dashboard dimuat, then minimal ditampilkan ringkasan inventory, orders, suppliers, dan AI insight sesuai data backend.
- Given user ber-role `supplier`, when dashboard dimuat, then dashboard hanya menampilkan KPI supplier dan tidak menampilkan CTA distributor seperti create order atau low-stock restock action.
- Given data summary kosong, when dashboard dimuat, then sistem menampilkan empty state yang mengarahkan user ke aksi pertama yang relevan, seperti tambah inventory atau cek partnership.
- Given ada AI insight dengan urgency tinggi, when insight ditampilkan, then insight tersebut diprioritaskan secara visual dan memiliki CTA lanjutan bila relevan.

**Dependensi/API**
- `GET /dashboard/summary`

### 3.3 Inventory Management

**Tujuan**  
Menjadikan inventory sebagai sistem kerja utama untuk memantau stok, minimum stock, dan kesiapan restock.

**Role terkait**  
`distributor`, `supplier`

**User stories**
- Sebagai `distributor`, saya ingin melihat dan memperbarui stok item, sehingga saya tahu kapan harus restock.
- Sebagai `supplier`, saya ingin memperbarui stok produk yang saya jual, sehingga distributor mendapatkan visibilitas ketersediaan yang lebih akurat.

**Acceptance criteria**
- Given user membuka halaman inventory, when API `GET /inventory` berhasil, then sistem menampilkan daftar item, summary, pagination, dan filter yang tersedia.
- Given user menambahkan item dengan field valid, when API `POST /inventory` berhasil, then item baru muncul di daftar dengan status dari backend.
- Given user mengubah stok, minimum stock, atau kategori item, when API `PUT /inventory/{item_id}` berhasil, then tampilan daftar dan detail item ikut diperbarui.
- Given user menghapus item, when API `DELETE /inventory/{item_id}` berhasil, then item hilang dari daftar tanpa menghapus item lain.
- Given backend mengembalikan status `in_stock`, `low_stock`, atau `out_of_stock`, when item dirender, then status badge selalu mengikuti nilai backend.
- Given daftar inventory kosong, when halaman dimuat, then user melihat empty state yang mengarahkan ke aksi tambah item pertama.
- Given request gagal karena validasi atau resource tidak ditemukan, when backend mengembalikan error, then user mendapatkan feedback yang jelas tanpa kehilangan konteks halaman.

**Dependensi/API**
- `GET /inventory`
- `POST /inventory`
- `PUT /inventory/{item_id}`
- `DELETE /inventory/{item_id}`

### 3.4 Suppliers dan Partnership

**Tujuan**  
Membantu distributor menemukan supplier yang terpercaya dan membantu supplier mengelola hubungan kemitraan secara formal.

**Role terkait**  
`distributor`, `supplier`

**User stories**
- Sebagai `distributor`, saya ingin melihat supplier partner dan discover supplier, sehingga saya bisa memilih supplier yang tepat untuk diajak kerja sama.
- Sebagai `supplier`, saya ingin menerima atau menolak partnership request, sehingga saya bisa mengelola hubungan bisnis yang masuk.

**Acceptance criteria**
- Given distributor membuka modul supplier, when API `GET /suppliers` berhasil, then daftar supplier bisa dibedakan antara `partner` dan `discover`.
- Given distributor melihat kartu atau baris supplier, when data tersedia, then minimal ditampilkan nama, kategori, reputation score, total transactions, on-time delivery rate, dan active state.
- Given distributor mengirim partnership request, when API `POST /suppliers/partnership-request` berhasil, then status request berubah menjadi `pending` dan user mendapat konfirmasi sukses.
- Given supplier meninjau request masuk dan memilih `accept`, when API `PUT /suppliers/partnership-request/{request_id}` berhasil, then status partnership menjadi `accepted`.
- Given partnership diterima dan `partnership_nft` tersedia, when response diterima, then UI menampilkan partnership berhasil disimpan beserta status trust layer yang relevan.
- Given partnership diterima tetapi `partnership_nft` bernilai `null`, when response diterima, then UI tetap menandai partnership accepted dan menampilkan bahwa proses trust layer masih diproses atau perlu retry dari backend.
- Given supplier memilih `reject`, when request berhasil diproses, then request tidak lagi tampil sebagai pending action utama.
- Given tidak ada supplier atau tidak ada partnership request, when halaman dimuat, then sistem menampilkan empty state yang tetap menjelaskan langkah berikutnya.

**Dependensi/API**
- `GET /suppliers`
- `POST /suppliers/partnership-request`
- `PUT /suppliers/partnership-request/{request_id}`

### 3.5 Orders dan Tracking

**Tujuan**  
Menyediakan alur pemesanan yang terstruktur dari distributor ke supplier serta pelacakan status yang transparan untuk kedua pihak.

**Role terkait**  
`distributor`, `supplier`

**User stories**
- Sebagai `distributor`, saya ingin membuat order ke supplier partner dan memantau progresnya, sehingga proses restock tidak lagi dilakukan via chat manual.
- Sebagai `supplier`, saya ingin memperbarui status order yang masuk, sehingga distributor selalu tahu progres fulfillment.

**Acceptance criteria**
- Given distributor memilih supplier dan item order yang valid, when API `POST /orders` berhasil, then order baru tercatat dengan status awal `pending`.
- Given user membuka halaman orders, when API `GET /orders` berhasil, then daftar order bisa difilter berdasarkan status dan konteks role (`buyer` atau `seller`) sesuai kebutuhan halaman.
- Given supplier memproses order, when status diubah melalui `PUT /orders/{order_id}/status`, then perubahan status langsung tercermin di kedua sisi sistem.
- Given order berada di status `pending`, `processing`, `shipping`, `delivered`, atau `cancelled`, when order dirender, then user melihat status yang konsisten dan mudah dipahami.
- Given order berubah menjadi `delivered`, when status tersimpan, then UI menampilkan bahwa penyelesaian escrow dan update reputation dikelola otomatis oleh backend.
- Given order berada pada status terminal `delivered` atau `cancelled`, when halaman detail atau list dibuka, then action yang tidak lagi valid tidak ditampilkan sebagai CTA utama.
- Given belum ada order, when halaman dimuat, then sistem menampilkan empty state yang mengarahkan distributor membuat order pertama atau supplier menunggu incoming order.

**Dependensi/API**
- `GET /orders`
- `POST /orders`
- `PUT /orders/{order_id}/status`

### 3.6 AI Restock Recommendation

**Tujuan**  
Membantu distributor mengambil keputusan restock lebih cepat berdasarkan kondisi stok aktual dan saran supplier yang relevan.

**Role terkait**  
`distributor`

**User stories**
- Sebagai `distributor`, saya ingin meminta AI recommendation untuk item yang low stock, sehingga saya bisa tahu kapan restock dan dari supplier mana saya sebaiknya membeli.

**Acceptance criteria**
- Given distributor membuka item inventory yang menipis, when API `POST /ai/restock-recommendation` berhasil, then sistem menampilkan recommendation text, suggested quantity, suggested supplier, urgency, dan waktu generate.
- Given AI recommendation tersedia, when user meninjau hasilnya, then user dapat melanjutkan ke flow create order dengan data supplier dan quantity yang sudah diprefill.
- Given urgency bernilai `high`, `medium`, atau `low`, when hasil AI ditampilkan, then urgency divisualisasikan secara konsisten agar user bisa memprioritaskan tindakan.
- Given request recommendation gagal, when backend mengembalikan error, then user menerima feedback yang jelas dan tetap bisa kembali ke alur manual.
- Given MVP ini masih fase core workflow, when fitur AI digunakan, then sistem hanya mendukung recommendation-to-order dan tidak mengeksekusi auto-order penuh tanpa interaksi user.

**Dependensi/API**
- `POST /ai/restock-recommendation`
- `POST /orders`

## 4. Future Phase / Out of Scope

Fitur berikut tidak masuk ke Core MVP dan diposisikan sebagai roadmap:
- Credit management dan AI credit scoring untuk retailer.
- Demand forecast sebagai workflow mandiri.
- Geo mapping demand.
- Retailer management.
- Payment detail, logistics detail, dan analytics operasional lanjutan.
- Analytics dashboard mendalam per role.
- Auto-order penuh tanpa konfirmasi user.
- Wallet-native flow atau halaman blockchain khusus untuk end user.

## 5. Catatan Implementasi

- `frontend/autosup.md` menjadi sumber visi produk, pain points, dan arah pengalaman user. Catatan: autosup.md mencakup visi produk lengkap termasuk future phase. Untuk Core MVP, scope fitur mengacu ke Section 3 dokumen ini.
- `api-contract.md` menjadi source of truth untuk endpoint, role naming, response envelope, dan status enum.
- Semua fitur selain authentication dianggap protected route.
- Error handling di frontend harus menggunakan pesan yang ramah dan menjaga konteks user di halaman aktif.
- UI perlu menampilkan trust layer seperti partnership status, escrow progress, dan supplier reputation sebagai informasi hasil sistem, bukan sebagai flow teknis blockchain.
- Inventory item tidak menyimpan harga. Harga per unit (`price_per_unit`) diinput oleh distributor saat membuat order berdasarkan kesepakatan dengan supplier.
