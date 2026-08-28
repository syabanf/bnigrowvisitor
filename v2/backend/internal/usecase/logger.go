package usecase

// Logger is declared here rather than imported so the use cases stay free of a
// logging library. main wires in whatever implementation it likes.
type Logger interface {
	Error(msg string, args ...any)
	Info(msg string, args ...any)
}
