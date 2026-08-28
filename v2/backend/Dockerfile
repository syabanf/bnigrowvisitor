# syntax=docker/dockerfile:1

FROM golang:1.26-alpine AS builder
WORKDIR /src
# Module files first so the dependency download layer survives source edits.
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Static binary: the runtime stage has no libc, so cgo must be off.
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/api ./cmd/api

# Nothing but the binary and CA roots — no shell, no package manager, and no
# interpreter for an attacker to reach for.
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder /out/api /app/api
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/api"]
