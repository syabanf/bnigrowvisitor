interface Props<T extends string> {
  value: T
  options: Record<T, string>
  onChange: (next: T) => void
  label: string
  /** Maps a value to a tone class, so the pill carries the state's colour. */
  tone?: (value: T) => string
}

/**
 * An editable status, shown as a pill rather than a form control.
 *
 * A full-width `<select>` in every row made each row 66px tall and drew a box
 * inside a box — on a page of forty-eight members the control was louder than
 * the data. This keeps the same affordance (it is still a real select, still
 * keyboard-operable, still announces its label) while reading as a badge until
 * you go near it.
 */
export default function StatusSelect<T extends string>({
  value, options, onChange, label, tone,
}: Props<T>) {
  return (
    <span className={`status-select ${tone?.(value) ?? ''}`}>
      <select
        value={value}
        aria-label={label}
        onChange={e => onChange(e.target.value as T)}
      >
        {Object.entries(options).map(([v, l]) => (
          <option key={v} value={v}>{l as string}</option>
        ))}
      </select>
    </span>
  )
}
