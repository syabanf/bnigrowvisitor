import Icon, { type IconName } from './Icon'

export interface SummaryCard {
  key: string
  label: string
  value: number
  icon?: IconName
  /** pill--good, pill--warn, pill--danger … applied to the figure. */
  tone?: string
  hint?: string
  /**
   * Whether this card filters the list. Default true when onSelect is given.
   *
   * Per card rather than per group: a set can mix figures that filter with
   * figures that only count — a renewal bucket has no filter behind it — and
   * rendering the second kind as a button that quietly does nothing is worse
   * than rendering it plainly.
   */
  selectable?: boolean
}

interface Props {
  cards: SummaryCard[]
  /** The card currently filtering the list, by key. */
  active?: string
  /** Given, the cards become filter controls. */
  onSelect?: (key: string) => void
}

/**
 * The figures above a list.
 *
 * Every number here is counted by the server over the whole filtered set, not
 * over the rows on screen. Counting the page in the browser is the mistake that
 * made the audit screen report "3 gagal" out of three hundred — and it hides
 * itself, because with fewer rows than a page the two agree.
 *
 * When onSelect is given the cards are buttons, not decorated divs: they are
 * doing what a filter does, so they should be reachable by keyboard and
 * announce their pressed state.
 */
export default function SummaryCards({ cards, active, onSelect }: Props) {
  return (
    <div className="summary">
      {cards.map(card => {
        const selected = active === card.key
        const content = (
          <>
            <span className="summary__label">
              {card.icon && <Icon name={card.icon} size={0.85} />}
              {card.label}
            </span>
            <span className={`summary__value ${card.tone ?? ''}`}>
              {card.value.toLocaleString('id-ID')}
            </span>
            {card.hint && <span className="summary__hint">{card.hint}</span>}
          </>
        )

        if (!onSelect || card.selectable === false) {
          return <div className="summary__card" key={card.key}>{content}</div>
        }
        return (
          <button
            type="button"
            key={card.key}
            className={`summary__card summary__card--action${selected ? ' summary__card--on' : ''}`}
            aria-pressed={selected}
            // Pressing the active card clears the filter, so the control that
            // applied it is the one that removes it.
            onClick={() => onSelect(selected ? '' : card.key)}
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}
