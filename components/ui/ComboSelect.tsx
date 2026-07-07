'use client'

import { useEffect, useState } from 'react'

type ComboOption = { id: string; name: string }

type Props = {
  options: ComboOption[]
  value: string | null
  onChange: (id: string) => void
  id?: string
  placeholder?: string
  emptyMessage?: string
  required?: boolean
}

/** Searchable single-select for small-to-medium named lists (e.g. per-project categories). */
export default function ComboSelect({ options, value, onChange, id, placeholder = 'Search…', emptyMessage = 'No options available.', required }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find(o => o.id === value) ?? null

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const filtered = query.trim()
    ? options.filter(o => o.name.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  function select(opt: ComboOption) {
    onChange(opt.id)
    setOpen(false)
  }

  return (
    <div className="pf-combo">
      <input
        id={id}
        type="text"
        className="pf-input"
        value={open ? query : (selected?.name ?? '')}
        placeholder={selected ? selected.name : placeholder}
        onFocus={() => setOpen(true)}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onKeyDown={e => {
          if (e.key === 'Escape' && open) { e.stopPropagation(); e.preventDefault(); setOpen(false) }
          else if (e.key === 'Enter' && open && filtered.length > 0) { e.preventDefault(); select(filtered[0]) }
        }}
        role="combobox"
        aria-expanded={open}
        aria-required={required}
        autoComplete="off"
      />
      {open && (
        <>
          <div className="pf-combo-backdrop" onClick={() => setOpen(false)} />
          <div className="pf-combo-menu" role="listbox">
            {filtered.length === 0 ? (
              <div className="pf-combo-empty">{options.length === 0 ? emptyMessage : 'No matches.'}</div>
            ) : (
              filtered.map(opt => (
                <button
                  type="button"
                  key={opt.id}
                  role="option"
                  aria-selected={opt.id === value}
                  className="pf-combo-item"
                  onClick={() => select(opt)}
                >
                  {opt.name}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
