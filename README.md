# BNI Visitor Manager

Sistem manajemen visitor untuk BNI — multi-tenant SaaS, satu subdomain per
chapter. Repo ini berisi **dua aplikasi lengkap** yang mengerjakan hal yang
sama dengan cara berbeda.

| | Stack | Lokasi | Status |
|---|---|---|---|
| **v1** | Next.js 16 · React · Supabase (PostgREST) | [`src/`](src) | Jalan di production |
| **v2** | React + Vite · **Go** (clean architecture) · PostgreSQL | [`v2/`](v2) | Rebuild, fitur sudah setara |

**Production (v1):** `https://grow.bni-vh.com` (Chapter Grow) ·
`https://rise.bni-vh.com` (Chapter Rise) · `https://bni-vh.com` (National)

## v2 — rebuild dengan backend sendiri

v1 berbicara langsung ke Supabase dari browser. v2 menaruh API Go di antaranya,
sehingga otorisasi, audit, dan scope chapter ditegakkan di server, bukan
dipercayakan ke klien.

```bash
cd v2
cp .env.example .env      # isi SESSION_SECRET
docker compose up -d      # http://localhost:8095
```

Semua akun demo memakai password `demo123`, dan layar login menyediakan tombol
masuk cepat per peran.

Yang ada di dalamnya:

- **Backend Go** — `domain` → `usecase` → `repository`/`delivery`, tanpa
  framework ORM; migrasi tertanam di binary dan diperiksa checksum-nya
- **Keamanan** — sesi divalidasi ulang ke database tiap request, isolasi
  chapter, lockout akun, penjaga CSRF, API key untuk integrasi mesin.
  [63 pemeriksaan hardening](v2/scripts/hardening-test.sh) yang menegaskan
  hasilnya, bukan sekadar mencetak respons
- **Performa** — [stress test](v2/scripts/stress-test.sh) yang menemukan jebakan
  generic plan Postgres: pencarian 28 ms jadi 1,7 ms
- **Operasional** — metrik Prometheus, readiness probe terpisah dari liveness,
  backup terjadwal yang sudah dibuktikan bisa di-restore

Detail lengkap, termasuk kenapa tiap keputusan diambil, ada di
**[`v2/README.md`](v2/README.md)**.

---

# v1 — catatan progress & handoff

Bagian di bawah ini adalah dokumen serah terima aplikasi Next.js yang jalan di
production. Disimpan apa adanya sebagai catatan sejarah.

## Status Terakhir (14 Juni 2026)

Semua fitur di bawah sudah **deployed ke production** (branch `main` → Vercel).

---

## Fitur yang Sudah Selesai

### 1. Branding Login
- Logo diganti ke `bni-logo.png` (file ada di `public/`)
- Stats halaman login: **1659+ Active Members · 25+ Chapters · 6+ Cities**

### 2. Multi-Tenant Per Subdomain
- Apex `bni-vh.com` = National admin
- Subdomain `grow.bni-vh.com`, `rise.bni-vh.com`, dll = Chapter masing-masing
- Chapter branding (nama, warna, inisial) otomatis detect dari subdomain
- File: `src/lib/chapterBranding.ts`, `src/hooks/useChapterBranding.ts`

### 3. Role Hierarchy
```
national_admin / admin
  └── chapter_admin  (= "super admin" per chapter)
        └── pic       (Visitor Host)
              └── member
```

### 4. BNI Assistant (AI)
- National scope (`bni-vh.com`): nama **"BNI Assistant"**, akses data semua chapter
- Chapter scope: nama `{Chapter} Assistant`, data terbatas chapter sendiri
- File: `src/components/assistant/GrowAssistant.tsx`, `src/app/api/grow-assistant/route.ts`

### 5. Manajemen Akun PIC (oleh Chapter Admin)
- Chapter admin bisa **buat, edit, set password, aktif/nonaktif** akun PIC
- PIC hanya bisa **reset password diri sendiri** (menu "Ubah Password Saya" di sidebar)
- Isolasi: chapter admin tidak bisa akses PIC chapter lain
- API: `src/app/api/pic-accounts/route.ts`
- UI: `src/components/pages/ManagePicAccounts.tsx`
- Page: `src/app/(dashboard)/chapter/[chapterId]/pic-accounts/page.tsx`

### 6. Edit Member oleh Chapter Admin
- Chapter admin bisa edit semua field member termasuk email & password
- File: `src/components/pages/Members.tsx` (flag `isSuperAdmin`)

### 7. Konfirmasi Kehadiran via Link WA
- Setiap visitor punya link unik: `https://grow.bni-vh.com/wm/{visitorId}`
- Klik link → status visitor otomatis berubah ke `confirmed`
- Page public tanpa auth: `src/app/wm/[token]/page.tsx`
- Status yang bisa dikonfirmasi: `new`, `followup`
- Status sudah selesai (tidak diubah lagi): `confirmed`, `attended`, `interview`, `member`, `not_continue`

### 8. Template WA dengan `{link_hadir}`
- Variabel `{link_hadir}` ditambahkan ke template WA
- `buildWaLink` di Visitors.tsx otomatis inject URL konfirmasi ke variabel ini
- Template lama di localStorage yang belum punya `{link_hadir}` otomatis diinjeksi saat `normalizeTemplate` dipanggil
- File: `src/lib/waTemplate.ts`, `src/components/pages/Visitors.tsx`

### 9. Master Wilayah — Domain List
- Domain `vercel` dan `localhost` difilter dari tampilan dropdown
- File: `src/components/pages/MasterData.tsx`

---

## Arsitektur Teknis

### Auth
- Custom auth, bukan Supabase Auth
- Tabel `users` di Supabase
- Session: signed HMAC cookie `bni_session`
- File: `src/lib/auth.ts`, `src/lib/server/session.ts`

### Data Access
- Supabase service role (`getSupabaseAdmin()`) di server — bypass RLS
- RLS tetap aktif sebagai defense-in-depth
- Client-side: fetch ke `/api/data/*` yang wrap service role

### Database
- Migrations: `supabase/migrations/`
- Tabel utama: `users`, `visitors`, `members`, `meetings`, `chapters`, `domains`

### PWA

Aplikasi terpasang sebagai PWA (installable, jalan layar penuh tanpa chrome
browser).

- `src/app/manifest.ts` — manifest, disajikan di `/manifest.webmanifest`
- `public/sw.js` — service worker. **`/api/*` tidak pernah di-cache**: datanya
  live dan ter-scope per tenant, jadi meng-cache-nya berisiko membocorkan data
  antar chapter/akun. Navigasi pakai network-first dengan fallback
  `public/offline.html`; hanya build output ber-hash dan ikon yang cache-first.
- `src/components/pwa/ServiceWorkerRegistrar.tsx` — registrasi + prompt install
- Ikon: `public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`,
  `apple-touch-icon.png`

**Navigasi bawah (mobile).** `MobileTabBar` kini tampil di semua layar mobile
kecuali halaman fullscreen (Pipeline Board, yang punya header & tombol back
sendiri). Sebelumnya dia dikecualikan di route chapter dan area national,
sehingga chapter admin dan national admin hanya kebagian hamburger drawer di
HP — padahal tab chapter sudah dirancang me-resolve ke `/chapter/<id>/…`. Ada
dua set tab:

- `variant="chapter"` — Dashboard · Visitor · Guest · Pipeline · MCQA · WA Blast
- `variant="national"` — Dashboard · Chapter · Wilayah · Audit · Policy · API

Layout memilih variant-nya dari `isNationalArea`. Label versi national sengaja
dipendekkan ("Audit", bukan "Governance & Audit") supaya enam tab tetap muat di
viewport 375px.

Layout mobile menghormati safe area (notch & home indicator) lewat
`viewport-fit=cover` plus utility `.pb-safe-tabbar` / `.px-safe` di
`globals.css`. `MobileTabBar` mempublikasikan tingginya sebagai CSS variable
`--tabbar-height`, dipakai overlay (bubble assistant, prompt install, padding
konten) supaya tidak saling tumpuk pada route yang tidak merender tab bar.

### Quick Tour

Tur berpandu keliling semua fitur, dengan **narasi suara** berbahasa Indonesia.

- `src/components/tour/steps.ts` — daftar langkah, terpisah per peran
- `src/components/tour/QuickTour.tsx` — spotlight, kartu, navigasi
- `src/lib/ui/speech.ts` — narasi: ElevenLabs dulu, jatuh ke Web Speech API
- `src/app/api/tts/route.ts` — proxy ElevenLabs sisi server
- `src/lib/ui/sound.ts` — nada penutup, disintesis lewat Web Audio (tanpa file aset)

Dipicu dari tombol **Tour** di navbar, dari sidebar, atau otomatis sekali pada
kunjungan pertama. Bisa dimatikan narasinya lewat ikon speaker di kartu tur
(tersimpan di `localStorage`).

#### Narasi ElevenLabs

Kredensialnya ada di **`.env`, yang ikut ter-commit** (permintaan pemilik repo),
jadi clone mana pun langsung bisa memakai narasi tanpa setup. Konsekuensinya:
repo ini publik, sehingga kunci tersebut terbaca siapa pun — rotasi lewat
dashboard ElevenLabs kalau disalahgunakan. Untuk menariknya keluar dari version
control, pindahkan barisnya ke `.env.local` (sudah tercakup `.gitignore`).

`ELEVENLABS_API_KEY` **hanya dibaca di server** (`/api/tts`) dan tidak pernah
sampai ke browser — menaruhnya di variabel `NEXT_PUBLIC_` akan mengirimkannya ke
setiap pengunjung. Route-nya dijaga tiga lapis karena memakai kredit sungguhan:
wajib punya sesi login, panjang teks dibatasi 600 karakter, dan kegagalan
upstream dikembalikan sebagai status yang bisa di-fallback, bukan error ke user.

Audio di-cache dua kali: `Cache-Control: private, max-age=86400` di response, dan
sebuah `Map` di client — teks langkah yang sama tidak pernah dibeli dua kali
dalam satu sesi.

Kalau ElevenLabs tidak tersedia (key kosong, paket tidak mengizinkan voice-nya,
kuota habis, atau sedang offline), narasi otomatis pindah ke suara bawaan
browser. Tur tidak pernah bisu.

> **Catatan paket:** voice *library/professional* (mis. "Bian", `id-ID`) hanya
> bisa dipakai lewat API pada paket berbayar; akun free mengembalikan `402
> paid_plan_required`. Paket free tetap bisa memakai voice *premade*.

Tiap langkah menempel pada atribut `data-tour` di sidebar, tab bar, dan bubble
asisten. Dua hal yang perlu diingat kalau menambah langkah:

- **Sauh harus beririsan dengan viewport.** Di HP, sidebar adalah drawer
  off-canvas di `left:-243px` yang tetap melaporkan ukuran non-nol — kalau hanya
  mengecek lebar/tinggi, spotlight-nya mendarat di luar layar. Tur otomatis
  membuka drawer untuk fitur yang hanya ada di sidebar.
- **Langkah yang sauhnya tidak ada di DOM akan disaring saat tur dimulai**, bukan
  saat dijalankan. Itu cara peran menentukan isi tur tanpa menduplikasi logika
  sidebar di sini — sekaligus supaya penghitung "x / N" tidak menyebut total yang
  tak pernah tercapai. Contoh: Log Aktivitas hilang untuk chapter admin
  (15 langkah), muncul untuk national admin (9 langkah versi nasional).

### Supabase Admin Client

Satu-satunya pintu akses data server-side — seluruh service dan API route lewat
sini, termasuk halaman konfirmasi publik `/wm/[token]`. Karena itu demo mode
cukup disuntik di satu tempat.

```ts
// src/lib/server/supabaseAdmin.ts
export function getSupabaseAdmin(): SupabaseClient {
  if (cachedClient) return cachedClient
  if (isDemoMode()) {
    cachedClient = createDemoSupabaseClient()   // fake in-memory, lihat Demo Mode
    return cachedClient
  }
  // ...client Supabase asli dengan service role key
}
```

> Client dibuat per request di dalam handler, bukan di module scope. Client
> level-modul akan dikonstruksi saat build mengumpulkan page data, sehingga
> build gagal kapan pun kredensial tidak tersedia saat build.

---

## Demo Mode

Aplikasi bisa jalan **tanpa Supabase sama sekali**. Tanpa `.env.local`, demo mode
menyala otomatis: `getSupabaseAdmin()` mengembalikan fake client in-memory yang
sudah terisi data dummy (3 chapter, meeting mingguan, visitor lintas status,
member, guest, activity log).

```bash
git clone <repo> && cd bni-vh
npm install
npm run dev      # langsung jalan, tidak perlu kredensial
```

Di halaman login muncul panel **Demo Mode** berisi tombol per peran — sekali
klik langsung masuk tanpa mengetik kredensial. Panel ini digerakkan oleh
`/api/demo`, yang saat demo mode mati hanya mengembalikan `{ "demo": false }`
(tanpa daftar akun maupun password), jadi deployment asli tidak pernah
menampilkannya.

Akun demo (semua password `demo123`):

| Email | Role | Scope |
|-------|------|-------|
| `national@demo.test` | National Admin | Semua chapter |
| `grow@demo.test` | Chapter Admin | BNI Grow |
| `rise@demo.test` | Chapter Admin | BNI Rise |
| `pic@demo.test` | PIC | BNI Grow |
| `member@demo.test` | Member | BNI Grow |

`localhost:3000` di-map ke chapter BNI Grow. Chapter lain bisa dibuka lewat
`grow.localhost:3000`, `rise.localhost:3000`, `surya.localhost:3000` (Chromium
me-resolve `*.localhost` ke 127.0.0.1 tanpa perlu edit `/etc/hosts`).

Perubahan data di demo mode tersimpan di memori proses dan hilang saat server
restart. Toggle manual lewat `DEMO_MODE=true` / `DEMO_MODE=false`.

Implementasi: `src/lib/server/demo/` — `config.ts` (toggle), `fakeSupabase.ts`
(query builder PostgREST tiruan), `store.ts` (tabel in-memory), `seed.ts` (data).

---

## Environment Variables (`.env.local`)

Lihat `.env.example` untuk daftar lengkap beserta keterangannya.

```
# Wajib untuk data asli — kosongkan untuk tetap di demo mode
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Opsional
DEMO_MODE=
SESSION_SECRET=
DEEPSEEK_API_KEY=
APP_BASE_DOMAIN=
CRON_SECRET=
```

---

## Docker

```bash
docker compose up -d
```

Buka http://localhost:3000. Tanpa kredensial apa pun, container langsung masuk
**demo mode** — sama seperti `npm run dev`. Ganti port lewat `PORT=8080 docker compose up -d`.

```bash
docker compose logs -f      # ikuti log
docker compose down         # hentikan
```

**Bentuk image.** Multi-stage: `deps` (install, di-cache selama lockfile tidak
berubah) → `builder` (`npm run build`) → `runner`. Next dikonfigurasi
`output: 'standalone'`, jadi runtime-nya server mandiri tanpa `node_modules`
— image jadi **318MB**, berjalan sebagai user non-root (`nextjs`, uid 1001),
dengan `node` sebagai PID 1 supaya SIGTERM diterima langsung dan container
berhenti cepat.

**Secret tidak ikut ke dalam image.** `.dockerignore` menyaring `.env*`;
compose menyuntikkannya saat runtime lewat `env_file`. Terverifikasi: tidak ada
file `.env` di image, dan string kunci tidak ditemukan di seluruh filesystem-nya.
Artinya image yang sama aman didorong ke registry. `env_file` di-set
`required: false`, jadi clone tanpa `.env` tetap jalan (masuk demo mode).

**Healthcheck** menembak `/api/demo`, satu-satunya endpoint yang menjawab tanpa
menyentuh database — jadi tetap sinyal liveness yang jujur baik di demo mode
maupun dengan kredensial asli.

> Compose ini hanya berisi service aplikasi. Supabase tidak ikut dijalankan
> lokal: aplikasi bicara ke Supabase terkelola (PostgREST, GoTrue, dll), bukan
> Postgres polos, jadi menaruh Postgres saja di sini akan menghasilkan stack
> yang tidak berfungsi. Untuk pengembangan tanpa database, demo mode sudah
> menutup kebutuhan itu.

---

## Cara Lanjut Development

```bash
# Install dependencies
npm install

# Dev server
npm run dev

# Type check
npx tsc --noEmit

# Build
npm run build
```

### Branch
- `main` → production (auto-deploy ke Vercel)
- Feature branch baru dari `main`, merge ke `main` untuk deploy

---

## Backlog / Ide Fitur Berikutnya

Belum diimplementasi, bisa dilanjutkan:

- [ ] **Notifikasi WA blast** — kirim WA ke semua visitor yang belum konfirmasi H-1 meeting
- [ ] **QR Code check-in** — alternatif konfirmasi hadir saat event berlangsung
- [ ] **Dashboard analytics chapter** — grafik konversi visitor → member per chapter
- [ ] **Export PDF undangan** — cetak undangan per visitor dengan detail meeting
- [ ] **Notifikasi in-app** — bell/toast ketika ada visitor baru masuk

---

## File Penting

| File | Fungsi |
|------|--------|
| `src/lib/waTemplate.ts` | Template & rendering WA, termasuk `{link_hadir}` |
| `src/lib/auth.ts` | Login, session, role check |
| `src/lib/server/session.ts` | HMAC cookie verify |
| `src/components/pages/Visitors.tsx` | Tabel visitor, buildWaLink |
| `src/components/pages/ManagePicAccounts.tsx` | CRUD akun PIC |
| `src/app/wm/[token]/page.tsx` | Public confirmation page |
| `src/app/api/pic-accounts/route.ts` | API manage PIC |
| `src/app/api/my-account/route.ts` | Self-reset password PIC |
| `src/components/assistant/GrowAssistant.tsx` | BNI Assistant UI |
| `src/app/api/grow-assistant/route.ts` | AI Assistant backend |

---

## Getting Started (Next.js default)

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.
