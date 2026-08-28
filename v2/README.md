# BNI Visitor — rebuild (Vite + Go + PostgreSQL)

Penulisan ulang aplikasi Next.js di root repo ini, memakai **Vite + React** di
depan, **Go clean architecture** di belakang, dan **PostgreSQL** langsung
(bukan Supabase).

> **Status: paritas fitur tercapai.** Semua modul aplikasi Next.js sudah diport
> dan berjalan dari database sampai UI. Yang tersisa bukan fitur — lihat
> [Peta jalan](#peta-jalan).

## Menjalankan

```bash
docker compose up -d --build
```

| Layanan | Alamat |
|---|---|
| Web (nginx + SPA) | http://localhost:8095 |
| API (Go) | http://localhost:8090 |
| PostgreSQL | localhost:5440 |

Akun demo — semua password `demo123`:

| Email | Peran | Scope |
|---|---|---|
| `national@demo.test` | National Admin | Semua chapter |
| `grow@demo.test` | Chapter Admin | BNI Grow |
| `rise@demo.test` | Chapter Admin | BNI Rise |
| `pic@demo.test` | PIC | BNI Grow |

Skema dan seed dijalankan otomatis oleh Postgres saat volume masih kosong.
Untuk mengulang dari nol: `docker compose down -v && docker compose up -d`.

### Pengembangan tanpa Docker

```bash
cd backend  && DATABASE_URL=... SESSION_SECRET=... go run ./cmd/api
cd frontend && npm install && npm run dev
```

Vite mem-proxy `/api` ke `localhost:8080`, jadi cookie sesi tetap same-site
persis seperti di produksi di balik satu hostname.

## Arsitektur

Ketergantungan **selalu menunjuk ke dalam**. `domain` tidak mengimpor apa pun
dari proyek ini; `usecase` hanya tahu `domain`; Postgres dan HTTP ada di
lapisan terluar dan bisa ditukar tanpa menyentuh aturan bisnis.

```
backend/
  cmd/api/                     wiring — satu-satunya tempat yang tahu semua paket
  internal/
    domain/                    entitas, error, aturan scope, kontrak repository
    usecase/                   aturan bisnis; tanpa HTTP, tanpa SQL
    repository/postgres/       implementasi kontrak — satu-satunya paket ber-SQL
    delivery/http/             handler, middleware, router — satu-satunya yang tahu status code
    platform/                  config, bcrypt, sesi HMAC, pool database
  migrations/                  001 skema, 002 seed
```

### Keputusan yang perlu diketahui

**Scope chapter dihitung satu kali, di domain.** `ResolveScope` menerima peran
dan chapter dari sesi, lalu memutuskan apakah `chapterId` dari klien boleh
berarti apa-apa. Akun terikat chapter selalu dipatok ke chapternya sendiri —
`chapter_id` palsu di query string atau body tidak bisa melebarkan akses.
Terverifikasi: chapter admin BNI Grow yang mengirim `chapter_id` milik BNI Rise
saat membuat visitor tetap menghasilkan baris di chapternya sendiri.

**Otorisasi dilakukan setelah baca, bukan dilipat ke dalam query.** `Get`
memuat baris lalu memeriksa `scope.Allows`. Ini membuat permintaan lintas
chapter menjadi 403 yang jelas, dan jawabannya tidak bergantung pada
repository yang "ingat" memfilter. `Update` dan `Delete` lewat `Get` yang sama,
jadi tidak ada jalur tulis yang bisa menyentuh baris yang tak boleh dibaca.

**Login tidak membedakan "user tidak ada" dari "password salah".** Keduanya
mengembalikan error yang sama; alasannya hanya masuk ke `login_audit`. Kalau
dibedakan, form login berubah jadi alat enumerasi akun.

**Error domain, bukan status code, yang mengalir ke atas.** `WriteError` adalah
satu-satunya tempat pemetaan ke HTTP, sehingga dua handler tidak bisa
menjawab beda untuk kondisi yang sama. Error tak terduga dicatat lengkap tapi
dilaporkan generik — pesan driver bisa membocorkan nama tabel dan potongan query.

**Semua nilai lewat placeholder.** Di `visitor.go` hanya operator dan nama kolom
yang pernah dirangkai; tidak ada input pemanggil yang masuk ke teks SQL.

## Modul

| Modul | API | UI |
|---|---|---|
| Auth (login, sesi, ganti password sendiri) | ✅ | ✅ |
| Visitor | ✅ CRUD, filter, cari | ✅ |
| MCQA (hasil airtime) | ✅ | ✅ |
| Member (termasuk penanda renewal) | ✅ CRUD, filter, cari | ✅ |
| Guest | ✅ CRUD, cari | ✅ |
| Weekly Meeting | ✅ CRUD | ✅ |
| WA Blast + template `{link_hadir}` | ✅ | ✅ |
| Export / Import CSV | ✅ | ✅ |
| Dashboard chapter | ✅ | ✅ |
| Dashboard nasional | ✅ | ✅ |
| Kelola akun / PIC | ✅ | ✅ |
| Log aktivitas | ✅ | ✅ |
| Multi-tenant per host | ✅ | ✅ |
| Konfirmasi kehadiran publik `/wm/{token}` | ✅ | ✅ |
| PWA (manifest, service worker, offline) | — | ✅ |
| Pipeline (papan kanban) | ✅ | ✅ |
| Profil akun & ubah password sendiri | ✅ | ✅ |
| Text Format (editor template WA) | ✅ | ✅ |
| Master Wilayah | ✅ | ✅ |
| Template & Policy nasional | ✅ | ✅ |
| Governance & Audit | ✅ | ✅ |
| API Keys | ✅ | ✅ |

### Migrasi

Dijalankan oleh API sendiri saat start, dari file yang **di-embed ke dalam
binary**. Sebelumnya memakai `docker-entrypoint-initdb.d` Postgres, yang hanya
berjalan pada data directory kosong — artinya setiap migrasi setelah boot
pertama tidak akan pernah diterapkan ke database yang sudah berisi data, dan
gagalnya diam-diam.

Tiap migrasi berjalan dalam transaksinya sendiri, dicatat di `schema_migrations`
beserta checksum-nya. Mengubah migrasi yang sudah diterapkan akan **menolak
start** — kalau sumber dan database sudah tidak sepakat, mendiamkannya adalah
cara environment saling melenceng.

### Catatan desain per modul

**MCQA** hanya menampilkan visitor yang sudah hadir, dan database menolak hasil
airtime untuk status lain lewat `CHECK` constraint. Mencatatnya untuk yang
belum hadir akan diam-diam merusak laporan konversi.

**WA Blast** menyiapkan pesan dan tautan `wa.me`, lalu **manusia** yang menekan
kirim. Tidak ada pengiriman otomatis: gateway WhatsApp tidak resmi adalah cara
tercepat nomor chapter diblokir. Nomor yang tidak valid dilaporkan per nama,
bukan didiamkan — penerima yang hilang diam-diam baru ketahuan seminggu kemudian.

**Placeholder yang tidak dikenal sengaja dibiarkan terlihat** di hasil render.
`{salah_ketik}` yang muncul di pratinjau memberi tahu penulisnya; string kosong
menyembunyikannya sampai pesan sudah telanjur terkirim.

**Import** melaporkan setiap baris gagal beserta alasannya. "37 dari 40 masuk"
tanpa menyebut tiga yang mana tidak berguna bagi orang yang harus memperbaikinya.

**Export** menulis BOM UTF-8. Tanpa itu Excel membaca file sebagai codepage
sistem dan merusak setiap nama beraksen.

**Log aktivitas** ditulis dari setiap operasi tulis (visitor, member, guest,
MCQA, konfirmasi publik). Kegagalan mencatat tidak pernah menggagalkan operasi
yang sudah berhasil — kehilangan satu baris audit itu buruk, membatalkan visitor
yang sudah tersimpan karena insert audit gagal jauh lebih buruk. Entri `delete`
menyimpan namanya, karena barisnya sudah hilang dan log adalah satu-satunya
tempat ia bertahan.

**API key** hanya disimpan hash-nya. Kunci aslinya tampil sekali saat dibuat dan
tidak bisa dipulihkan — itulah yang membuat kebocoran database bisa ditanggung.

**Layar national-only** (Master Wilayah, Policy, Audit, API Keys) ditolak di
use case, bukan sekadar disembunyikan dari nav. Terverifikasi: chapter admin
mendapat 403 di keempatnya.

**Konfirmasi publik** tidak pernah memundurkan status. Membuka ulang tautan WA
lama tidak bisa membatalkan catatan kehadiran, dan responsnya hanya memuat nama
serta meeting — bukan telepon, email, atau catatan.

## Yang sudah terverifikasi

Diuji terhadap stack yang benar-benar berjalan, bukan mock:

**Isolasi antar-chapter**
- `/api/visitors` tanpa sesi → 401
- Chapter admin melihat hanya chapternya di keempat modul (visitor 4/5,
  member 4/6, guest 2/3, meeting 2/3)
- Membaca **dan** menghapus baris chapter lain lewat ID → 403
- `chapter_id` yang dipalsukan saat create diabaikan — barisnya tetap masuk ke
  chapter pemanggil
- Chapter admin membuka dashboard nasional → 403

**Eskalasi hak akses**
- Chapter admin membuat PIC → 201; membuat national_admin, admin, atau sesama
  chapter_admin → 403
- PIC membuat akun apa pun → 403
- Chapter admin mereset password atau menonaktifkan akun chapter lain → 403,
  dan akun targetnya tetap bisa login dengan password lamanya
- Password national admin tak bisa disentuh chapter admin (akun tanpa chapter)

**Fungsional**
- CRUD penuh visitor, member, guest; pencarian; status tak dikenal → 400
- Dashboard: hitungan cocok dengan daftar, dan chapter tanpa visitor tetap
  muncul di tabel nasional (bukan hilang)
- Sesi menembus proxy nginx (cookie tetap first-party)

**Statis**
- `go build ./...`, `go vet ./...`, `go test ./...`, `tsc --noEmit`, `vite build`

### Keamanan

Yang aktif, dan bagaimana masing-masing diuji:

| Kontrol | Bukti |
|---|---|
| Sesi dicek ulang ke database tiap request | Akun dinonaktifkan → sesi yang sedang berjalan langsung 401, bukan menunggu cookie kedaluwarsa |
| Peran & chapter dibaca ulang dari database, bukan dari token | Demosi atau pindah chapter langsung berlaku |
| Rate limit login 10/menit per IP | Percobaan ke-8 dan seterusnya → 429 |
| Penolakan Origin asing pada semua method yang mengubah data | `Origin: https://penyerang.example` → 403; origin sah → 200 |
| Secret sesi menolak nilai contoh & terlalu pendek | Compose gagal start tanpa `SESSION_SECRET`; nilai placeholder ditolak API |
| Security header di API dan nginx | CSP, X-Frame-Options, nosniff, Referrer-Policy, `Cache-Control: no-store` |
| Kebijakan password (min 10 rune, tolak yang umum) | Dihitung per rune, bukan byte |
| Isolasi chapter & penjaga eskalasi peran | Lihat daftar di atas |

Verifikasi sesi ke database itu satu pembacaan primary key ber-index per request.
Menambahkan cache akan menukar kebenaran (izin basi) dengan penghematan yang
skala aplikasi ini tidak butuh.

### Uji otomatis

Setiap lapisan kini punya tes:

| Lapisan | Cakupan |
|---|---|
| `domain` | scope, peran, status, template, host, tarif konversi |
| `usecase` | eskalasi peran, paginasi, normalisasi nomor, parsing CSV |
| `platform/password` | salting, hash cacat, kebijakan panjang per rune |
| `platform/session` | payload diutak-atik, tag rusak, kunci asing, kedaluwarsa |
| `delivery/http/handler` | pemetaan error → status, penolakan field asing |
| `delivery/http/middleware` | security header, penjaga Origin CSRF |
| `repository/postgres` | **integrasi** terhadap Postgres sungguhan |
| `frontend` | klien API, halaman login (Vitest + Testing Library) |

Tes repository berjalan terhadap database asli — yang layak diuji di sana adalah
SQL-nya sendiri (penyaringan scope, indeks unik, join). Driver tiruan hanya akan
membuktikan bahwa string yang saya tulis adalah string yang saya tulis.

```bash
# Unit saja (tanpa Docker)
cd backend && go test ./...

# Termasuk integrasi
TEST_DATABASE_URL='postgres://bni:bni_dev_password@localhost:5440/bni_visitor?sslmode=disable' \
  go test ./...

cd frontend && npm test
```



`go test ./...` mencakup properti yang paling mahal kalau salah:

- `ResolveScope` — setiap kombinasi peran × chapter yang diminta, termasuk
  usaha melebarkan akses lewat `chapterId` palsu
- `Scope.Allows` — termasuk scope kosong non-nasional yang harus menolak semua
- `validateGrant` — setiap anak tangga eskalasi peran
- Sesi HMAC — payload yang diutak-atik, tag rusak, kunci asing, token
  kedaluwarsa, dan token cacat bentuk
- Hashing password — salt berbeda tiap hash, hash cacat tidak pernah lolos,
  dan kebijakan panjang yang menghitung rune (bukan byte)
- Pembagian nol pada perhitungan konversi/kehadiran, dan member tanpa tanggal
  renewal yang tidak boleh dianggap jatuh tempo

## Performa

Yang diukur, dan apa yang berubah:

| | Sebelum | Sesudah |
|---|---|---|
| Bundle JS terkirim | 226 KB mentah | **62 KB** (gzip, hemat 67%) |
| Respons API `/visitors?limit=200` | 19 KB mentah | **2,5 KB** (gzip, hemat 87%) |
| Chunk JS | 1 (semua route) | **22** (per halaman) |
| Foreign key tanpa indeks | 9 | **0** |
| Query pencarian pada 17 ribu baris | Seq Scan 8,4 ms, membuang 17.621 baris | **Bitmap Index Scan 1,2 ms** |

Angka pencarian itu diukur di level SQL lewat `EXPLAIN ANALYZE`, bukan di level
endpoint — pada data kecil selisihnya tenggelam di bawah overhead HTTP, dan
perbandingan endpoint yang saya coba tidak terkendali. Yang membuat perubahan
ini layak adalah bentuk rencana query-nya: seq scan tumbuh linear terhadap
jumlah baris, index scan tidak.

`ILIKE '%kata%'` tidak bisa memakai indeks B-tree karena wildcard-nya di depan,
jadi pencarian memakai indeks trigram GIN (`pg_trgm`). GIN, bukan GiST: lebih
lambat menulis, jauh lebih cepat mencari, dan kolom ini jauh lebih sering dibaca
daripada ditulis.

### Batas ukuran body

Dibatasi 1 MB di nginx **dan** di middleware Go, kecuali route import CSV yang
diberi 6 MB. Sebelumnya nginx memakai default 1 MB-nya sendiri, yang diam-diam
membatalkan klaim 5 MB pada import — dan mengembalikan halaman HTML nginx alih-
alih pesan JSON aplikasi. Terverifikasi: file 1,4 MB kini masuk (17.571 baris),
sementara body JSON 2 MB ke endpoint lain tetap ditolak 413.

## CI

`.github/workflows/` menjalankan keduanya. Job backend menyalakan Postgres
sungguhan, menerapkan migrasi lewat API-nya sendiri, lalu menjalankan seluruh
tes termasuk yang integrasi, dengan `-race`.

Job v1 sengaja tidak diberi kredensial: aplikasinya jatuh ke demo mode, jadi
build yang membutuhkan Supabase hidup untuk bisa dikompilasi adalah regresi.

## Peta jalan

Fitur sudah setara dengan aplikasi Next.js. Yang belum:

- [ ] **Asisten AI** — butuh kunci penyedia; sengaja tidak dibuat agar tidak ada
      kunci yang ikut ter-commit lagi
- [ ] **Quick tour bernarasi** — v1 memakai ElevenLabs; jalur yang sama akan
      mengulang masalah kunci publik, jadi ditunda sampai kuncinya dikelola
      lewat secret manager
- [ ] **OCR** input visitor dari foto — butuh mesin OCR (Tesseract atau layanan
      awan); keputusan dependensinya belum diambil
- [ ] **Import Excel (.xlsx)** — yang ada baru CSV
- [ ] **HTTPS/TLS, backup terjadwal, observability** — semuanya keputusan
      deployment, belum ada di compose
