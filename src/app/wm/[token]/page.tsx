import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'

export const dynamic = 'force-dynamic'

const CONFIRMABLE_STATUSES = ['new', 'followup']
const ALREADY_DONE_STATUSES = ['confirmed', 'attended', 'interview', 'member', 'not_continue']

export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  // Built per request rather than at module scope: a module-level client is
  // constructed while the build collects page data, which fails whenever the
  // credentials aren't present at build time (and bypassed demo mode entirely).
  const supabaseAdmin = getSupabaseAdmin()

  const { data: visitor } = await supabaseAdmin
    .from('visitors')
    .select('id, name, status, chapter, chapter_id, meeting:meeting_id(title, meeting_date)')
    .eq('id', token)
    .maybeSingle()

  if (!visitor) {
    return <ResultPage type="not-found" />
  }

  let type: 'success' | 'already' | 'not-found' = 'success'

  if (ALREADY_DONE_STATUSES.includes(visitor.status)) {
    type = 'already'
  } else if (CONFIRMABLE_STATUSES.includes(visitor.status)) {
    await supabaseAdmin
      .from('visitors')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', visitor.id)
  }

  const meeting: any = Array.isArray(visitor.meeting) ? visitor.meeting[0] : visitor.meeting
  const meetingTitle = meeting?.title || null
  const meetingDate = meeting?.meeting_date
    ? new Date(meeting.meeting_date).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <ResultPage
      type={type}
      visitorName={visitor.name}
      chapterName={visitor.chapter || 'BNI'}
      meetingTitle={meetingTitle}
      meetingDate={meetingDate}
    />
  )
}

function ResultPage({
  type,
  visitorName,
  chapterName,
  meetingTitle,
  meetingDate,
}: {
  type: 'success' | 'already' | 'not-found'
  visitorName?: string
  chapterName?: string
  meetingTitle?: string | null
  meetingDate?: string | null
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-red-950 via-red-800 to-slate-900 px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-2 rounded-full">
            <span className="text-white/80 text-sm font-semibold tracking-wide">
              {chapterName || 'BNI'} Visitor Manager
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          {type === 'success' && (
            <>
              <div className="flex justify-center mb-5">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="w-10 h-10 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Terima kasih, {visitorName?.split(' ')[0]}!
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Kehadiran Anda sudah dikonfirmasi untuk weekly meeting {chapterName}.
              </p>
              {(meetingTitle || meetingDate) && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-left mb-6">
                  {meetingTitle && (
                    <div className="text-sm font-semibold text-red-900 mb-1">{meetingTitle}</div>
                  )}
                  {meetingDate && (
                    <div className="flex items-center gap-2 text-sm text-red-700">
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" />
                      </svg>
                      {meetingDate}
                    </div>
                  )}
                </div>
              )}
              <p className="text-gray-400 text-xs">
                Sampai jumpa di meeting! Tim {chapterName} akan menghubungi Anda jika ada informasi lebih lanjut.
              </p>
            </>
          )}

          {type === 'already' && (
            <>
              <div className="flex justify-center mb-5">
                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-10 h-10 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4m0 4h.01" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Sudah Dikonfirmasi
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                {visitorName ? `Kehadiran ${visitorName} sudah` : 'Kehadiran Anda sudah'} tercatat sebelumnya.
                Sampai jumpa di meeting {chapterName}!
              </p>
            </>
          )}

          {type === 'not-found' && (
            <>
              <div className="flex justify-center mb-5">
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Link Tidak Ditemukan
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                Link konfirmasi ini tidak valid atau sudah tidak aktif. Hubungi PIC Anda untuk mendapatkan link baru.
              </p>
            </>
          )}
        </div>

        <p className="text-center text-white/40 text-xs mt-8">
          Powered by BNI Visitor Manager
        </p>
      </div>
    </div>
  )
}
