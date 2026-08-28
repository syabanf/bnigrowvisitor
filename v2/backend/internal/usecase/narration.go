package usecase

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"bni-visitor/internal/domain"
)

// NarrationUsecase turns tour text into speech through ElevenLabs.
//
// The credential never leaves the server: the browser posts text here and gets
// audio back. Putting the key in a VITE_ variable would bake it into the bundle
// and hand it to every visitor.
type NarrationUsecase struct {
	client  *http.Client
	apiKey  string
	voiceID string
	modelID string
}

// ErrNarrationUnavailable means "use the browser voice instead", not "something
// broke". It is returned when no key is configured at all.
var ErrNarrationUnavailable = errors.New("narasi tidak tersedia")

func NewNarrationUsecase(apiKey, voiceID, modelID string) *NarrationUsecase {
	return &NarrationUsecase{
		// A bounded client: an upstream that hangs must not hold a request
		// open until the server's own 30s timeout fires.
		client:  &http.Client{Timeout: 20 * time.Second},
		apiKey:  apiKey,
		voiceID: voiceID,
		modelID: modelID,
	}
}

func (uc *NarrationUsecase) Configured() bool {
	return uc.apiKey != "" && uc.voiceID != ""
}

// maxNarrationChars bounds one request. The quota is measured in characters, so
// an unbounded body is a way to drain the account in a single call.
const maxNarrationChars = 600

type NarrationResult struct {
	Audio       []byte
	ContentType string
}

func (uc *NarrationUsecase) Speak(ctx context.Context, text string) (*NarrationResult, error) {
	if !uc.Configured() {
		return nil, ErrNarrationUnavailable
	}

	text = strings.TrimSpace(text)
	if text == "" {
		return nil, domain.ErrValidation
	}
	if len([]rune(text)) > maxNarrationChars {
		return nil, fmt.Errorf("%w: teks terlalu panjang", domain.ErrValidation)
	}

	body := fmt.Sprintf(
		`{"text":%q,"model_id":%q,"voice_settings":{"stability":0.5,"similarity_boost":0.75}}`,
		text, uc.modelID)

	endpoint := "https://api.elevenlabs.io/v1/text-to-speech/" + uc.voiceID
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("xi-api-key", uc.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "audio/mpeg")

	resp, err := uc.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrNarrationUnavailable, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// 401 bad key, 402 the plan disallows this voice, 429 quota exhausted.
		// All of them mean the same thing to the caller: fall back to the
		// browser voice. Reading a slice of the body keeps the server log
		// useful without holding a large error page in memory.
		detail, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("%w: upstream %d: %s",
			ErrNarrationUnavailable, resp.StatusCode, bytes.TrimSpace(detail))
	}

	audio, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return &NarrationResult{Audio: audio, ContentType: "audio/mpeg"}, nil
}
