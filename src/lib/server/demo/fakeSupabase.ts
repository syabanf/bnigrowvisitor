import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getDemoTables, type DemoRow } from './store'

// A hand-rolled stand-in for the slice of PostgREST this app actually uses.
// Scope was measured, not guessed: the codebase issues no .rpc(), no realtime,
// no storage, and only the operators implemented below. Anything outside that
// surface throws loudly rather than silently returning wrong data.

interface PostgrestError {
  message: string
  details: string
  hint: string
  code: string
}

interface Result<T> {
  data: T
  error: PostgrestError | null
  count: number | null
  status: number
  statusText: string
}

function err(code: string, message: string, details = ''): PostgrestError {
  return { message, details, hint: '', code }
}

// Foreign-key column -> table it points at. Drives `alias:fk_col(cols)` embeds.
const FK_TARGETS: Record<string, string> = {
  meeting_id: 'meetings',
  chapter_id: 'chapters',
  area_id: 'areas',
  city_id: 'cities',
  organization_id: 'organizations',
  pic_id: 'users',
  referral_user_id: 'users',
  created_by: 'users',
  actor_id: 'users',
  user_id: 'users',
}

// Unique constraints worth emulating: the app branches on 23505 during bulk
// import, so getting these wrong would hide a real code path.
const UNIQUE_CONSTRAINTS: Record<string, string[][]> = {
  users: [['email']],
  organizations: [['name'], ['code']],
  chapter_domains: [['domain']],
  api_keys: [['key_hash']],
  visitors: [['meeting_id', 'phone']],
  chapter_targets: [['chapter_id']],
  national_policies: [['chapter_id', 'policy_type']],
}

type FilterFn = (row: DemoRow) => boolean

function normalize(value: unknown): unknown {
  if (value === undefined) return null
  return value
}

function looseEquals(a: unknown, b: unknown): boolean {
  const left = normalize(a)
  const right = normalize(b)
  if (left === null || right === null) return left === right
  // PostgREST compares via text, so 5 and '5' match. Mirror that.
  return String(left) === String(right)
}

function compare(a: unknown, b: unknown): number {
  const left = normalize(a)
  const right = normalize(b)
  if (left === null && right === null) return 0
  if (left === null) return -1
  if (right === null) return 1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right))
}

function likeToRegExp(pattern: string, flags: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped.replace(/%/g, '.*').replace(/_/g, '.')}$`, flags)
}

function buildFilter(column: string, op: string, value: unknown): FilterFn {
  switch (op) {
    case 'eq':
      return row => looseEquals(row[column], value)
    case 'neq':
      return row => !looseEquals(row[column], value)
    case 'gt':
      return row => compare(row[column], value) > 0
    case 'gte':
      return row => compare(row[column], value) >= 0
    case 'lt':
      return row => compare(row[column], value) < 0
    case 'lte':
      return row => compare(row[column], value) <= 0
    case 'is':
      return row => normalize(row[column]) === normalize(value)
    case 'in': {
      const list = Array.isArray(value) ? value : []
      return row => list.some(candidate => looseEquals(row[column], candidate))
    }
    case 'like':
      return row => likeToRegExp(String(value), '').test(String(normalize(row[column]) ?? ''))
    case 'ilike':
      return row => likeToRegExp(String(value), 'i').test(String(normalize(row[column]) ?? ''))
    default:
      throw new Error(`[demo] unsupported filter operator: ${op}`)
  }
}

// PostgREST `.or()` syntax: "phone.eq.0812,phone.eq.+62812"
function parseOrFilter(expression: string): FilterFn {
  const clauses = expression
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const [column, op, ...rest] = part.split('.')
      const raw = rest.join('.')
      const value = raw === 'null' ? null : raw
      return buildFilter(column, op, value)
    })
  return row => clauses.some(clause => clause(row))
}

// Splits "id, name, meeting:meeting_id(title, date)" on top-level commas only.
function splitColumns(selection: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of selection) {
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (char === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

function project(row: DemoRow, selection: string, tables: Record<string, DemoRow[]>): DemoRow {
  const trimmed = selection.trim()
  if (!trimmed || trimmed === '*') return { ...row }

  const output: DemoRow = {}
  for (const part of splitColumns(trimmed)) {
    if (part === '*') {
      Object.assign(output, row)
      continue
    }

    // Embed: "meeting:meeting_id(title)" and the nested, space-padded variant
    // "area:area_id (id, name, city:city_id (id, name))". Parens are balanced
    // within a top-level part, so slicing to the final ")" is safe; recursion
    // handles the nesting.
    const parenIndex = part.indexOf('(')
    if (parenIndex !== -1 && part.endsWith(')')) {
      const head = part.slice(0, parenIndex).trim()
      const innerColumns = part.slice(parenIndex + 1, -1)
      const separator = head.indexOf(':')
      const alias = separator === -1 ? '' : head.slice(0, separator).trim()
      const fkColumn = separator === -1 ? head : head.slice(separator + 1).trim()
      const targetTable = FK_TARGETS[fkColumn]
      const key = alias || fkColumn
      if (!targetTable) {
        output[key] = null
        continue
      }
      const fkValue = row[fkColumn]
      const related = (tables[targetTable] || []).find(candidate => looseEquals(candidate.id, fkValue))
      output[key] = related ? project(related, innerColumns, tables) : null
      continue
    }

    const alias = part.match(/^([\w]+):([\w]+)$/)
    if (alias) {
      output[alias[1]] = row[alias[2]] ?? null
      continue
    }

    output[part] = row[part] ?? null
  }
  return output
}

function nowIso(): string {
  return new Date().toISOString()
}

function newId(): string {
  return crypto.randomUUID()
}

class DemoQueryBuilder<T = any> implements PromiseLike<Result<T>> {
  private mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private selection = '*'
  private selectRequested = false
  private filters: FilterFn[] = []
  private orderings: { column: string; ascending: boolean }[] = []
  private limitCount: number | null = null
  private rangeBounds: [number, number] | null = null
  private rowMode: 'many' | 'single' | 'maybe' = 'many'
  private payload: DemoRow[] = []
  private conflictColumns: string[] = []
  private countMode: string | null = null
  private headOnly = false

  constructor(private table: string) {}

  select(columns = '*', options?: { count?: string; head?: boolean }) {
    this.selection = columns
    this.selectRequested = true
    if (options?.count) this.countMode = options.count
    if (options?.head) this.headOnly = true
    return this
  }

  insert(values: DemoRow | DemoRow[]) {
    this.mode = 'insert'
    this.payload = Array.isArray(values) ? values : [values]
    return this
  }

  update(values: DemoRow) {
    this.mode = 'update'
    this.payload = [values]
    return this
  }

  upsert(values: DemoRow | DemoRow[], options?: { onConflict?: string }) {
    this.mode = 'upsert'
    this.payload = Array.isArray(values) ? values : [values]
    this.conflictColumns = options?.onConflict
      ? options.onConflict.split(',').map(part => part.trim())
      : ['id']
    return this
  }

  delete() {
    this.mode = 'delete'
    return this
  }

  eq(column: string, value: unknown) { return this.push(column, 'eq', value) }
  neq(column: string, value: unknown) { return this.push(column, 'neq', value) }
  gt(column: string, value: unknown) { return this.push(column, 'gt', value) }
  gte(column: string, value: unknown) { return this.push(column, 'gte', value) }
  lt(column: string, value: unknown) { return this.push(column, 'lt', value) }
  lte(column: string, value: unknown) { return this.push(column, 'lte', value) }
  is(column: string, value: unknown) { return this.push(column, 'is', value) }
  like(column: string, value: string) { return this.push(column, 'like', value) }
  ilike(column: string, value: string) { return this.push(column, 'ilike', value) }
  in(column: string, values: unknown[]) { return this.push(column, 'in', values) }

  not(column: string, op: string, value: unknown) {
    const inner = buildFilter(column, op, value)
    this.filters.push(row => !inner(row))
    return this
  }

  or(expression: string) {
    this.filters.push(parseOrFilter(expression))
    return this
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderings.push({ column, ascending: options?.ascending !== false })
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  range(from: number, to: number) {
    this.rangeBounds = [from, to]
    return this
  }

  single() {
    this.rowMode = 'single'
    return this
  }

  maybeSingle() {
    this.rowMode = 'maybe'
    return this
  }

  private push(column: string, op: string, value: unknown) {
    this.filters.push(buildFilter(column, op, value))
    return this
  }

  private matches(row: DemoRow): boolean {
    return this.filters.every(filter => filter(row))
  }

  private violatesUnique(
    rows: DemoRow[],
    candidate: DemoRow,
    ignoreId?: unknown
  ): string[] | null {
    for (const columns of UNIQUE_CONSTRAINTS[this.table] || []) {
      const relevant = columns.every(column => normalize(candidate[column]) !== null)
      if (!relevant) continue
      const clash = rows.some(
        row =>
          !looseEquals(row.id, ignoreId) &&
          columns.every(column => looseEquals(row[column], candidate[column]))
      )
      if (clash) return columns
    }
    return null
  }

  private run(): Result<T> {
    const tables = getDemoTables()
    const rows = tables[this.table]

    if (!rows) {
      // Same shape the app already handles via isMissingTableError().
      return {
        data: null as T,
        error: err('PGRST205', `Could not find the table 'public.${this.table}' in the schema cache`),
        count: null,
        status: 404,
        statusText: 'Not Found',
      }
    }

    let affected: DemoRow[] = []

    if (this.mode === 'insert' || this.mode === 'upsert') {
      for (const incoming of this.payload) {
        const existingIndex =
          this.mode === 'upsert'
            ? rows.findIndex(row =>
                this.conflictColumns.every(column => looseEquals(row[column], incoming[column]))
              )
            : -1

        if (existingIndex >= 0) {
          const merged = { ...rows[existingIndex], ...incoming, updated_at: nowIso() }
          rows[existingIndex] = merged
          affected.push(merged)
          continue
        }

        const record: DemoRow = {
          id: incoming.id ?? newId(),
          created_at: incoming.created_at ?? nowIso(),
          updated_at: incoming.updated_at ?? nowIso(),
          ...incoming,
        }

        const violated = this.violatesUnique(rows, record)
        if (violated) {
          return {
            data: null as T,
            error: err(
              '23505',
              `duplicate key value violates unique constraint "${this.table}_${violated.join('_')}_key"`,
              `Key (${violated.join(', ')}) already exists.`
            ),
            count: null,
            status: 409,
            statusText: 'Conflict',
          }
        }

        rows.push(record)
        affected.push(record)
      }
    } else if (this.mode === 'update') {
      const patch = this.payload[0] || {}
      for (let index = 0; index < rows.length; index += 1) {
        if (!this.matches(rows[index])) continue
        const merged = { ...rows[index], ...patch, updated_at: patch.updated_at ?? nowIso() }
        const violated = this.violatesUnique(rows, merged, rows[index].id)
        if (violated) {
          return {
            data: null as T,
            error: err(
              '23505',
              `duplicate key value violates unique constraint "${this.table}_${violated.join('_')}_key"`,
              `Key (${violated.join(', ')}) already exists.`
            ),
            count: null,
            status: 409,
            statusText: 'Conflict',
          }
        }
        rows[index] = merged
        affected.push(merged)
      }
    } else if (this.mode === 'delete') {
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (!this.matches(rows[index])) continue
        affected.push(rows[index])
        rows.splice(index, 1)
      }
      affected.reverse()
    } else {
      affected = rows.filter(row => this.matches(row))
    }

    // Ordering / windowing only apply to reads.
    if (this.mode === 'select') {
      for (const { column, ascending } of [...this.orderings].reverse()) {
        affected.sort((a, b) => (ascending ? 1 : -1) * compare(a[column], b[column]))
      }
      if (this.rangeBounds) {
        affected = affected.slice(this.rangeBounds[0], this.rangeBounds[1] + 1)
      }
      if (this.limitCount !== null) {
        affected = affected.slice(0, this.limitCount)
      }
    }

    const total = affected.length
    const projected = this.headOnly
      ? []
      : affected.map(row => project(row, this.selection, tables))

    if (this.rowMode === 'single' || this.rowMode === 'maybe') {
      if (projected.length > 1) {
        return {
          data: null as T,
          error: err('PGRST116', 'JSON object requested, multiple (or no) rows returned'),
          count: this.countMode ? total : null,
          status: 406,
          statusText: 'Not Acceptable',
        }
      }
      if (projected.length === 0 && this.rowMode === 'single') {
        return {
          data: null as T,
          error: err('PGRST116', 'JSON object requested, multiple (or no) rows returned'),
          count: this.countMode ? total : null,
          status: 406,
          statusText: 'Not Acceptable',
        }
      }
      return {
        data: (projected[0] ?? null) as T,
        error: null,
        count: this.countMode ? total : null,
        status: 200,
        statusText: 'OK',
      }
    }

    // supabase-js returns null data for writes unless .select() is chained.
    const isWrite = this.mode !== 'select'
    return {
      data: (isWrite && !this.selectRequested ? null : projected) as T,
      error: null,
      count: this.countMode ? total : null,
      status: 200,
      statusText: 'OK',
    }
  }

  then<TResult1 = Result<T>, TResult2 = never>(
    onfulfilled?: ((value: Result<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    try {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected)
    } catch (error) {
      return Promise.reject(error).then(onfulfilled, onrejected)
    }
  }
}

export function createDemoSupabaseClient(): SupabaseClient {
  const client = {
    from(table: string) {
      return new DemoQueryBuilder(table)
    },
    rpc() {
      throw new Error('[demo] .rpc() is not supported in demo mode')
    },
  }
  return client as unknown as SupabaseClient
}
