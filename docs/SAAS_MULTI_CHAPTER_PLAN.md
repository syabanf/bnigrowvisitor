# BNI Grow Visitor SaaS Multi-Chapter Plan

## Objective

Transform the current BNI Grow Visitor Manager from a single-chapter application into a SaaS-style multi-chapter platform.

The current system serves one chapter: BNI Chapter Grow. The next structure must support BNI Indonesia managing many cities, areas, and chapters, while each chapter has its own admin and operational data.

## Target Organization Structure

Example structure:

```text
BNI Indonesia
└── Jakarta
    └── Jakarta Barat
        └── Chapter Grow
```

Required master data:

- BNI Indonesia as national organization.
- City, for example Jakarta.
- Area, for example Jakarta Barat.
- Chapter, for example Grow.

The records `Jakarta`, `Jakarta Barat`, and `Grow` must exist as master data, not plain text fields.

## Domain and Subdomain Strategy

The SaaS version should support different access domains per chapter.

Possible examples:

```text
app.bni-visitor.com                 -> national / default app entry
grow.bni-visitor.com                -> Chapter Grow
prosperity.bni-visitor.com          -> Chapter Prosperity
visitor.bnigrowjakarta.com          -> custom add-on domain for Chapter Grow
```

Recommended domain model:

- National admin uses the main platform domain.
- Each chapter can have one or more domains.
- A domain maps to one chapter.
- The app resolves tenant/chapter context from the request host.

Proposed table:

### chapter_domains

Fields:

- `id`
- `chapter_id`
- `domain`
- `type`: `subdomain` or `custom_domain`
- `is_primary`
- `is_active`
- `created_at`
- `updated_at`

Rules:

- One chapter can have multiple domains.
- Only one domain should be primary per chapter.
- National admin can manage domains.
- Chapter admin can request/edit display domain only if allowed later.
- Domain-based chapter resolution must not replace database permission checks. It only sets context.

Recommended runtime behavior:

1. User opens a domain.
2. App checks `request.headers.host`.
3. App finds matching `chapter_domains.domain`.
4. If matched, app loads chapter branding/context.
5. After login, access is still validated by user role and `chapter_id`.
6. National admin can switch/view all chapters even from main app domain.

## User Levels

### 1. BNI Indonesia Admin

Top-level account above all chapters.

Responsibilities:

- Create and manage cities.
- Create and manage areas.
- Create and manage chapters.
- Create and manage chapter admins.
- View national dashboard across all chapters.
- Filter dashboard by city, area, and chapter.
- View global activity logs.

Suggested role value: `national_admin`.

### 2. Chapter Admin

Admin for one chapter.

Responsibilities:

- Manage visitors in their own chapter.
- Manage members in their own chapter.
- Manage PIC/users in their own chapter.
- Manage weekly meetings in their own chapter.
- Manage WA text format in their own chapter.
- View chapter dashboard only for their own chapter.
- View chapter-scoped activity logs.

Suggested role value: `chapter_admin`.

### 3. PIC

Operational user inside one chapter.

Responsibilities:

- Follow up visitors assigned to them.
- Update visitor status.
- Add notes/history.
- Access only data in their own chapter.

Suggested role value: `pic`.

### 4. Member

Member-level account for future expansion.

Responsibilities:

- View/update own profile.
- Future gamification features can connect here.
- Access only data allowed for their own chapter.

Suggested role value: `member`.

## Data Ownership Model

Every operational record must be scoped by `chapter_id`.

Required scoped tables:

- `users`
- `members`
- `visitors`
- `meetings`
- `visitor_history`
- `interview_notes`
- `activity_logs`
- WA template/text format data
- Any future gamification tables

Recommended rule:

- Store `chapter_id` on operational tables.
- Do not duplicate `city_id` and `area_id` on every operational table unless performance requires it.
- Derive city and area from `chapters -> areas -> cities`.

## Proposed Schema

### organizations

Optional if the platform will support only BNI Indonesia. Still useful for SaaS readiness.

Fields:

- `id`
- `name`
- `code`
- `created_at`
- `updated_at`

Initial record:

- `BNI Indonesia`

### cities

Fields:

- `id`
- `organization_id`
- `name`
- `is_active`
- `created_at`
- `updated_at`

Example:

- Jakarta

### areas

Fields:

- `id`
- `city_id`
- `name`
- `is_active`
- `created_at`
- `updated_at`

Example:

- Jakarta Barat

### chapters

Fields:

- `id`
- `area_id`
- `name`
- `display_name`
- `is_active`
- `created_at`
- `updated_at`

Example:

- name: `Grow`
- display_name: `Chapter Grow`

### users

Add fields:

- `chapter_id` nullable
- `organization_id` nullable
- role enum update: `national_admin`, `chapter_admin`, `pic`, `member`

Rules:

- `national_admin`: `chapter_id` can be null.
- `chapter_admin`, `pic`, `member`: must have `chapter_id`.

### operational tables

Add `chapter_id` to:

- `members`
- `visitors`
- `meetings`
- `visitor_history`
- `interview_notes`
- `ocr_sessions`
- `activity_logs`

## Existing Data Migration

Current production data belongs to BNI Chapter Grow.

Migration steps:

1. Create organization:
   - `BNI Indonesia`

2. Create city:
   - `Jakarta`

3. Create area:
   - `Jakarta Barat`

4. Create chapter:
   - `Grow`

5. Update all existing records:
   - Set `chapter_id` to Chapter Grow.

6. Update users:
   - `admin@bnigrow.com` becomes temporary `national_admin` or Super Admin.
   - Existing PIC accounts become `pic` under Chapter Grow.
   - Existing member accounts become `member` or `pic` depending current business decision.

## Permission Rules

### National Admin

Can access all chapters.

Queries:

- No forced `chapter_id` filter.
- Can optionally filter by city, area, chapter.

### Chapter Admin

Can access only their own chapter.

Queries:

- Always filter by `chapter_id = currentUser.chapter_id`.

### PIC

Can access only their own chapter.

Recommended:

- Can see visitor list for chapter.
- Can update assigned visitors.
- Can update own member/profile data.
- Cannot create city, area, chapter.
- Cannot create/reset passwords except own password through login flow.

### Member

Can access own profile and future member-facing features.

Recommended:

- Cannot access global visitor database.
- Cannot access admin settings.

## Application Changes

### Auth Session

After login, local user object must include:

- `id`
- `name`
- `email`
- `role`
- `organization_id`
- `chapter_id`
- chapter details:
  - city name
  - area name
  - chapter name

### Routing

Potential pages:

- `/dashboard`:
  - National admin sees national dashboard.
  - Chapter users see chapter dashboard.

- `/master/cities`
  - National admin only.

- `/master/areas`
  - National admin only.

- `/master/chapters`
  - National admin only.

- `/users`
  - National admin can manage chapter admins.
  - Chapter admin can manage PIC/member accounts for own chapter.

- Existing pages:
  - visitors
  - members
  - MCQA
  - weekly
  - text format
  - logs

These must become chapter-scoped.

### Sidebar

National Admin menu:

- National Dashboard
- Kota
- Area
- Chapter
- Chapter Admin
- Global Log

Chapter Admin/PIC menu:

- Dashboard
- Pipeline
- Visitor
- MCQA
- Member Grow
- Export / Import
- Text Format
- Kelola PIC
- Weekly Meeting
- Log

Some menus can be hidden depending role.

## Dashboard Plan

### National Dashboard

Metrics:

- Total visitors across all chapters.
- Total confirmed visitors.
- Total attended visitors.
- Total converted members.
- Conversion funnel national.
- Top performing chapters.
- Top cities/areas.
- Top referrers nationally.
- Top industries nationally.
- Visitor trend per weekly meeting across chapters.

Filters:

- City
- Area
- Chapter
- Date range
- Weekly meeting

### Chapter Dashboard

Keep current dashboard, but filtered to the user's chapter.

Metrics:

- Today Focus
- Belum Assigned
- Data Quality
- Siap Kirim WA
- Conversion Funnel
- Visitor per Weekly Meeting
- Top Industri
- Top Visitor Brought

## Activity Log Plan

Current `activity_logs` should be extended with:

- `organization_id`
- `chapter_id`
- maybe `city_id` and `area_id` only if analytics requires faster filtering

Log every mutation:

- visitor insert/update/delete
- member insert/update/delete
- PIC/user insert/update/delete
- meeting insert/update/delete
- WA template update
- status changes
- password changes without storing password values

National Admin:

- Can view all logs.

Chapter Admin:

- Can view only own chapter logs.

PIC/Member:

- Usually no log menu, or only own activity history.

## Security Plan

The current app relies heavily on frontend filtering. For SaaS, this must be hardened.

Recommended approach:

1. Keep UI filtering for UX.
2. Add Supabase RLS or server-side API layer for real enforcement.
3. Use role and `chapter_id` from trusted database session/user record.
4. Prevent chapter users from reading/updating other chapter data.
5. Ensure password changes never write raw password to logs.

Important:

Because the current custom auth stores password in `users.password_hash` and validates in client code, this should eventually be migrated to Supabase Auth or a secure server-side auth endpoint before serious SaaS rollout.

## Implementation Roadmap

### Phase 0: Planning

Status: current document.

Output:

- SaaS architecture plan.
- Data model proposal.
- Migration sequence.
- Permission model.

## Step-by-Step Execution Plan

This is the recommended execution order. Each step should be implemented, validated, committed, and deployed separately when possible.

### Step 1: SaaS Schema Foundation

Goal:

Create the core master data structure without changing existing UI behavior yet.

Implementation status:

- Migration file: `supabase/migrations/008_saas_schema_foundation.sql`
- Adds master tables: `organizations`, `cities`, `areas`, `chapters`, `chapter_domains`
- Adds SaaS scope columns: `organization_id`, `chapter_id`
- Seeds initial structure: BNI Indonesia > Jakarta > Jakarta Barat > Chapter Grow
- Backfills existing data to Chapter Grow
- Keeps current UI/query behavior unchanged until Step 3

Tasks:

1. Create tables:
   - `organizations`
   - `cities`
   - `areas`
   - `chapters`
   - `chapter_domains`

2. Seed initial structure:
   - Organization: `BNI Indonesia`
   - City: `Jakarta`
   - Area: `Jakarta Barat`
   - Chapter: `Grow`
   - Domain: current production/default domain mapped to Chapter Grow if needed.

3. Add `chapter_id` to operational tables:
   - `users`
   - `members`
   - `visitors`
   - `meetings`
   - `visitor_history`
   - `interview_notes`
   - `ocr_sessions`
   - `activity_logs`

4. Backfill all existing data to Chapter Grow.

Validation:

- Existing dashboard still works.
- Existing visitor/member/meeting data still appears.
- All existing operational rows have `chapter_id`.

### Step 2: Role and User Scope Upgrade

Goal:

Make users aware of their SaaS level and chapter scope.

Tasks:

1. Update user role model to support:
   - `national_admin`
   - `chapter_admin`
   - `pic`
   - `member`

2. Convert existing users:
   - `admin@bnigrow.com` -> temporary `national_admin`
   - Existing PIC users -> `pic` under Chapter Grow

3. Update login response to include:
   - `organization_id`
   - `chapter_id`
   - `chapter_name`
   - `area_name`
   - `city_name`

4. Create permission helpers:
   - `isNationalAdmin`
   - `isChapterAdmin`
   - `isChapterUser`
   - `canManageMasterData`
   - `canManageChapterData`

Validation:

- Admin login identifies as national admin.
- PIC login identifies as chapter-scoped user.
- Existing login still works.

### Step 3: Query Scope Layer

Goal:

Prevent mixed data between chapters at the application data layer.

Tasks:

1. Refactor `useData` query loading to accept current user scope.
2. If user is national admin:
   - allow all data
   - allow optional filter by city/area/chapter
3. If user is chapter admin/PIC/member:
   - force `chapter_id = currentUser.chapter_id`
4. Apply scope to:
   - visitors
   - members
   - meetings
   - PIC/users
   - activity logs
   - WA templates
   - dashboard stats
   - Grow Assistant API context

Validation:

- Chapter user only sees Chapter Grow data.
- National admin sees all data.
- Dashboard counts match scope.

### Step 4: Master Data Admin UI

Goal:

Give BNI Indonesia admin control over Kota, Area, Chapter, and domains.

Tasks:

1. Add National Admin menu section:
   - Kota
   - Area
   - Chapter
   - Chapter Domain
   - Chapter Admin

2. Build CRUD pages:
   - City management
   - Area management
   - Chapter management
   - Chapter domain management

3. Add create chapter admin flow:
   - select city
   - select area
   - select chapter
   - create admin account

Validation:

- Only national admin sees master data menus.
- Chapter users cannot access master pages.
- New chapter can be created without affecting Chapter Grow.

### Step 5: Domain Resolution

Goal:

Allow app context to follow subdomain/custom domain.

Tasks:

1. Add server-side host resolver.
2. Read request host.
3. Match host with `chapter_domains`.
4. Store resolved chapter context for UI.
5. Show chapter branding/context based on resolved domain.
6. Keep login permission based on user account, not domain alone.

Validation:

- Main domain opens national/default app.
- Chapter domain opens chapter-context app.
- User from another chapter cannot access wrong chapter data.

### Step 6: Dashboard Split

Goal:

Separate national dashboard from chapter dashboard.

Tasks:

1. Build national dashboard for `national_admin`.
2. Keep/refactor current dashboard as chapter dashboard.
3. Add filters:
   - city
   - area
   - chapter
   - weekly meeting/date range

Validation:

- National admin sees aggregate all chapters.
- Chapter admin/PIC sees only own chapter dashboard.

### Step 7: Security Hardening

Goal:

Move from UI-only protection to real database/server enforcement.

Tasks:

1. Decide between:
   - Supabase RLS
   - Next.js API routes with service role on server only
   - hybrid model

2. Add policies/enforcement for:
   - users
   - members
   - visitors
   - meetings
   - logs
   - templates

3. Make sure chapter users cannot read/write other chapter data even if request is modified.

Validation:

- Attempted cross-chapter query fails.
- National admin still works.
- Chapter admin still works for own chapter.

### Step 8: SaaS UX Polish

Goal:

Make platform feel intentional for multi-chapter use.

Tasks:

1. Add chapter switcher for national admin.
2. Add current chapter badge in topbar.
3. Add city/area/chapter breadcrumbs.
4. Add per-chapter settings:
   - chapter display name
   - domain
   - WA text format
   - meeting defaults
5. Add empty state/onboarding for newly created chapters.

Validation:

- New chapter setup is understandable.
- National admin can quickly compare and switch chapters.
- Chapter admin only sees relevant operational tools.

### Phase 1: Database Foundation

Create:

- organizations
- cities
- areas
- chapters

Update:

- users role enum
- users chapter_id/organization_id
- visitors chapter_id
- members chapter_id
- meetings chapter_id
- logs chapter_id

Migrate existing data to:

- BNI Indonesia
- Jakarta
- Jakarta Barat
- Grow

### Phase 2: Auth and Access Scope

Update login to load:

- user role
- organization_id
- chapter_id
- chapter/city/area context

Create helpers:

- `isNationalAdmin`
- `isChapterAdmin`
- `canManageMasterData`
- `canManageChapterData`
- `getUserChapterScope`

### Phase 3: Query Scope Refactor

Update all data loading and mutation functions:

- National admin can query all.
- Chapter users automatically filter by chapter.

Affected areas:

- `useData`
- Grow Assistant API
- dashboard aggregation
- export/import
- WA templates
- activity log

### Phase 4: Master Data UI

Build National Admin pages:

- Kota
- Area
- Chapter
- Chapter Admin

### Phase 5: Dashboard Split

Build:

- National dashboard
- Chapter dashboard

National dashboard aggregates all chapters.

Chapter dashboard remains similar to current dashboard.

### Phase 6: Security Hardening

Add database-level policies or server-side route enforcement.

Recommended:

- Avoid relying only on client-side filtering.
- Use RLS or Next.js API routes with service role carefully on server only.

### Phase 7: SaaS Polish

Enhance:

- chapter switcher for national admin
- onboarding flow for new chapter
- per-chapter logo/theme if needed
- usage analytics
- export by chapter
- Grow Assistant aware of selected chapter scope

## Open Decisions

Questions to confirm before implementation:

1. Should `admin@bnigrow.com` become BNI Indonesia admin, or should we create a new `admin@bniindonesia.com` account?
2. Should existing PIC users remain `pic`, or become `chapter_admin` for Chapter Grow?
3. Should every chapter have exactly one admin, or multiple chapter admins?
4. Should member accounts have dashboard access now, or only a future member portal?
5. Should text format WA be global default with chapter override, or fully per chapter?
6. Should cities/areas be BNI-specific names, or reusable generic master data?
7. Should this app remain under the BNI Grow branding, or become BNI Visitor Platform with chapter branding inside?

## Recommended First Technical Step

Do not start with UI.

Start with Phase 1:

1. Add organization/city/area/chapter tables.
2. Add `chapter_id` to operational tables.
3. Migrate existing data to Chapter Grow.
4. Update login user object to include `chapter_id`.

After this foundation, every UI and dashboard can safely become SaaS-aware without rewriting repeatedly.
