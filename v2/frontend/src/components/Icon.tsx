/**
 * Inline SVG icon set.
 *
 * Inline rather than an icon font or sprite: they inherit currentColor and font
 * size, need no extra request, and cannot flash a fallback glyph before the
 * asset loads. Emoji were the alternative, and they render differently on every
 * platform — the same character can be a different picture on Android, iOS and
 * Windows, which is not something an interface should leave to chance.
 */

export type IconName =
  | 'check' | 'alert' | 'arrow-left' | 'arrow-right' | 'chevron-right'
  | 'volume-on' | 'volume-off' | 'menu' | 'close' | 'logout' | 'search'
  | 'download' | 'upload' | 'plus' | 'trash' | 'key' | 'shield' | 'map'
  | 'users' | 'calendar' | 'message' | 'clipboard' | 'chart' | 'board'
  | 'user' | 'settings' | 'sliders' | 'clock' | 'help'

const PATHS: Record<IconName, string> = {
  'check': 'M20 6 9 17l-5-5',
  'alert': 'M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  'arrow-left': 'M19 12H5m7 7-7-7 7-7',
  'arrow-right': 'M5 12h14m-7-7 7 7-7 7',
  'chevron-right': 'm9 18 6-6-6-6',
  'volume-on': 'M11 5 6 9H2v6h4l5 4V5zm4.5 3.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14',
  'volume-off': 'M11 5 6 9H2v6h4l5 4V5zm11 4-6 6m0-6 6 6',
  'menu': 'M3 12h18M3 6h18M3 18h18',
  'close': 'M18 6 6 18M6 6l12 12',
  'logout': 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9',
  'search': 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.35-4.35',
  'download': 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  'upload': 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  'plus': 'M12 5v14M5 12h14',
  'trash': 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
  'key': 'M15 7a2 2 0 0 1 2 2m4 0a6 6 0 0 1-7.74 5.74L11 17H9v2H7v2H4a1 1 0 0 1-1-1v-2.59a1 1 0 0 1 .29-.7l5.96-5.97A6 6 0 1 1 21 9z',
  'shield': 'M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-4z',
  'map': 'M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M12 16v4',
  'users': 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  'calendar': 'M3 4h18v18H3V4zm13-2v4M8 2v4M3 10h18',
  'message': 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z',
  'clipboard': 'M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z',
  'chart': 'M3 13h2l2 6 4-14 3 9 2-4h3',
  'board': 'M3 3h5v18H3V3zm7 0h5v12h-5V3zm7 0h5v15h-5V3z',
  'user': 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 6c-4.4 0-8 3.6-8 8h16c0-4.4-3.6-8-8-8z',
  'settings': 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.1l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-1.9-1.1L14.6 2h-4l-.4 2.8c-.7.3-1.3.6-1.9 1.1l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.2l-2 1.6 2 3.4 2.4-1c.6.5 1.2.8 1.9 1.1l.4 2.8h4l.4-2.8c.7-.3 1.3-.6 1.9-1.1l2.4 1 2-3.4-2-1.6c.1-.4.1-.7.1-1.1z',
  'sliders': 'M4 21v-7M4 10V3m8 18v-9m0-3V3m8 18v-5m0-4V3M1 14h6m2-5h6m2 7h6',
  'clock': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-16v6l4 2',
  'help': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 1 1 4.2 2.8c-.8.4-1.3 1-1.3 1.9v.3M12 17h.01',
}

interface Props {
  name: IconName
  /** Multiplier on the current font size, so an icon scales with its label. */
  size?: number
  className?: string
  /** Supply when the icon is the only content of a control. */
  label?: string
}

export default function Icon({ name, size = 1, className, label }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={`${size}em`}
      height={`${size}em`}
      className={className}
      // Decorative unless it carries the control's whole meaning; otherwise a
      // screen reader announces the label twice.
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
