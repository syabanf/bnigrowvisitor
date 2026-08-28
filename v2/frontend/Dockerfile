# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Shipped but not active: the TLS config is selected at run time by mounting it
# over default.conf, so one image serves both modes.
COPY nginx-tls.conf /etc/nginx/nginx-tls.conf
COPY proxy-headers.conf /etc/nginx/proxy-headers.conf
COPY security-headers.conf /etc/nginx/security-headers.conf
COPY security-headers-tls.conf /etc/nginx/security-headers-tls.conf
EXPOSE 80
