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
| Lockout akun setelah 8 kegagalan | Password benar pun ditolak selama terkunci, dengan pesan identik |
| Retensi audit otomatis | activity_logs 180 hari, login_audit 90 hari |
| Scanning dependensi di CI | `govulncheck` + `npm audit` |
| TLS siap pakai | Profil compose terpisah, lihat di bawah |

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

## API eksternal

Untuk integrasi mesin, mis. sistem keuangan yang membaca status renewal member.

```
GET  /external/v1/members
GET  /external/v1/members/{id}
POST /external/v1/members/{id}/renewal
```

Autentikasi memakai API key, bukan cookie: `Authorization: Bearer <key>` atau
`X-API-Key: <key>`. Key diterbitkan dari layar API Keys.

Dipasang di luar `/api` supaya tidak kena middleware yang berorientasi browser —
pemanggil server-ke-server tidak mengirim `Origin`, dan CSRF butuh kredensial
ambient yang route ini memang tidak punya.

Responsnya sengaja lebih sempit daripada API internal: integrasi butuh status
keanggotaan dan tanggal renewal, bukan nomor telepon, catatan, atau siapa yang
mengajak. `is_overdue` diturunkan dari tanggalnya, bukan disimpan, jadi tidak
bisa berbeda dari sumbernya.

Key dicari lewat hash SHA-256 — plaintext-nya tidak pernah disimpan, jadi tidak
ada yang bisa dibandingkan selain digest. Key tidak ada, dinonaktifkan, dan
kedaluwarsa semuanya menghasilkan pesan yang sama; membedakannya akan memberi
tahu penyerang mana tebakan yang mendekati.

## Lockout akun

Delapan kegagalan mengunci akun selama 15 menit. Rate limit per IP sudah meredam
serangan dari satu sumber, tapi penyerang dengan banyak alamat melewatinya
begitu saja — menghitung kegagalan per akun itulah yang membuat tebakan
terdistribusi jadi mahal.

Penghitungnya ada di baris user, bukan di memori, jadi bertahan melewati
restart: penyerang yang bisa memaksa restart tidak boleh mendapat papan bersih.
Terverifikasi: password **yang benar** pun ditolak selama terkunci, dengan pesan
persis sama seperti password salah — mengatakan "terkunci" akan mengonfirmasi
bahwa akunnya ada dan memberi tahu penyerang bahwa tebakannya berhasil.

## TLS

Konfigurasi TLS ada di `frontend/nginx-tls.conf`, dijalankan lewat profil
terpisah:

```bash
docker compose --profile tls up -d web-tls
```

Bukan default karena butuh sertifikat, dan compose yang gagal start tanpa
sertifikat itu pengalaman pertama yang lebih buruk daripada HTTP polos di
localhost. Cara membuat sertifikat ada di `frontend/tls/README.md`.

Blok `/.well-known/acme-challenge/` sengaja tetap dilayani lewat HTTP polos:
kalau ikut dialihkan ke HTTPS, perpanjangan Let's Encrypt gagal dan situs mati
saat sertifikat lama kedaluwarsa. HSTS hanya aktif di konfigurasi TLS — browser
yang pernah melihatnya menolak HTTP polos selama setahun, jadi mengirimkannya
dengan sertifikat yang belum benar akan mengunci pengguna di luar.

## Uji hardening & stress

```bash
./scripts/hardening-test.sh          # 63 pemeriksaan keamanan
./scripts/stress-test.sh 40000 40 10 # 40k baris, 40 pembaca konkuren, 10 detik
```

Keduanya menegaskan hasil, bukan mencetak respons, supaya regresi menggagalkan
run alih-alih lewat begitu saja di layar. Stress test menandai barisnya sendiri
dan menghapusnya di akhir.

Empat masalah nyata ditemukan hardening test pada run pertama: nginx membuang
seluruh security header di location yang punya `add_header` sendiri (`add_header`
tidak diwariskan — satu saja di level location membatalkan semua dari level
server, dan yang terkena persis halaman SPA dan seluruh aset); write tanpa
`Origin` maupun `Referer` diloloskan; uuid tidak valid dan nilai enum tidak
dikenal keduanya menghasilkan 500; serta dotfile di web root dijawab 200 oleh
fallback SPA.

Angka konkuren pada stress test **bukan** throughput server. Generatornya
mem-fork satu curl per request dari bash dan mentok di sekitar 180 rps apa pun
endpoint-nya. Yang bisa dipercaya adalah perbandingan relatifnya — endpoint yang
menonjol dari yang lain itu regresi nyata — dan pengukuran di level SQL.

### Rencana kueri: kenapa indeks saja tidak cukup

Pencarian visitor sempat berjalan 25 ms sementara list biasa 3 ms, padahal
`EXPLAIN` atas kueri yang sama menunjukkan 1,7 ms.

Penyebabnya: pgx meng-cache prepared statement, dan Postgres beralih ke
**generic plan** setelah lima eksekusi. Generic plan disusun tanpa nilai
parameter, jadi untuk `col ILIKE $1` selektivitasnya hanya ditebak; digabung
dengan `ORDER BY created_at DESC LIMIT 50`, planner memilih indeks pengurutan
lalu menyaring sambil berjalan — **membuang 40.030 baris untuk menemukan 1**.

Inilah sebabnya menambah indeks trigram yang hilang memperbaiki kueri secara
terisolasi tapi tidak mengubah apa pun di endpoint: mulai request keenam,
indeksnya tidak pernah disentuh.

| | rencana | waktu |
|---|---|---|
| Custom plan | BitmapOr atas empat indeks trigram | **1,7 ms** |
| Generic plan | Index Scan + filter, 40.030 baris dibuang | **28,1 ms** |

`QueryExecModeExec` dipakai hanya saat ada kata kunci pencarian, sehingga
statement dikirim tanpa nama dan Postgres selalu merencanakan ulang terhadap
pola yang sebenarnya. Setelah itu pencarian dan list sama cepat.

## Export & import

Export menulis kolom yang sama untuk kedua format, jadi hasil unduhan bisa
langsung diimpor kembali. CSV membawa BOM UTF-8 supaya Excel di locale Indonesia
tidak membaca file sebagai codepage sistem dan merusak huruf beraksen.

Format saat impor dikenali dari **isi** file — empat byte pertama sebuah `.xlsx`
adalah magic zip — bukan dari ekstensinya. Orang mengekspor dari Excel, dari
Google Sheets, dan mengganti nama file; ekstensi yang salah tidak seharusnya
menggagalkan impor ketika isinya sudah menyatakan dirinya sendiri.

Kedua format melewati satu jalur validasi yang sama (`rowSource`). Menyalinnya
jadi dua akan membuat aturannya melenceng pada perubahan pertama.

Baris kosong dilewati diam-diam. Spreadsheet mengumpulkan baris kosong di bawah
dari sel mana pun yang pernah disentuh; menghitungnya sebagai kegagalan akan
melaporkan puluhan error untuk file yang sebenarnya masuk sempurna.

## Asisten

Menjawab pertanyaan tentang data chapter yang sedang dilihat. Konteksnya disusun
di server dari scope yang sudah diselesaikan, tidak pernah dari apa pun yang
dikirim browser — asisten milik pengguna chapter tidak boleh bisa menceritakan
chapter lain, dan caranya adalah angka chapter lain tidak pernah masuk ke prompt.
Terverifikasi lewat tes: pengguna chapter yang secara eksplisit meminta
perbandingan mendapat penolakan, bukan data tetangganya.

**Tanpa kunci pun tetap jalan.** v1 mengembalikan 500 ketika `DEEPSEEK_API_KEY`
kosong, yang membuat asistennya tidak berguna di deployment mana pun tanpa
kunci. Di sini, tanpa penyedia ia menjawab dari angka dashboard — follow up,
konversi, kehadiran, member, sebaran status, ringkasan — dan mengatakan apa
adanya bahwa tidak ada model di belakangnya. Penyedia yang mati atau salah
konfigurasi juga jatuh ke sana, dengan peringatan di UI dan alasan aslinya di
log server, bukan di browser.

Endpoint-nya OpenAI chat-completions, jadi penyedia adalah `AI_BASE_URL` +
`AI_MODEL`, bukan keputusan kode. v1 memanggil DeepSeek langsung dan tidak bisa
diarahkan ke mana pun.

Yang dikirim ke penyedia sengaja sempit: agregat, dan daftar kerja pendek berisi
nama serta status. Nomor telepon, email, dan catatan tidak ikut — data pribadi
yang tidak dibutuhkan untuk menjawab pertanyaannya.

Isi data ditandai sebagai data, bukan perintah, di dalam prompt. Nama dan catatan
ditulis oleh pengguna aplikasi, jadi seseorang bisa saja menamai visitor dengan
kalimat yang menyuruh model. Batas sebenarnya bukan kalimat itu: asisten ini
tidak punya tool sama sekali, jadi kasus terburuknya adalah jawaban yang salah,
bukan tindakan yang salah.

## Observability

```
GET /health    liveness   — proses hidup, TIDAK menyentuh database
GET /ready     readiness  — ping database, 503 kalau tidak siap
GET /metrics   Prometheus — hanya dari dalam network
```

`/health` sengaja tidak menyentuh database. Restart tidak memperbaiki database
yang tidak terjangkau, dan liveness probe yang gagal karenanya mengubah gangguan
sesaat jadi restart loop yang memperburuk keadaan. Yang perlu tahu database
tidak siap adalah readiness — supaya instance-nya dikeluarkan dari rotasi, bukan
dibunuh. Sebelumnya hanya ada `/health` yang selalu menjawab "ok".

`/metrics` tidak di-proxy nginx, jadi hanya terjangkau dari dalam network: nama
rute dan bentuk trafik berguna bagi siapa pun yang sedang mengukur sebuah
layanan.

Labelnya memakai **pola rute**, bukan path mentah. `/api/visitors/{id}` adalah
satu time series; memakai path-nya akan mencetak satu series baru per visitor
dan pada akhirnya menjatuhkan penyimpanan metriknya sendiri.

Selain metrik HTTP, pool koneksi dilaporkan saat scrape — termasuk
`db_pool_acquire_wait_seconds_total`, angka yang paling layak di-alert: menunggu
koneksi adalah antrean yang tidak muncul di timing kueri mana pun.

## Backup

```bash
docker compose --profile backup up -d backup   # default: harian, simpan 14 hari
```

Di balik profil karena loop dump adalah kebisingan saat development, dan karena
di mana backup disimpan itu keputusan deployment.

Memakai image postgres yang sama dengan server, supaya versi `pg_dump` cocok —
klien yang lebih tua bisa menghasilkan dump yang gagal di-restore, dan insiden
adalah waktu terburuk untuk mengetahuinya.

Dump ditulis dengan nama sementara lalu di-*rename* setelah berhasil. Dump yang
terpotong di tengah akan terlihat persis seperti yang utuh, dan justru jadi yang
terbaru saat restore.

Pruning tidak pernah menghapus sampai habis. Kalau job-nya berhenti sebulan dan
semua backup melewati jendela retensi, menghapus semuanya berarti tidak ada
titik pulih sama sekali — lebih buruk daripada menyimpan yang basi.

### Restore, dan satu jebakannya

```bash
docker compose stop api
docker compose run --rm backup /ops/restore.sh
docker compose start api
```

**Hentikan API dulu.** Dump-nya men-drop dan membuat ulang semua tabel,
sementara koneksi pool API memegang prepared statement ke tabel yang lama.
Restore di bawah API yang hidup meninggalkan keadaan di mana login masih
berhasil tapi request berikutnya 401 — terbaca sebagai bug perizinan, bukan
sebagai restore yang menyebabkannya. Ini teramati, bukan teori.

Restore terpisah dari loop backup dengan sengaja: restore itu destruktif, dan
job backup yang juga bisa me-restore hanya berjarak satu environment variable
dari menimpa database yang seharusnya ia lindungi.

Terverifikasi utuh: 61 visitor, ditambah satu penanda jadi 62, restore dari dump
yang diambil saat 61, hasilnya kembali 61 dengan penanda hilang.

## Akun demo & masuk cepat

```bash
DEMO_MODE=true   # sudah on di compose ini; kosongkan untuk deployment sungguhan
```

`GET /api/demo-accounts` menerbitkan akun yang di-seed beserta passwordnya, dan
layar login merendernya sebagai tombol masuk cepat. Mati secara default, dan
saat mati endpoint-nya menjawab **404, bukan 403** — 403 akan mengonfirmasi
bahwa daftar akun yang bisa dipakai hanya berjarak satu flag.

Daftarnya dibaca dari database, bukan di-hardcode di UI. Versi sebelumnya
ditulis tangan dan bisa menawarkan akun yang tidak ada lagi; yang ini berasal
dari tempat yang sama dengan akunnya. Dicocokkan lewat domain `@demo.test`, jadi
kalaupun demo mode tak sengaja menyala di produksi, yang keluar bukan daftar
karyawan.

Satu akun per peran-dan-chapter. Seed punya tiga PIC di BNI Grow supaya daftar
visitor punya lebih dari satu pemilik, tapi menampilkan ketiganya di layar login
hanya memperlihatkan tampilan yang sama tiga kali dan mengubur peran yang
benar-benar berbeda.

## Data seed

Datanya dirapikan supaya layak dipamerkan. Sebelumnya:

- Nama membawa nomor urut — "Dewi Lestari 26" — karena kumpulan 30 nama tidak
  cukup untuk 56 baris tanpa bertabrakan.
- `business_field` dan `company` diambil dari offset berbeda pada daftar yang
  sama, jadi setiap pasangan janggal: asuransi jiwa di perusahaan logistik,
  katering di percetakan.
- Email dibangun dari nama bernomor itu, jadi tidak cocok dengan apa pun.

Sekarang 30 nama depan x 12 nama keluarga memberi 360 kombinasi berbeda,
diurutkan lewat hash dari kedua indeksnya supaya nama depan dan belakang
tercampur — tanpa itu tiga puluh orang pertama semuanya bermarga Santoso.
Deterministik: database baru menghasilkan nama yang sama, yang penting karena
quick tour dan tangkapan layar merujuk ke mereka.

Ditulis sebagai UPDATE, bukan seed ulang: barisnya direferensikan meeting, log
aktivitas, dan entri audit, dan menggantinya akan membuat semua itu menggantung.

## CI

`.github/workflows/` menjalankan keduanya. Job backend menyalakan Postgres
sungguhan, menerapkan migrasi lewat API-nya sendiri, lalu menjalankan seluruh
tes termasuk yang integrasi, dengan `-race`.

Job v1 sengaja tidak diberi kredensial: aplikasinya jatuh ke demo mode, jadi
build yang membutuhkan Supabase hidup untuk bisa dikompilasi adalah regresi.

## Peta jalan

Fitur sudah setara dengan aplikasi Next.js. Yang belum:

- [x] **Asisten AI** — endpoint OpenAI-compatible lewat environment; tanpa kunci
      ia menjawab dari angka, bukan menolak
- [x] **Quick tour bernarasi** — ElevenLabs di sisi server, dengan fallback
      Web Speech; kuncinya lewat environment, tidak ikut ter-commit
- [ ] **OCR** input visitor dari foto — butuh mesin OCR (Tesseract atau layanan
      awan); keputusan dependensinya belum diambil
- [x] **Import/export Excel (.xlsx)** — format dikenali dari isi file, bukan
      ekstensinya
- [x] **Backup terjadwal & observability** — keduanya di balik profil compose
