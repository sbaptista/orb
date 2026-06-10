import React from 'react'

interface FormFieldProps {
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: React.ReactNode
  htmlFor?: string
}

export function FormField({ label, error, hint, required, children, htmlFor }: FormFieldProps) {
  return (
    <div className="flex-col" style={{ gap: '6px' }}>
      <label
        htmlFor={htmlFor}
        className="label flex-center"
        style={{ gap: '4px', marginBottom: 0 }}
      >
        {label}
        {required && (
          <span className="text-error text-xs" aria-hidden="true">*</span>
        )}
      </label>

      <div style={{ ['--field-error' as string]: error ? '1' : '0' }}>
        {children}
      </div>

      {error && (
        <p role="alert" className="text-sm text-error" style={{ margin: 0, lineHeight: 'var(--lh-snug)' }}>
          {error}
        </p>
      )}

      {hint && !error && (
        <p className="text-sm text-muted" style={{ margin: 0, lineHeight: 'var(--lh-snug)' }}>
          {hint}
        </p>
      )}
    </div>
  )
}

export function inputStyle(hasError = false): React.CSSProperties {
  return {
    width: '100%',
    fontSize: 'var(--fs-input)',
    fontFamily: 'var(--font-ui)',
    color: 'var(--text)',
    background: 'var(--bg)',
    border: `${hasError ? '3px' : '1px'} solid ${hasError ? 'var(--error)' : 'var(--border)'}`,
    borderRadius: 'var(--r)',
    padding: '10px var(--sp-md)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color var(--transition), border-width var(--transition)',
    minHeight: '44px',
  }
}

export function inputFocusStyle(hasError = false): React.CSSProperties {
  return {
    ...inputStyle(hasError),
    borderColor: hasError ? 'var(--error)' : 'var(--border-focus)',
    boxShadow: hasError ? '0 0 0 3px rgba(139,32,32,0.1)' : undefined,
  }
}

export function selectStyle(hasError = false): React.CSSProperties {
  return {
    ...inputStyle(hasError),
    padding: '6px var(--sp-sm)',
    cursor: 'pointer',
    minHeight: 'auto',
  }
}
