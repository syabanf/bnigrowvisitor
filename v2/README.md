# BNI Visitor — rebuild (Vite + Go + PostgreSQL)

Penulisan ulang aplikasi Next.js di root repo ini, memakai **Vite + React** di
depan, **Go clean architecture** di belakang, dan **PostgreSQL** langsung
(bukan Supabase).

> **Status: fondasi + satu irisan vertikal.** Auth dan modul Visitor sudah utuh
> dari database sampai UI. Modul lain (Member, Guest, MCQA, WA Blast,
> Export/Import, dashboard nasional, PWA, quick tour) belum diport — lihat
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

## Yang sudah terverifikasi

Diuji terhadap stack yang benar-benar berjalan:

- `/api/visitors` tanpa sesi → 401
- Chapter admin melihat 4 visitor chapternya, bukan 5 baris seluruh tabel
- Chapter admin membaca **dan** menghapus visitor chapter lain lewat ID → 403
- National admin melihat semua chapter dan boleh membaca baris tersebut
- Create / update / delete, pencarian, dan penolakan status tak dikenal (400)
- `chapter_id` yang dipalsukan saat create diabaikan
- Sesi menembus proxy nginx (cookie tetap first-party)
- `go build ./...`, `go vet ./...`, dan `tsc --noEmit` bersih

## Peta jalan

Belum diport dari aplikasi Next.js:

- [ ] Member, Guest, MCQA, Weekly Meeting, Kelola PIC
- [ ] WA Blast dan template pesan
- [ ] Export / Import Excel
- [ ] Dashboard chapter dan dashboard nasional (health score, alert, funnel)
- [ ] Multi-tenant per subdomain
- [ ] PWA, quick tour bernarasi, asisten AI
- [ ] Uji otomatis untuk `usecase` dan `domain` — keduanya sengaja bebas
      I/O, jadi bisa diuji tanpa database
