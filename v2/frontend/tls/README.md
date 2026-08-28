# Sertifikat TLS

Direktori ini di-mount ke `/etc/nginx/tls` pada service `web-tls`. Nginx
mengharapkan dua file:

- `fullchain.pem`
- `privkey.pem`

## Untuk lokal (self-signed)

```bash
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout privkey.pem -out fullchain.pem \
  -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost"
```

Browser akan memperingatkan sertifikat tidak tepercaya — itu wajar untuk
self-signed, dan cukup untuk menguji jalur HTTPS-nya.

## Untuk produksi

Pakai Let's Encrypt. Blok `/.well-known/acme-challenge/` di `nginx-tls.conf`
sengaja dilayani lewat HTTP polos: kalau ikut dialihkan ke HTTPS, perpanjangan
sertifikat gagal dan situs mati saat sertifikat lama kedaluwarsa.

```bash
docker run --rm \
  -v "$PWD:/etc/letsencrypt/live/app" \
  -v certbot_webroot:/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot -d contoh.bni-vh.com
```

**Jangan commit file `.pem`.** `.gitignore` di direktori ini sudah menyaringnya.
