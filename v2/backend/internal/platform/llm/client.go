// Package llm talks to an OpenAI-compatible chat completions endpoint.
//
// Compatible rather than vendor-specific: DeepSeek, OpenAI, Groq, OpenRouter
// and most self-hosted servers all speak this shape, so the provider is a base
// URL and a model name in the environment rather than a code change. v1 called
// DeepSeek directly and could not be pointed anywhere else.
package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Role string

const (
	RoleSystem    Role = "system"
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
)

type Message struct {
	Role    Role   `json:"role"`
	Content string `json:"content"`
}

type Client struct {
	http    *http.Client
	baseURL string
	apiKey  string
	model   string
}

// ErrNotConfigured means no provider is set up. It is a condition to handle,
// not a failure to report: the caller answers from the data instead.
var ErrNotConfigured = errors.New("penyedia AI belum dikonfigurasi")

func New(baseURL, apiKey, model string) *Client {
	if baseURL == "" {
		baseURL = "https://api.deepseek.com"
	}
	if model == "" {
		model = "deepseek-chat"
	}
	return &Client{
		// Bounded: a provider that hangs must not hold the request open until
		// the server's own 30s timeout fires, which would look like the app
		// hanging rather than the model being slow.
		http:    &http.Client{Timeout: 30 * time.Second},
		baseURL: strings.TrimRight(baseURL, "/"),
		apiKey:  apiKey,
		model:   model,
	}
}

func (c *Client) Configured() bool { return c.apiKey != "" }

type chatRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature"`
	MaxTokens   int       `json:"max_tokens"`
	Stream      bool      `json:"stream"`
}

type chatResponse struct {
	Choices []struct {
		Message Message `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// Complete sends one turn and returns the reply text.
func (c *Client) Complete(ctx context.Context, messages []Message) (string, error) {
	if !c.Configured() {
		return "", ErrNotConfigured
	}

	body, err := json.Marshal(chatRequest{
		Model:    c.model,
		Messages: messages,
		// Low, not zero: the answers are about the user's own numbers, where
		// invention is the failure mode that matters.
		Temperature: 0.2,
		MaxTokens:   900,
		Stream:      false,
	})
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("penyedia AI tidak dapat dihubungi: %w", err)
	}
	defer resp.Body.Close()

	// Capped: an error page from a misconfigured base URL can be a whole HTML
	// document, and none of it belongs in a log line.
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", err
	}

	var parsed chatResponse
	// Decoding is attempted even on a non-2xx: providers put the useful part of
	// the failure in the body, and the status alone rarely says which of "wrong
	// key", "wrong model" or "out of credit" happened.
	_ = json.Unmarshal(raw, &parsed)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		detail := ""
		if parsed.Error != nil {
			detail = ": " + parsed.Error.Message
		}
		return "", fmt.Errorf("penyedia AI menolak permintaan (%d)%s", resp.StatusCode, detail)
	}
	if len(parsed.Choices) == 0 {
		return "", errors.New("penyedia AI tidak mengembalikan jawaban")
	}
	return strings.TrimSpace(parsed.Choices[0].Message.Content), nil
}
