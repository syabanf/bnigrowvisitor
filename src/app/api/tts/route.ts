import { NextResponse } from 'next/server'
import { getSession } from '@/lib/server/session'

export const dynamic = 'force-dynamic'

// Server-side proxy for ElevenLabs narration.
//
// The API key never leaves the server: the browser posts text here, we call
// ElevenLabs, and stream the audio back. Putting the key in a NEXT_PUBLIC_ var
// would ship it to every visitor.
//
// Guarded on three axes because this spends real credits:
//   - a valid session is required, so it isn't an open TTS proxy
//   - text length is capped, so one request can't drain the quota
//   - upstream failures return a status the client can fall back from rather
//     than an error the user sees

const MAX_CHARS = 600
const ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-speech'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Tidak ada sesi.' }, { status: 401 })
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  const voiceId = process.env.ELEVENLABS_VOICE_ID

  if (!apiKey || !voiceId) {
    // Not an error: narration simply falls back to the browser's own voice.
    return NextResponse.json({ error: 'not_configured' }, { status: 501 })
  }

  const body = await request.json().catch(() => null)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''

  if (!text) {
    return NextResponse.json({ error: 'Teks kosong.' }, { status: 400 })
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json({ error: 'Teks terlalu panjang.' }, { status: 413 })
  }

  try {
    const upstream = await fetch(`${ENDPOINT}/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        // Multilingual is the model that actually speaks Indonesian; the
        // English-only models mangle it.
        model_id: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    })

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '')
      // 401 bad key, 402 plan doesn't allow this voice, 429 quota exhausted.
      // All of them mean "use the browser voice instead", so keep the status
      // meaningful and let the client decide.
      console.error(`ElevenLabs TTS ${upstream.status}:`, detail.slice(0, 300))
      return NextResponse.json(
        { error: 'upstream_failed', status: upstream.status },
        { status: upstream.status === 402 || upstream.status === 429 ? upstream.status : 502 }
      )
    }

    const audio = await upstream.arrayBuffer()
    return new NextResponse(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audio.byteLength),
        // Tour steps repeat verbatim, so let the browser reuse the audio
        // instead of spending credits again. Private: it's session-gated.
        'Cache-Control': 'private, max-age=86400',
      },
    })
  } catch (error: any) {
    console.error('ElevenLabs TTS error:', error?.message || error)
    return NextResponse.json({ error: 'request_failed' }, { status: 502 })
  }
}
