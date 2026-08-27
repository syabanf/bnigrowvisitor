import 'server-only'
import { buildDemoSeed } from './seed'

export type DemoRow = Record<string, any>

// Every table the app touches via .from(). A table missing from this map is
// reported as "does not exist" (PGRST205), which the app already degrades on.
export interface DemoTables {
  organizations: DemoRow[]
  cities: DemoRow[]
  areas: DemoRow[]
  chapters: DemoRow[]
  chapter_domains: DemoRow[]
  chapter_targets: DemoRow[]
  national_policies: DemoRow[]
  users: DemoRow[]
  members: DemoRow[]
  meetings: DemoRow[]
  visitors: DemoRow[]
  guests: DemoRow[]
  activity_logs: DemoRow[]
  login_audit: DemoRow[]
  api_keys: DemoRow[]
  [table: string]: DemoRow[]
}

// Next.js dev recompiles modules on every edit; a module-local variable would
// reseed and wipe demo edits mid-session. globalThis outlives HMR.
const STORE_KEY = Symbol.for('bni.demo.store')

interface GlobalWithStore {
  [STORE_KEY]?: DemoTables
}

export function getDemoTables(): DemoTables {
  const container = globalThis as unknown as GlobalWithStore
  if (!container[STORE_KEY]) {
    container[STORE_KEY] = buildDemoSeed()
  }
  return container[STORE_KEY]!
}

// Drops every in-memory edit and rebuilds the pristine dataset.
export function resetDemoTables(): DemoTables {
  const container = globalThis as unknown as GlobalWithStore
  container[STORE_KEY] = buildDemoSeed()
  return container[STORE_KEY]!
}
