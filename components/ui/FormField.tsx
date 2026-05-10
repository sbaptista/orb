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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label
        htmlFor={htmlFor}
        style={{
          fontSize: 'var(--fs-xs)',
          fontWeight: 'var(--fw-medium)',
          color: 'var(--text3)',
          display: 'flex',
          gap: '4px',
          alignItems: 'center',
        }}
      >
        {label}
        {required && (
          <span style={{ color: 'var(--error)', fontSize: 'var(--fs-xs)' }} aria-hidden="true">*</span>
        )}
      </label>

      <div style={{ ['--field-error' as string]: error ? '1' : '0' }}>
        {children}
      </div>

      {error && (
        <p role="alert" style={{ fontSize: 'var(--fs-sm)', color: 'var(--error)', margin: 0, lineHeight: 1.4 }}>
          {error}
        </p>
      )}

      {hint && !error && (
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', margin: 0, lineHeight: 1.4 }}>
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
