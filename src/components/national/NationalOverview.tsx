'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ChapterReport, NationalOverview as NationalOverviewData, RankingEntry } from '@/lib/national/types'
import { toneClasses, severityTone, SEVERITY_LABEL } from '@/lib/national/format'
import { useNationalOverview, DEFAULT_FILTERS, OverviewFilters } from './useNationalOverview'
import ChapterDrilldownModal from './ChapterDrilldownModal'
import TargetEditorModal from './TargetEditorModal'

interface ChapterOption {
  id: string
  display_name: string
  area_id: string
  area_name: string
  city_id: string
  city_name: string
}

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Semua Waktu' },
  { value: '12m', label: '12 Bulan' },
  { value: '90d', label: '90 Hari' },
  { value: '30d', label: '30 Hari' },
]

const RANKING_TABS: { key: keyof NationalOverviewData['rankings']; label: string; suffix?: string }[] = [
  { key: 'visitors', label: 'Visitor' },
  { key: 'confirmed', label: 'Konfirmasi' },
  { key: 'attended', label: 'Hadir' },
  { key: 'airtimeQualified', label: 'Airtime' },
  { key: 'memberConversion', label: 'Konversi', suffix: '%' },
  { key: 'dataQuality', label: 'Data Rapi', suffix: '%' },
]

export default function NationalOverview() {
  const [filters, setFilters] = useState<OverviewFilters>(DEFAULT_FILTERS)
  const [chapterOptions, setChapterOptions] = useState<ChapterOption[]>([])
  const [selectedChapter, setSelectedChapter] = useState<ChapterReport | null>(null)
  const [rankingTab, setRankingTab] = useState<string>('visitors')
  const [showTargets, setShowTargets] = useState(false)
  const [fallbackNow, setFallbackNow] = useState(0)
  const { data, loading, error, refetch } = useNationalOverview(filters)

  useEffect(() => {
    setFallbackNow(Date.now())
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/chapters', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : { chapters: [] }))
      .then(payload => {
        if (!cancelled) setChapterOptions(payload.chapters || [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const cityOptions = useMemo(() => {
    const map = new Map<string, string>()
    chapterOptions.forEach(c => c.city_id && map.set(c.city_id, c.city_name))
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [chapterOptions])

  const areaOptions = useMemo(() => {
    const map = new Map<string, string>()
    chapterOptions
      .filter(c => !filters.cityId || c.city_id === filters.cityId)
      .forEach(c => c.area_id && map.set(c.area_id, c.area_name))
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [chapterOptions, filters.cityId])

  const chapterPickOptions = useMemo(
    () =>
      chapterOptions
        .filter(c => !filters.cityId || c.city_id === filters.cityId)
        .filter(c => !filters.areaId || c.area_id === filters.areaId)
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [chapterOptions, filters.cityId, filters.areaId]
  )

  const updateFilter = (patch: Partial<OverviewFilters>) => {
    setFilters(prev => {
      const next = { ...prev, ...patch }
      // Reset downstream selections when a parent scope changes.
      if (patch.cityId !== undefined) {
        next.areaId = ''
        next.chapterId = ''
      }
      if (patch.areaId !== undefined) next.chapterId = ''
      return next
    })
  }

  const now = data ? Date.parse(data.generatedAt) || fallbackNow : fallbackNow

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect
            label="Periode"
            value={filters.period}
            onChange={value => updateFilter({ period: value })}
            options={PERIOD_OPTIONS.map(p => ({ value: p.value, label: p.label }))}
          />
          <FilterSelect
            label="Kota"
            value={filters.cityId}
            onChange={value => updateFilter({ cityId: value })}
            options={[{ value: '', label: 'Semua Kota' }, ...cityOptions.map(c => ({ value: c.id, label: c.name }))]}
          />
          <FilterSelect
            label="Area"
            value={filters.areaId}
            onChange={value => updateFilter({ areaId: value })}
            options={[{ value: '', label: 'Semua Area' }, ...areaOptions.map(a => ({ value: a.id, label: a.name }))]}
          />
          <FilterSelect
            label="Chapter"
            value={filters.chapterId}
            onChange={value => updateFilter({ chapterId: value })}
            options={[{ value: '', label: 'Semua Chapter' }, ...chapterPickOptions.map(c => ({ value: c.id, label: c.display_name }))]}
          />
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setShowTargets(true)}
              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700"
            >
              Atur Target
            </button>
            <button
              onClick={() => refetch()}
              className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <svg className="h-8 w-8 animate-spin text-red-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {data && (
        <>
          <KpiRow data={data} />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
            <HealthGrid chapters={data.chapters} onSelect={setSelectedChapter} />
            <AlertCenter alerts={data.alerts} />
          </div>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
            <FunnelPanel funnel={data.totals.funnel} avgConversion={data.totals.avgConversion} />
            <RankingPanel
              rankings={data.rankings}
              activeTab={rankingTab}
              onTab={setRankingTab}
            />
          </div>
          <RegionBreakdown cities={data.regions.cities} areas={data.regions.areas} />
        </>
      )}

      {selectedChapter && (
        <ChapterDrilldownModal chapter={selectedChapter} now={now} onClose={() => setSelectedChapter(null)} />
      )}

      {showTargets && (
        <TargetEditorModal
          chapters={chapterOptions.map(c => ({ id: c.id, display_name: c.display_name }))}
          onClose={() => setShowTargets(false)}
          onSaved={() => refetch()}
        />
      )}
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function KpiRow({ data }: { data: NonNullable<ReturnType<typeof useNationalOverview>['data']> }) {
  const t = data.totals
  const cards = [
    { label: 'Chapter', value: `${t.activeChapters}/${t.chapters}`, hint: 'aktif / total', accent: 'text-blue-600' },
    { label: 'Total Visitor', value: t.visitors, hint: data.period.label, accent: 'text-slate-700' },
    { label: 'Member Baru', value: t.members, hint: `konversi ${t.avgConversion}%`, accent: 'text-cyan-600' },
    { label: 'Kehadiran', value: `${t.avgAttendance}%`, hint: 'dari yang komit', accent: 'text-emerald-600' },
    { label: 'Avg Health', value: t.avgHealthScore, hint: 'rata-rata nasional', accent: 'text-orange-600' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map(card => (
        <div key={card.label} className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{card.label}</div>
          <div className={`mt-2 text-2xl font-black ${card.accent}`}>{card.value}</div>
          <div className="mt-1 text-[11px] font-medium text-gray-500">{card.hint}</div>
        </div>
      ))}
    </div>
  )
}

function HealthGrid({ chapters, onSelect }: { chapters: ChapterReport[]; onSelect: (chapter: ChapterReport) => void }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-black text-gray-950">Chapter Health Score</h3>
          <p className="mt-1 text-sm text-gray-500">Klik chapter untuk overview ringkas.</p>
        </div>
      </div>
      {chapters.length === 0 ? (
        <EmptyHint text="Belum ada chapter dalam scope ini." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {chapters.map(chapter => {
            const tone = toneClasses(chapter.health.tone)
            return (
              <button
                key={chapter.id}
                onClick={() => onSelect(chapter)}
                className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white/80 p-4 text-left transition hover:border-red-200 hover:bg-red-50/40"
              >
                <div className={`flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-2xl ${tone.soft}`}>
                  <span className={`text-xl font-black ${tone.text}`}>{chapter.health.score}</span>
                  <span className="text-[9px] font-bold text-gray-400">{chapter.health.grade}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black text-gray-950">{chapter.displayName}</div>
                  <div className="truncate text-[11px] font-medium text-gray-500">{chapter.cityName} / {chapter.areaName}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.badge}`}>{chapter.health.label}</span>
                    <span className="text-[11px] font-medium text-gray-500">{chapter.stats.totalVisitors} visitor · {chapter.stats.members} member</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AlertCenter({ alerts }: { alerts: NonNullable<ReturnType<typeof useNationalOverview>['data']>['alerts'] }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-black text-gray-950">Alert Center</h3>
        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">{alerts.length} alert</span>
      </div>
      {alerts.length === 0 ? (
        <EmptyHint text="Tidak ada alert. Semua chapter sehat." />
      ) : (
        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {alerts.map(alert => {
            const tone = toneClasses(severityTone(alert.severity))
            return (
              <div key={alert.id} className={`flex items-start gap-3 rounded-2xl border border-gray-100 p-3 ${tone.soft}`}>
                <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.badge}`}>{SEVERITY_LABEL[alert.severity]}</span>
                <p className="text-xs font-medium text-gray-700">{alert.message}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FunnelPanel({
  funnel,
  avgConversion,
}: {
  funnel: NonNullable<ReturnType<typeof useNationalOverview>['data']>['totals']['funnel']
  avgConversion: number
}) {
  const base = Math.max(funnel[0]?.count || 0, 1)
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-black text-gray-950">National Funnel</h3>
        <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">Konversi {avgConversion}%</span>
      </div>
      <div className="space-y-3">
        {funnel.map((step, index) => {
          const pct = Math.round((step.count / base) * 100)
          const prev = index > 0 ? funnel[index - 1].count : step.count
          const stepPct = prev > 0 ? Math.round((step.count / prev) * 100) : 0
          return (
            <div key={step.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700">{step.label}</span>
                <span className="font-medium text-gray-500">
                  {step.count}
                  {index > 0 && <span className="ml-2 text-[10px] text-gray-400">{stepPct}% dari atas</span>}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-gradient-to-r from-orange-300 via-orange-400 to-red-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RankingPanel({
  rankings,
  activeTab,
  onTab,
}: {
  rankings: NonNullable<ReturnType<typeof useNationalOverview>['data']>['rankings']
  activeTab: string
  onTab: (tab: string) => void
}) {
  const activeMeta = RANKING_TABS.find(tab => tab.key === activeTab) || RANKING_TABS[0]
  const entries = (rankings as Record<string, RankingEntry[]>)[activeTab] || []
  const max = Math.max(...entries.map(entry => entry.value), 1)

  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm">
      <h3 className="mb-3 text-base font-black text-gray-950">Ranking Chapter</h3>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {RANKING_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => onTab(tab.key as string)}
            className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
              activeTab === tab.key ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {entries.length === 0 ? (
        <EmptyHint text="Belum ada data ranking." />
      ) : (
        <div className="space-y-2.5">
          {entries.slice(0, 10).map((entry, index) => (
            <div key={entry.chapterId} className="flex items-center gap-3">
              <span className="w-5 text-center text-xs font-black text-gray-400">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between">
                  <span className="truncate text-xs font-bold text-gray-800">{entry.displayName}</span>
                  <span className="text-xs font-black text-gray-900">{entry.value}{activeMeta.suffix || ''}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-600" style={{ width: `${(entry.value / max) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RegionBreakdown({
  cities,
  areas,
}: {
  cities: NonNullable<ReturnType<typeof useNationalOverview>['data']>['regions']['cities']
  areas: NonNullable<ReturnType<typeof useNationalOverview>['data']>['regions']['areas']
}) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <RegionTable title="Performa Kota" rows={cities} />
      <RegionTable title="Performa Area" rows={areas} />
    </div>
  )
}

function RegionTable({
  title,
  rows,
}: {
  title: string
  rows: { id: string; name: string; chapters: number; visitors: number; members: number; avgHealth: number }[]
}) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm">
      <h3 className="mb-4 text-base font-black text-gray-950">{title}</h3>
      {rows.length === 0 ? (
        <EmptyHint text="Belum ada data wilayah." />
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <div key={row.id} className="flex items-center justify-between rounded-2xl bg-white/70 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-gray-900">{row.name}</div>
                <div className="text-[11px] text-gray-500">{row.chapters} chapter · {row.members} member</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm font-black text-gray-950">{row.visitors}</div>
                  <div className="text-[10px] text-gray-400">visitor</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-orange-600">{row.avgHealth}</div>
                  <div className="text-[10px] text-gray-400">health</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">{text}</div>
  )
}
