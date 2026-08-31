import type { ReactNode } from 'react'

interface Props {
  title: string
  /** A row count or similar, shown as a chip beside the title. */
  count?: string
  /** One line explaining the screen. Omitted where the title says enough. */
  subtitle?: ReactNode
  /** Actions for the whole page, kept on the same line as the title. */
  actions?: ReactNode
}

/**
 * The heading block every screen starts with.
 *
 * Nineteen pages had grown three different headers between them — some a bare
 * h1, some a title with a count chip, some a title followed by a stray sentence
 * that sat between the filters and the table it described. One component means
 * the title, the count and the actions land in the same place on every screen,
 * which is most of what makes an app feel like one app.
 */
export default function PageHeader({ title, count, subtitle, actions }: Props) {
  return (
    <header className="pagehead">
      <div className="pagehead__main">
        <div className="page-title">
          <h1>{title}</h1>
          {count && <span className="count-chip">{count}</span>}
        </div>
        {subtitle && <p className="pagehead__sub">{subtitle}</p>}
      </div>
      {actions && <div className="pagehead__actions">{actions}</div>}
    </header>
  )
}
