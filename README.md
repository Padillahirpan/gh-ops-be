# Selada Ops API

Backend API untuk **Selada Ops** — aplikasi operasional greenhouse selada hidroponik (sistem NFT/talang). API ini mencakup manajemen tandon (bak tanam), pencatatan panen, penjualan, dan analitik dashboard.

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
│   │   └── analyticsRoutes.ts
│   ├── services/             # Logika bisnis
│   │   ├── tandonService.ts
│   │   ├── harvestService.ts
│   │   ├── saleService.ts
│   │   └── analyticsService.ts
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

### 2. Jalankan server development

```bash
npm run dev
```

Server berjalan di `http://localhost:3001`. Migrasi database **berjalan otomatis** saat server start, jadi tidak ada langkah migrasi manual yang wajib.

### 3. (Opsional) Isi data demo

```bash
npm run db:seed
```

Seed bersifat idempoten — dilewati jika data sudah ada. Gunakan `npm run db:reseed` untuk reset total dan isi ulang data demo.

### 4. (Alternatif) Build & jalankan untuk produksi

```bash
npm run build
npm start
```

## Environment Variables

Tidak ada file `.env` yang wajib — semua variabel punya nilai default. Buat file `.env` jika ingin mengubah konfigurasi:

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `3001` | Port server API |
| `DB_PATH` | `data/selada-ops.db` | Path file SQLite (folder dibuat otomatis) |
| `CORS_ORIGIN` | `http://localhost:5173` | Origin yang diizinkan CORS. Pisahkan dengan koma untuk multiple origin, misal: `http://localhost:5173,https://selada.example.com` |

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

3 tabel dengan relasi dan constraint:

```
tandons (3 fixed: T1, T2, T3)
   │
   │ 1:N  (ON DELETE restrict)
   ▼
harvests
   │
   │ 1:N  (ON DELETE cascade)
   ▼
sales
```

- `tandons` — id, name, greenhouse, batchCode, holes (default 1000), sowingDate, status, color
- `harvests` — data panen + rejection breakdown, FK ke `tandons`
- `sales` — data penjualan, FK ke `harvests`
- Tanggal disimpan sebagai teks ISO (`YYYY-MM-DD`) agar identik dengan tipe frontend tanpa konversi zona waktu
- Index pada kolom `tandon_id`, `harvest_id`, dan `date` untuk performa query

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
