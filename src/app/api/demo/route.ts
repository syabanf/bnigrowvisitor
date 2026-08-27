import { NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/server/demo/config'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lib/server/demo/seed'

export const dynamic = 'force-dynamic'

// Tells the login screen whether to offer one-click demo logins. When demo mode
// is off this returns nothing but `{ demo: false }` — no account list, no
// password — so a real deployment can't leak a shortcut it doesn't have.
export async function GET() {
  if (!isDemoMode()) {
    return NextResponse.json({ demo: false })
  }

  return NextResponse.json({
    demo: true,
    password: DEMO_PASSWORD,
    accounts: DEMO_ACCOUNTS,
  })
}
