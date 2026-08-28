export const NATIONAL_PAGE_IDS = new Set([
  'national-overview',
  'national-governance',
  'national-policies',
  'national-api-keys',
  'national-dashboard',
  'master',
  'account',
  'profile',
  'my-account',
])

export function isNationalPage(currentPage: string) {
  return NATIONAL_PAGE_IDS.has(currentPage)
}

export function isNationalPath(pathname: string) {
  return (
    pathname.startsWith('/national-') ||
    pathname === '/master' ||
    pathname === '/account' ||
    pathname === '/profile' ||
    pathname === '/my-account'
  )
}
