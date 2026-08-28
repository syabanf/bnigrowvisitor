package domain

import "errors"

// Transport-agnostic failure modes. The HTTP layer maps these to status codes;
// the use cases never mention status codes themselves, which is what lets the
// same use case back an HTTP handler, a CLI, or a job runner.
var (
	ErrNotFound          = errors.New("data tidak ditemukan")
	ErrInvalidCredential = errors.New("email atau password salah")
	ErrForbidden         = errors.New("tidak punya akses")
	ErrValidation        = errors.New("data tidak valid")
	ErrConflict          = errors.New("data sudah ada")
	ErrNoChapterScope    = errors.New("akun tidak terikat pada chapter mana pun")
)
