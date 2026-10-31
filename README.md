# Selada Ops API

Backend API untuk **Selada Ops** — aplikasi operasional greenhouse selada hidroponik (sistem NFT/talang). API ini mencakup manajemen tandon (bak tanam), pencatatan panen, penjualan, analitik dashboard, serta modul biaya & modal (costing per batch panen).

Dibangun dengan **Hono + Drizzle ORM + SQLite**, seluruh tipe, konstanta, dan kalkulasi di-port 1:1 dari aplikasi frontend [`selada-ops`](../selada-ops) sehingga kontrak API identik dengan frontend.

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Tech Stack](#tech-stack)
- [Struktur Proyek](#struktur-proyek)
- [Prasyarat](#prasyarat)
- [Cara Menjalankan](#cara-menjalankan)
- [Environment Variables](#environment-variables)
- [Perintah npm](#perintah-npm)
- [Dokumentasi API](#dokumentasi-api)
- [Endpoint API](#endpoint-api)
- [Domain Bisnis](#domain-bisnis)
- [Format Error](#format-error)
- [Skema Database](#skema-database)
- [Arsitektur](#arsitektur)

## Fitur Utama

### Manajemen Tandon
- 3 tandon tetap: **T1**, **T2**, **T3** (auto-dibuat saat tabel kosong)
- Update tanggal semai (`sowingDate`) dan status (`Empty` | `Growing` | `Sanitizing`)
- Side effect otomatis: mengisi tanggal semai → status `Growing`; mengosongkan → `Empty` (kecuali sedang `Sanitizing`)

### Kalkulator Siklus Tanam (47 hari)
- Berbasis **HSS** (Hari Setelah Semai) dengan 5 fase: Semai → Tumbuh → Penggemukan → Panen → Sanitasi
- 10 event terjadwal otomatis (pindah talang, semprot, pra-panen, panen, sanitasi)
- Kontrol jendela semprot kimia: **dilarang mulai HSS 32** (menjaga periode pra-panen bebas kimia)
- Progres siklus (%), event berikutnya, dan sisa hari

### Pencatatan Panen (Harvest)
- Berat rata-rata per tanaman (`avgWeightG`) dan success rate dihitung **server-side**
- Rincian afkir (rejection breakdown): tip burn, busuk akar, hama, ukuran kecil, lainnya
- Side effect: mencatat panen otomatis mengubah status tandon menjadi `Sanitizing`
- Manajemen stok: sisa kg per batch panen yang belum habis terjual

### Penjualan (Sales)
- Multi-kanal buyer: supermarket, restoran, wholesaler, retail
- Status pembayaran: `paid` / `dp` / `tempo`
- Validasi: volume terjual tidak boleh melebihi sisa stok batch panen
- Penanganan sisa panen: cold storage / clearance / spoilage

### Analitik Dashboard
- KPI: total panen (kg), berat rata-rata (dengan badge terhadap target 200g), total revenue, success rate, stok siap jual
- Dibandingkan dengan window periode sebelumnya (untuk indikator naik/turun)
- Tren berat panen, panen vs terjual per tandon, revenue per tandon, distribusi buyer

### Modul Biaya & Modal
- Pencatatan pengeluaran satu per satu: tanggal, tipe (Operasional / Modal & Aset), 9 kategori, deskripsi, nominal, target (T1/T2/T3 atau Umum), supplier opsional, catatan
- **Batch panen (siklus)** dibuat otomatis saat tanggal semai tandon diisi; biaya dikelompokkan otomatis ke siklus berdasarkan tandon + tanggal (HSS 0 s.d. sanitasi selesai), dan dapat dipindahkan manual ke batch lain
- Biaya **Umum** (mis. listrik, tenaga kerja bersama) otomatis dibagi rata ke 3 tandon
- Pembelian **Modal & Aset** dapat dibebankan penuh ke siklus saat ini atau disebar ke N siklus berikutnya (pilihan per item)
- Harga satuan & jumlah opsional (nominal dihitung otomatis) agar kenaikan harga terlihat dari waktu ke waktu
- Perhitungan otomatis per batch + total: biaya/kg, biaya/lubang, laba kotor, margin, dan harga impas — termasuk penanda batch yang harga jual rata-ratanya di bawah harga impas

## Tech Stack

| Komponen | Teknologi |
|---|---|
| Bahasa | TypeScript (strict, ESM, ES2022) |
| Runtime | Node.js ≥ 20 |
| Framework web | Hono + @hono/node-server |
| OpenAPI | @hono/zod-openapi + @scalar/hono-api-reference |
| Database | SQLite (better-sqlite3, mode WAL) |
| ORM | Drizzle ORM + drizzle-kit |
| Validasi | Zod (pesan error berbahasa Indonesia) |

## Struktur Proyek

```
selada-ops-api/
├── src/
│   ├── index.ts              # Entry point: Hono app, CORS, logger, auto-migrate, serve
│   ├── db/
│   │   ├── client.ts         # Koneksi better-sqlite3 + Drizzle (WAL, FK ON)
│   │   ├── schema.ts         # Skema Drizzle: tandons, harvests, sales
│   │   ├── migrate.ts        # Runner migrasi Drizzle
│   │   └── seed.ts           # Seed data demo (idempoten)
│   ├── domain/
│   │   ├── constants.ts      # Konfigurasi tandon, siklus 47 hari, fase, threshold badge
│   │   └── types.ts          # Tipe domain (port 1:1 dari frontend selada-ops)
│   ├── lib/
│   │   ├── calculations.ts   # Kalkulasi berat rata-rata, success rate, total value, dll.
│   │   ├── cycleCalculator.ts# Kalkulator HSS, fase siklus, jadwal event, progres
│   │   └── dateUtils.ts      # Util tanggal ISO (YYYY-MM-DD)
│   ├── middleware/
│   │   └── errors.ts         # AppError hierarchy + error handler terpusat
│   ├── routes/               # Definisi rute OpenAPI + handler
│   │   ├── index.ts          # Mount semua rute di /api + /health + OpenAPI
│   │   ├── tandonRoutes.ts
│   │   ├── harvestRoutes.ts
│   │   ├── saleRoutes.ts
│   │   ├── analyticsRoutes.ts
│   │   ├── costRoutes.ts
│   │   ├── cycleRoutes.ts
│   │   └── costingRoutes.ts
│   ├── services/             # Logika bisnis
│   │   ├── tandonService.ts
│   │   ├── harvestService.ts
│   │   ├── saleService.ts
│   │   ├── analyticsService.ts
│   │   ├── cycleService.ts   # Batch panen (siklus) + pengelompokan otomatis
│   │   ├── costService.ts    # CRUD biaya
│   │   └── costingService.ts # Rekap biaya per batch + total
│   └── validation/
│       └── schemas.ts        # Skema Zod untuk create/update/query
├── drizzle/                  # File migrasi SQL (hasil drizzle-kit generate)
├── data/                     # File SQLite (di-gitignore)
├── dist/                     # Output build tsc (di-gitignore)
├── drizzle.config.ts
├── tsconfig.json
└── package.json
```

## Prasyarat

- **Node.js versi 20 atau lebih baru** — cek dengan `node -v`

## Cara Menjalankan

### 1. Install dependencies

```bash
npm install
```

### 2. Buat Admin pertama (wajib untuk bisa login)

```bash
npm run admin:create
```

Skrip idempoten — set di `.env`: `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` (default dev: `admin@selada.local` / `selada-admin-123`, **wajib diganti di produksi**). User lain dibuat Admin lewat aplikasi (Settings → Manajemen User); tidak ada pendaftaran mandiri.

### 3. Jalankan server development

```bash
npm run dev
```

Server berjalan di `http://localhost:3001`. Migrasi database **berjalan otomatis** saat server start, jadi tidak ada langkah migrasi manual yang wajib.

### 4. (Opsional) Isi data demo

```bash
npm run db:seed
```

Seed bersifat idempoten — dilewati jika data sudah ada. Gunakan `npm run db:reseed` untuk reset total dan isi ulang data demo.

### 5. (Alternatif) Build & jalankan untuk produksi

```bash
npm run build
npm start
```

## Autentikasi & Role

Menggunakan **Better Auth** (session cookie HttpOnly, self-hosted di SQLite yang sama):

- Endpoint auth: `/api/auth/*` (sign-in email/password, sign-out, get-session, admin user management)
- **Semua endpoint bisnis butuh login** → tanpa session cookie: `401 UNAUTHORIZED` (kecuali `/api/health`, `/api/doc`, `/api/scalar`)
- **Role** (plugin admin):
  - `admin` — akses penuh (GET + tulis: POST/PATCH/PUT/DELETE)
  - `user` — **lihat-saja**: semua metode tulis ditolak `403 FORBIDDEN`
- Password di-hash scrypt; session token di-hash SHA-256 di DB (revoke = hapus baris); rate limit 20 request/menit/IP (storage database); session 7 hari + rolling refresh + cookie cache 5 menit
- FE memanggil via proxy same-origin (Vite `/api` → 3001) sehingga cookie berlaku tanpa konfigurasi HTTPS khusus

## Environment Variables

Tidak ada file `.env` yang wajib — semua variabel punya nilai default. Buat file `.env` jika ingin mengubah konfigurasi:

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `3001` | Port server API |
| `DB_PATH` | `data/selada-ops.db` | Path file SQLite (folder dibuat otomatis) |
| `CORS_ORIGIN` | `http://localhost:5173` | Origin yang diizinkan CORS + trustedOrigins auth. Pisahkan dengan koma untuk multiple origin |
| `BETTER_AUTH_SECRET` | *(fallback dev + warning)* | **Wajib di produksi** — secret acak (mis. `openssl rand -base64 32`) untuk signing session |
| `BETTER_AUTH_URL` | `http://localhost:3001` | Base URL layanan auth |
| `ADMIN_EMAIL` | `admin@selada.local` | Dipakai `npm run admin:create` |
| `ADMIN_NAME` | `Admin` | Dipakai `npm run admin:create` |
| `ADMIN_PASSWORD` | `selada-admin-123` | Dipakai `npm run admin:create` — **wajib diganti** |

## Perintah npm

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server development dengan hot reload (tsx watch) |
| `npm run build` | Compile TypeScript ke `dist/` |
| `npm start` | Jalankan hasil build (`node dist/index.js`) |
| `npm run typecheck` | Cek tipe tanpa emit |
| `npm run db:generate` | Generate file migrasi baru dari perubahan skema (drizzle-kit) |
| `npm run db:migrate` | Jalankan migrasi secara manual |
| `npm run db:seed` | Isi data demo (dilewati jika data sudah ada) |
| `npm run db:reseed` | Reset total + isi ulang data demo |
| `npm run admin:create` | Buat/perbarui Admin pertama (idempoten) |

## Dokumentasi API

Dokumentasi interaktif tersedia saat server berjalan:

- **UI Scalar**: [http://localhost:3001/api/scalar](http://localhost:3001/api/scalar)
- **OpenAPI JSON (3.1)**: [http://localhost:3001/api/doc](http://localhost:3001/api/doc)
- **Health check**: [http://localhost:3001/api/health](http://localhost:3001/api/health)

## Endpoint API

### System

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/health` | Status layanan, uptime, timestamp |

### Auth (Better Auth)

| Method | Endpoint | Deskripsi |
|---|---|---|
| `POST` | `/api/auth/sign-in/email` | Login email + password → set cookie session HttpOnly |
| `POST` | `/api/auth/sign-out` | Hapus session (revoke) |
| `GET` | `/api/auth/get-session` | Session aktif + data user (null bila belum login) |
| `POST` | `/api/auth/admin/create-user` | *(admin)* Buat user baru (name, email, password, role) |
| `GET` | `/api/auth/admin/list-users` | *(admin)* Daftar user |
| `POST` | `/api/auth/admin/set-role` | *(admin)* Ubah role user |
| `POST` | `/api/auth/admin/remove-user` | *(admin)* Hapus user |

### Tandons

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/tandons` | Daftar semua tandon |
| `GET` | `/api/tandons/{id}` | Detail satu tandon |
| `PATCH` | `/api/tandons/{id}` | Update `sowingDate` dan/atau `status` (minimal satu field) |
| `POST` | `/api/tandons/{id}/reset` | Reset siklus tandon (kembali ke `Empty`) |
| `GET` | `/api/tandons/{id}/cycle` | Jadwal & progres siklus tanam (HSS, fase, event) |

### Harvests

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/harvests` | Daftar panen. Filter: `tandonId`, `from`, `to` (tanggal ISO) |
| `POST` | `/api/harvests` | Catat panen baru. `avgWeightG` & `successRate` dihitung server-side |
| `GET` | `/api/harvests/stock` | Stok batch panen yang belum habis terjual (`remainingKg` per batch) |
| `GET` | `/api/harvests/{id}` | Detail satu panen |
| `PATCH` | `/api/harvests/{id}` | Update data panen |
| `DELETE` | `/api/harvests/{id}` | Hapus panen (penjualan terkait ikut terhapus via cascade) |

### Sales

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/sales` | Daftar penjualan. Filter: `tandonId`, `from`, `to`, `buyerCategory`, `paymentStatus` |
| `POST` | `/api/sales` | Catat penjualan baru. `tandonId` diturunkan dari batch panen |
| `GET` | `/api/sales/{id}` | Detail satu penjualan |
| `PATCH` | `/api/sales/{id}` | Update data penjualan |
| `DELETE` | `/api/sales/{id}` | Hapus penjualan |

### Analytics

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/analytics/dashboard` | Dashboard agregat. Query: `range` (`30`/`90`/`all`), `tandonId` (`all`/`T1`/`T2`/`T3`) |

### Costs (Biaya)

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/costs` | Riwayat biaya. Filter: `target` (`T1`/`T2`/`T3`/`UMUM`), `type`, `category`, `from`, `to`. Respon menyertakan `assignedCycleId` (hasil pengelompokan) |
| `POST` | `/api/costs` | Catat biaya. `amount` wajib — atau isi `quantity` + `unitPrice` agar nominal dihitung server-side |
| `GET` | `/api/costs/{id}` | Detail satu biaya |
| `PATCH` | `/api/costs/{id}` | Ubah biaya; isi `cycleId` untuk memindahkan batch secara manual, `null` untuk kembali otomatis |
| `DELETE` | `/api/costs/{id}` | Hapus biaya |

### Cycles (Batch Panen)

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/cycles` | Daftar batch panen (siklus) per tandon. Filter: `tandonId` |
| `GET` | `/api/cycles/{id}` | Detail satu batch panen |

### Costing (Rekap Biaya)

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/costing/overview` | Ringkasan per batch + total. Query: `tandonId` (`all`/`T1`/`T2`/`T3`). Termasuk `unassignedItems` (biaya di luar jendela siklus) |
| `GET` | `/api/costing/batches/{cycleId}` | Rincian satu batch: item biaya (porsi Umum/penyebaran modal ditandai), total per kategori, metrik |

## Domain Bisnis

### Siklus Tanam 47 Hari

| Fase | HSS | Keterangan |
|---|---|---|
| Semai | 0–13 | Benih disemai di bak |
| Tumbuh | 14–26 | Pindah ke talang NFT, periode pertumbuhan |
| Penggemukan | 27–44 | Penambahan berat optimal |
| Panen | 45 | Hari panen |
| Sanitasi | 46–47 | Pembersihan & persiapan siklus berikutnya |

**Jendela semprot kimia**: diperbolehkan hingga HSS 31, **dilarang mulai HSS 32** (`sprayAllowed: false`) untuk memastikan periode pra-panen bebas residu kimia.

### Modul Biaya & Modal

**Kategori biaya** (`category`): `benihRockwool`, `nutrisi`, `pestisida`, `listrikAir`, `tenagaKerja`, `kemasanTransportasi`, `peralatanMesin`, `perbaikan`, `lainLain`.

**Pengelompokan ke batch panen** (F-CST-03): setiap tandon punya daftar siklus (record `cycles`) dengan jendela `[sowingDate, sowingDate+47]` (HSS 0 s.d. sanitasi selesai). Biaya target tandon otomatis masuk siklus yang memuat tanggalnya; isi `cycleId` untuk memindahkan manual. Panen lama yang tidak tercakup record mana pun disintesis menjadi batch *implisit* (diasumsikan panen HSS 45). Biaya yang tanggalnya jatuh di luar semua jendela ditandai *unassigned* dan tetap tercatat di riwayat.

**Biaya Umum** (F-CST-04): biaya target `UMUM` dibagi rata ke 3 tandon (sisa rupiah diberikan ke porsi terdepan). Tiap porsi dicari-anchorkan ke siklus masing-masing tandon pada tanggal biaya.

**Modal & Aset** (F-CST-05): biaya `type: modal` dengan `spreadCycles: N` membebankan `amount / N` ke N siklus berurutan tandon yang sama mulai dari siklus anchor. Porsi untuk siklus yang belum dibuat akan otomatis muncul begitu siklus berikutnya tercatat. `spreadCycles: 1` (default) = dibebankan penuh ke siklus saat ini.

**Rumus per batch dan total** (F-CST-06, dihitung server-side):

| Metrik | Rumus |
|---|---|
| Total Biaya Batch | Σ biaya operasional + porsi biaya modal yang dibebankan |
| Biaya per kg (Rp/kg) | Total Biaya / Total Panen kg |
| Biaya per lubang (Rp) | Total Biaya / jumlah lubang tandon (1000) |
| Laba Kotor (Rp) | Total Revenue − Total Biaya |
| Margin (%) | Laba Kotor / Total Revenue × 100 |
| Harga Impas (Rp/kg) | Total Biaya / Total Panen kg |

- *Total Revenue* = Σ `totalValue` penjualan batch berstatus `paid`/`dp` (konsisten dengan analitik)
- *Harga jual rata-rata* = Σ nilai jual seluruh status / Σ kg terjual (bobot aktual pasar)
- **Peringatan impas** (F-CST-09): `belowBreakEven: true` bila harga jual rata-rata batch < harga impas; `avgSellingPricePerKg` bernilai `null` bila batch belum punya penjualan

### Threshold Berat Panen (Badge)

| Berat rata-rata | Badge | Keterangan |
|---|---|---|
| ≥ 200g | Success | Mencapai/surpass target |
| 170–199g | Warning | Di bawah target |
| < 170g | Danger | Jauh di bawah target |

Target berat rata-rata: **200 gram per tanaman**.

### Aturan Bisnis Penting

- Tanggal semai tidak boleh di masa depan
- `rejected` (jumlah afkir) tidak boleh melebihi `totalPlants`
- Total rincian alasan afkir tidak boleh melebihi `rejected`
- Volume penjualan tidak boleh melebihi sisa stok batch panen terkait
- Revenue hanya dihitung dari penjualan berstatus `paid` dan `dp`
- `totalValue` penjualan dihitung server-side (`soldVolumeKg × pricePerKg`, dibulatkan)
- Biaya: `quantity` dan `unitPrice` harus diisi bersamaan; `amount` dihitung server-side dari keduanya dan tidak boleh selisih > Rp 1 bila dikirim manual
- `spreadCycles` > 1 hanya untuk biaya `modal`; biaya `operasional` selalu dibebankan penuh ke satu siklus
- Biaya target `UMUM` tidak dapat dipatok manual (`cycleId` harus kosong) karena dibagi rata ke 3 tandon
- `cycleId` manual harus merujuk batch milik tandon yang sama dengan target biaya

## Format Error

Semua error dikembalikan dalam format terpusat:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Deskripsi error",
    "details": {}
  }
}
```

| Kode | HTTP | Keterangan |
|---|---|---|
| `NOT_FOUND` | 404 | Resource tidak ditemukan |
| `VALIDATION_ERROR` | 422 | Input tidak valid (Zod) |
| `BUSINESS_RULE` | 422 | Pelanggaran aturan bisnis |
| `INTERNAL_ERROR` | 500 | Kesalahan internal server |

## Skema Database

5 tabel dengan relasi dan constraint:

```
tandons (3 fixed: T1, T2, T3)
   │
   │ 1:N  (ON DELETE restrict)
   ├──────────────► harvests ──1:N (cascade)──► sales
   │
   └──────────────► cycles (batch panen/siklus)
                        │
                        │ 1:N  (ON DELETE set null)
                        ▼
                      costs
```

- `tandons` — id, name, greenhouse, batchCode, holes (default 1000), sowingDate, status, color
- `harvests` — data panen + rejection breakdown, FK ke `tandons`
- `sales` — data penjualan, FK ke `harvests`
- `cycles` — batch panen per tandon: tandonId, sowingDate, cycleEndDate (semai+47), batchCode; unik per (tandon, tanggal semai); dibuat otomatis saat tanggal semai diisi
- `costs` — tanggal, tipe, kategori, deskripsi, nominal, target (`T1`/`T2`/`T3`/`UMUM`), supplier, catatan, quantity, unitPrice, spreadCycles, cycleId (penempatan manual, FK `cycles`)
- Tabel auth (Better Auth): `user` (termasuk `role` admin/user, `banned`), `session`, `account` (kredensial), `verification`, `rateLimit` — kolom tanggal epoch ms integer (berbeda dari tabel bisnis)
- Tanggal tabel bisnis disimpan sebagai teks ISO (`YYYY-MM-DD`) agar identik dengan tipe frontend tanpa konversi zona waktu
- Index pada kolom `tandon_id`, `harvest_id`, `date`, `target`, `category`, dan `cycle_id` untuk performa query

## Arsitektur

Arsitektur berlapis dengan pemisahan tanggung jawab yang jelas:

```
Request
  → routes/      Definisi rute OpenAPI + handler (validasi via Zod)
  → services/    Logika bisnis (aturan domain, kalkulasi)
  → db/          Akses data via Drizzle ORM
  → Response
```

- **`domain/`** — konstanta bisnis (siklus 47 hari, threshold) dan tipe yang di-port 1:1 dari frontend, menjadi *single source of truth* kontrak API
- **`lib/`** — fungsi kalkulasi murni (tanpa side effect), mudah diuji
- **`validation/`** — skema Zod terpusat untuk request create/update/query
- **`middleware/`** — error handling terpusat dengan `AppError` hierarchy
- Semua pesan validasi dan error API menggunakan **bahasa Indonesia** untuk konsistensi dengan frontend
