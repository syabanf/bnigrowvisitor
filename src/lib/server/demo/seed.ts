import 'server-only'
import bcrypt from 'bcryptjs'
import type { DemoTables } from './store'

// Deterministic, UUID-shaped ids. Stable across restarts so links pasted from a
// previous demo session keep resolving.
function uid(group: string, index: number): string {
  return `${group}-0000-4000-8000-${String(index).padStart(12, '0')}`
}

const ID = {
  organization: 'a0000001',
  city: 'a0000002',
  area: 'a0000003',
  chapter: 'a0000004',
  domain: 'a0000005',
  user: 'a0000006',
  meeting: 'a0000007',
  visitor: 'a0000008',
  member: 'a0000009',
  guest: 'a000000a',
  target: 'a000000b',
  policy: 'a000000c',
  log: 'a000000d',
  apiKey: 'a000000e',
}

export const DEMO_PASSWORD = 'demo123'

// The accounts offered as one-click logins on the login screen. Kept beside the
// seed so a renamed or removed user can't leave a dead button behind.
export const DEMO_ACCOUNTS = [
  { email: 'national@demo.test', name: 'Rina Wijaya', label: 'National Admin', scope: 'Semua chapter' },
  { email: 'grow@demo.test', name: 'Budi Santoso', label: 'Chapter Admin', scope: 'BNI Grow' },
  { email: 'pic@demo.test', name: 'Andi Pratama', label: 'PIC', scope: 'BNI Grow' },
  { email: 'member@demo.test', name: 'Dewi Lestari', label: 'Member', scope: 'BNI Grow' },
] as const

function isoDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

function dateDaysAgo(days: number): string {
  return isoDaysAgo(days).slice(0, 10)
}

// Most recent Tuesday offset by whole weeks; BNI chapters meet weekly.
function meetingDate(weeksAgo: number): string {
  const date = new Date()
  const daysSinceTuesday = (date.getDay() + 5) % 7
  date.setDate(date.getDate() - daysSinceTuesday - weeksAgo * 7)
  return date.toISOString().slice(0, 10)
}

interface ChapterSpec {
  index: number
  name: string
  displayName: string
  areaIndex: number
  slug: string
}

const CHAPTERS: ChapterSpec[] = [
  { index: 1, name: 'BNI Grow', displayName: 'BNI Grow Chapter', areaIndex: 1, slug: 'grow' },
  { index: 2, name: 'BNI Rise', displayName: 'BNI Rise Chapter', areaIndex: 2, slug: 'rise' },
  { index: 3, name: 'BNI Surya', displayName: 'BNI Surya Chapter', areaIndex: 3, slug: 'surya' },
]

const BUSINESS_FIELDS = [
  'Kontraktor Interior',
  'Konsultan Pajak',
  'Digital Marketing',
  'Supplier Alat Kesehatan',
  'Katering & Event',
  'Asuransi Jiwa',
  'Percetakan & Packaging',
  'Jasa Logistik',
  'Properti & Kost',
  'Klinik Kecantikan',
  'IT Managed Service',
  'Travel Umroh',
]

const COMPANIES = [
  'CV Karya Mandiri',
  'PT Sinar Abadi',
  'PT Nusantara Digital',
  'CV Medika Sentosa',
  'Dapur Rasa Catering',
  'PT Proteksi Utama',
  'CV Cetak Cepat',
  'PT Kargo Lintas',
  'PT Griya Property',
  'Klinik Ayu Sehat',
  'PT Solusi Teknologi',
  'PT Barokah Wisata',
]

const FIRST_NAMES = [
  'Budi', 'Sari', 'Andi', 'Dewi', 'Rizky', 'Putri', 'Hendra', 'Maya',
  'Agus', 'Nina', 'Fajar', 'Ratna', 'Doni', 'Lestari', 'Iwan', 'Citra',
  'Bayu', 'Wulan', 'Yudi', 'Anggun', 'Reza', 'Intan', 'Galih', 'Mira',
  'Surya', 'Kartika', 'Bagas', 'Ayu', 'Dimas', 'Sinta', 'Arif', 'Novi',
  'Teguh', 'Rani', 'Eko', 'Vina', 'Hadi', 'Lia', 'Wawan', 'Tika',
]

const LAST_NAMES = [
  'Santoso', 'Kusuma', 'Pratama', 'Lestari', 'Wijaya', 'Halim', 'Nugroho',
  'Saputra', 'Permana', 'Hartono', 'Gunawan', 'Setiawan', 'Rahayu', 'Firmansyah',
]

const VISITOR_STATUSES = [
  'new', 'new', 'followup', 'followup', 'confirmed', 'confirmed',
  'attended', 'attended', 'attended', 'interview', 'member', 'no_show', 'not_continue',
]

const ATTENDED_CHOICES: Record<number, string> = {
  1: 'Tertarik bergabung',
  2: 'Ingin datang lagi',
  3: 'Belum tertarik',
}

function phoneFor(index: number): string {
  return `0812${String(30000000 + index * 137).slice(0, 8)}`
}

function personName(index: number): string {
  return `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[index % LAST_NAMES.length]}`
}

export function buildDemoSeed(): DemoTables {
  // One hash, reused for every demo account: bcrypt is deliberately slow, and
  // hashing 15 accounts separately would add a visible pause to first boot.
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10)

  const organizationId = uid(ID.organization, 1)
  const organizations = [
    {
      id: organizationId,
      name: 'BNI Indonesia',
      code: 'BNI-ID',
      is_active: true,
      created_at: isoDaysAgo(720),
      updated_at: isoDaysAgo(720),
    },
  ]

  const cities = [
    { id: uid(ID.city, 1), organization_id: organizationId, name: 'Jakarta', is_active: true },
    { id: uid(ID.city, 2), organization_id: organizationId, name: 'Surabaya', is_active: true },
  ].map(city => ({ ...city, created_at: isoDaysAgo(700), updated_at: isoDaysAgo(700) }))

  const areas = [
    { id: uid(ID.area, 1), city_id: uid(ID.city, 1), name: 'Jakarta Selatan', is_active: true },
    { id: uid(ID.area, 2), city_id: uid(ID.city, 1), name: 'Jakarta Pusat', is_active: true },
    { id: uid(ID.area, 3), city_id: uid(ID.city, 2), name: 'Surabaya Barat', is_active: true },
  ].map(area => ({ ...area, created_at: isoDaysAgo(690), updated_at: isoDaysAgo(690) }))

  const chapters = CHAPTERS.map(spec => ({
    id: uid(ID.chapter, spec.index),
    area_id: uid(ID.area, spec.areaIndex),
    name: spec.name,
    display_name: spec.displayName,
    is_active: true,
    created_at: isoDaysAgo(680),
    updated_at: isoDaysAgo(680),
  }))

  // localhost maps to the first chapter so `npm run dev` lands on a live tenant
  // instead of an unbranded shell. The *.localhost rows let you switch chapters
  // by host in Chromium, which resolves them to 127.0.0.1 without /etc/hosts.
  const chapter_domains = [
    {
      id: uid(ID.domain, 1),
      chapter_id: uid(ID.chapter, 1),
      domain: 'localhost:3000',
      type: 'localhost',
      is_primary: true,
      is_active: true,
    },
    ...CHAPTERS.map((spec, position) => ({
      id: uid(ID.domain, position + 2),
      chapter_id: uid(ID.chapter, spec.index),
      domain: `${spec.slug}.localhost:3000`,
      type: 'localhost',
      is_primary: false,
      is_active: true,
    })),
    ...CHAPTERS.map((spec, position) => ({
      id: uid(ID.domain, position + 10),
      chapter_id: uid(ID.chapter, spec.index),
      domain: `${spec.slug}.bni-vh.com`,
      type: 'subdomain',
      is_primary: false,
      is_active: true,
    })),
  ].map(domain => ({ ...domain, created_at: isoDaysAgo(600), updated_at: isoDaysAgo(600) }))

  const baseUser = {
    password_hash: passwordHash,
    avatar_url: null,
    is_active: true,
    organization_id: organizationId,
    created_at: isoDaysAgo(400),
    updated_at: isoDaysAgo(30),
  }

  const users = [
    {
      ...baseUser,
      id: uid(ID.user, 1),
      name: 'Rina Wijaya',
      email: 'national@demo.test',
      role: 'national_admin',
      phone: '081200000001',
      chapter_id: null,
      business_classification: null,
    },
    {
      ...baseUser,
      id: uid(ID.user, 2),
      name: 'Budi Santoso',
      email: 'grow@demo.test',
      role: 'chapter_admin',
      phone: '081200000002',
      chapter_id: uid(ID.chapter, 1),
      business_classification: 'Kontraktor Interior',
    },
    {
      ...baseUser,
      id: uid(ID.user, 3),
      name: 'Sari Kusuma',
      email: 'rise@demo.test',
      role: 'chapter_admin',
      phone: '081200000003',
      chapter_id: uid(ID.chapter, 2),
      business_classification: 'Konsultan Pajak',
    },
    {
      ...baseUser,
      id: uid(ID.user, 4),
      name: 'Andi Pratama',
      email: 'pic@demo.test',
      role: 'pic',
      phone: '081200000004',
      chapter_id: uid(ID.chapter, 1),
      business_classification: 'Digital Marketing',
    },
    {
      ...baseUser,
      id: uid(ID.user, 5),
      name: 'Dewi Lestari',
      email: 'member@demo.test',
      role: 'member',
      phone: '081200000005',
      chapter_id: uid(ID.chapter, 1),
      business_classification: 'Katering & Event',
    },
  ]

  // Extra PICs so the "assign PIC" pickers and per-PIC reports have real spread.
  CHAPTERS.forEach(spec => {
    for (let slot = 0; slot < 3; slot += 1) {
      const index = 10 + spec.index * 10 + slot
      users.push({
        ...baseUser,
        id: uid(ID.user, index),
        name: personName(index),
        email: `pic${slot + 1}.${spec.slug}@demo.test`,
        role: 'pic',
        phone: phoneFor(index),
        chapter_id: uid(ID.chapter, spec.index),
        business_classification: BUSINESS_FIELDS[index % BUSINESS_FIELDS.length],
      })
    }
  })

  const meetings: DemoTables['meetings'] = []
  CHAPTERS.forEach(spec => {
    // Six past meetings plus the next one, so dashboards have history and the
    // "upcoming meeting" widgets have something to point at.
    for (let week = -1; week <= 5; week += 1) {
      const index = spec.index * 100 + (week + 1)
      meetings.push({
        id: uid(ID.meeting, index),
        chapter_id: uid(ID.chapter, spec.index),
        title: week < 0 ? `Weekly Meeting ${spec.name} (Upcoming)` : `Weekly Meeting ${spec.name}`,
        meeting_date: meetingDate(week),
        location: spec.index === 3 ? 'Hotel Vasa Surabaya' : `Ballroom ${spec.displayName}`,
        notes: null,
        created_by: uid(ID.user, 1),
        created_at: isoDaysAgo(60),
        updated_at: isoDaysAgo(7),
      })
    }
  })

  const members: DemoTables['members'] = []
  CHAPTERS.forEach(spec => {
    const memberCount = spec.index === 1 ? 18 : spec.index === 2 ? 14 : 10
    for (let slot = 0; slot < memberCount; slot += 1) {
      const index = spec.index * 100 + slot
      // A couple of members per chapter are near or past renewal so the renewal
      // and overdue views are not empty.
      const renewalOffset = slot === 0 ? -12 : slot === 1 ? 9 : 120 + slot * 7
      members.push({
        id: uid(ID.member, index),
        chapter_id: uid(ID.chapter, spec.index),
        organization_id: organizationId,
        name: personName(index),
        phone: phoneFor(index),
        email: `member${slot + 1}.${spec.slug}@demo.test`,
        business_field: BUSINESS_FIELDS[index % BUSINESS_FIELDS.length],
        company: COMPANIES[index % COMPANIES.length],
        chapter: spec.name,
        joined_date: dateDaysAgo(300 - slot * 11),
        status: slot === 12 ? 'inactive' : 'active',
        renewal_date: dateDaysAgo(-renewalOffset),
        last_renewed_at: isoDaysAgo(330 - slot * 11),
        notes: null,
        created_at: isoDaysAgo(300 - slot * 11),
        updated_at: isoDaysAgo(20),
      })
    }
  })

  const visitors: DemoTables['visitors'] = []
  CHAPTERS.forEach(spec => {
    const chapterMeetings = meetings.filter(meeting => meeting.chapter_id === uid(ID.chapter, spec.index))
    const chapterPics = users.filter(
      user => user.role === 'pic' && user.chapter_id === uid(ID.chapter, spec.index)
    )
    const chapterMembers = members.filter(member => member.chapter_id === uid(ID.chapter, spec.index))

    const visitorCount = spec.index === 1 ? 26 : spec.index === 2 ? 18 : 12
    for (let slot = 0; slot < visitorCount; slot += 1) {
      const index = spec.index * 100 + slot
      const meeting = chapterMeetings[slot % chapterMeetings.length]
      const isUpcoming = meeting.meeting_date >= dateDaysAgo(0)
      // Upcoming meetings can only hold pre-attendance statuses; past meetings
      // carry the full funnel. Anything else would render as impossible data.
      const status = isUpcoming
        ? (['new', 'followup', 'confirmed'] as const)[slot % 3]
        : VISITOR_STATUSES[slot % VISITOR_STATUSES.length]
      const referrer = chapterMembers[slot % chapterMembers.length]
      const attendedChoice = status === 'attended' ? ((slot % 3) + 1) : null

      visitors.push({
        id: uid(ID.visitor, index),
        chapter_id: uid(ID.chapter, spec.index),
        name: personName(index + 7),
        phone: phoneFor(index + 500),
        email: `visitor${slot + 1}.${spec.slug}@demo.test`,
        business_field: BUSINESS_FIELDS[(index + 3) % BUSINESS_FIELDS.length],
        company: COMPANIES[(index + 5) % COMPANIES.length],
        chapter: spec.name,
        gender: slot % 3 === 0 ? 'P' : 'L',
        referral_name: referrer?.name ?? null,
        referral_user_id: null,
        meeting_id: meeting.id,
        meeting_date: meeting.meeting_date,
        pic_id: chapterPics[slot % chapterPics.length]?.id ?? null,
        status,
        attended_choice_number: attendedChoice,
        attended_choice_note: attendedChoice ? ATTENDED_CHOICES[attendedChoice] : null,
        notes: status === 'followup' ? 'Sudah dihubungi, minta dikabari H-2.' : null,
        created_by: uid(ID.user, 2),
        created_at: isoDaysAgo(40 - (slot % 30)),
        updated_at: isoDaysAgo(3),
      })
    }
  })

  const guests: DemoTables['guests'] = []
  CHAPTERS.forEach(spec => {
    const chapterMeetings = meetings.filter(meeting => meeting.chapter_id === uid(ID.chapter, spec.index))
    for (let slot = 0; slot < 6; slot += 1) {
      const index = spec.index * 100 + slot
      const meeting = chapterMeetings[(slot + 2) % chapterMeetings.length]
      guests.push({
        id: uid(ID.guest, index),
        chapter_id: uid(ID.chapter, spec.index),
        name: personName(index + 21),
        gender: slot % 2 === 0 ? 'L' : 'P',
        business_field: BUSINESS_FIELDS[(index + 8) % BUSINESS_FIELDS.length],
        company: COMPANIES[(index + 2) % COMPANIES.length],
        phone: phoneFor(index + 900),
        email: `guest${slot + 1}.${spec.slug}@demo.test`,
        chapter: spec.name,
        referral_name: personName(index + 4),
        meeting_id: meeting.id,
        meeting_date: meeting.meeting_date,
        meeting_format: slot % 2 === 0 ? 'offline' : 'online',
        visit_date: meeting.meeting_date,
        source_type: 'Guest',
        notes: null,
        created_by: uid(ID.user, 2),
        created_at: isoDaysAgo(25 - slot),
        updated_at: isoDaysAgo(5),
      })
    }
  })

  const chapter_targets = CHAPTERS.map(spec => ({
    id: uid(ID.target, spec.index),
    organization_id: organizationId,
    chapter_id: uid(ID.chapter, spec.index),
    visitors_per_meeting: 10,
    member_conversion_pct: 15,
    min_active_pic: 3,
    min_weekly_meetings_per_month: 4,
    created_at: isoDaysAgo(200),
    updated_at: isoDaysAgo(30),
  }))

  const national_policies = [
    {
      id: uid(ID.policy, 1),
      organization_id: organizationId,
      chapter_id: null,
      policy_type: 'visitor_frequency',
      config: { max_visits: 3, period_months: 6 },
      created_at: isoDaysAgo(200),
      updated_at: isoDaysAgo(40),
    },
    {
      id: uid(ID.policy, 2),
      organization_id: organizationId,
      chapter_id: null,
      policy_type: 'membership_renewal',
      config: { grace_period_days: 30, reminder_days: [30, 14, 7] },
      created_at: isoDaysAgo(200),
      updated_at: isoDaysAgo(40),
    },
  ]

  const activity_logs = visitors.slice(0, 24).map((visitor, position) => ({
    id: uid(ID.log, position + 1),
    actor_id: uid(ID.user, 2),
    actor_name: 'Budi Santoso',
    actor_email: 'grow@demo.test',
    actor_role: 'chapter_admin',
    action: position % 3 === 0 ? 'create' : 'update',
    entity: 'visitor',
    entity_id: visitor.id,
    entity_label: visitor.name,
    chapter_id: visitor.chapter_id,
    old_data: null,
    new_data: { status: visitor.status },
    metadata: null,
    created_at: isoDaysAgo(position % 20),
  }))

  const login_audit = users.slice(0, 8).map((user, position) => ({
    id: uid(ID.log, 500 + position),
    user_id: user.id,
    email: user.email,
    success: position !== 6,
    reason: position === 6 ? 'wrong_password' : null,
    ip: '127.0.0.1',
    user_agent: 'DemoSeed/1.0',
    organization_id: organizationId,
    chapter_id: user.chapter_id,
    created_at: isoDaysAgo(position),
  }))

  return {
    organizations,
    cities,
    areas,
    chapters,
    chapter_domains,
    chapter_targets,
    national_policies,
    users,
    members,
    meetings,
    visitors,
    guests,
    activity_logs,
    login_audit,
    api_keys: [],
  }
}
