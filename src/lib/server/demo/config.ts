import 'server-only'

// Demo mode swaps the Supabase service-role client for an in-memory fake so the
// app runs end-to-end with no database behind it. Two ways to turn it on:
//
//   DEMO_MODE=true   force it on, even when real credentials exist
//   DEMO_MODE=false  force it off, even when credentials are missing
//   (unset)          auto — on when Supabase credentials are absent
//
// The auto branch is what makes `git clone && npm run dev` work: without keys
// the real client throws on first use, so falling back to the fake one is
// strictly better than a 500 on every page.
export function isDemoMode(): boolean {
  const flag = (process.env.DEMO_MODE || '').trim().toLowerCase()
  if (flag === 'true' || flag === '1') return true
  if (flag === 'false' || flag === '0') return false

  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY
}

// Fixed secret so demo sessions survive a dev-server restart. Never reached in
// a real deployment: session.ts only falls back here when DEMO_MODE is on.
export const DEMO_SESSION_SECRET = 'bni-visitor-demo-session-secret'
