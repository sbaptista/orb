'use client'

type Props = {
  fieldLabel: string
  onOpen: () => void
}

/** Opens the readable highlighted value for a match inside an editable field. */
export default function SearchMatchIndicator({ fieldLabel, onOpen }: Props) {
  return (
    <button
      type="button"
      className="search-match-indicator"
      onClick={onOpen}
      aria-label={`View search match in ${fieldLabel}`}
      data-tooltip={`View match in ${fieldLabel}`}
    >
      <span aria-hidden="true" />
    </button>
  )
}
