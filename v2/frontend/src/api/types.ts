export type Role = 'admin' | 'national_admin' | 'chapter_admin' | 'pic' | 'member'

export type VisitorStatus =
  | 'new' | 'followup' | 'confirmed' | 'attended'
  | 'no_show' | 'interview' | 'member' | 'not_continue'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  phone?: string
  chapter_id?: string
  chapter_name?: string
  area_name?: string
  city_name?: string
  is_active: boolean
}

export interface Visitor {
  id: string
  chapter_id: string
  name: string
  phone: string
  email?: string
  business_field?: string
  company?: string
  gender?: string
  referral_name?: string
  meeting_id?: string
  pic_id?: string
  status: VisitorStatus
  notes?: string
  pic_name?: string
  meeting_name?: string
  created_at: string
  updated_at: string
}

export interface Chapter {
  id: string
  name: string
  display_name: string
  area_name?: string
  city_name?: string
}

export interface Meeting {
  id: string
  chapter_id: string
  title: string
  meeting_date: string
  location?: string
}

export interface ListResult<T> {
  data: T[]
  total: number
}

export const STATUS_LABEL: Record<VisitorStatus, string> = {
  new: 'Baru Daftar',
  followup: 'Follow Up',
  confirmed: 'Konfirmasi Hadir',
  attended: 'Hadir',
  no_show: 'Tidak Hadir',
  interview: 'Interview',
  member: 'Jadi Member',
  not_continue: 'Tidak Lanjut',
}
