'use client'

import type { ViewProps } from './types'
import EmptyState from '@/components/ui/EmptyState'

export default function TaskChecklistView({ todos, isClosed, onSelectTodo, onToggleDone }: ViewProps) {
  const open = todos.filter(t => !isClosed(t.status))
  const closed = todos.filter(t => isClosed(t.status))
  const sorted = [...open, ...closed]

  if (sorted.length === 0) {
    return <EmptyState variant="no-tasks" />
  }

  return (
    <div className="tv-list-card" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="tv-table tv-table--checklist">
        <thead><tr><th style={{ width: '36px' }} /><th>Task</th></tr></thead>
        <tbody>
          {sorted.map(todo => {
            const isDone = isClosed(todo.status)
            return (
              <tr key={todo.id} onClick={() => onSelectTodo(todo)}>
                <td style={{ width: '36px', textAlign: 'center' }}>
                  <button className="tv-cl-check" onClick={e => { e.stopPropagation(); onToggleDone(e, todo) }}
                    aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
                    style={{ border: `2px solid ${isDone ? 'var(--pill-active-color)' : 'var(--muted)'}`, background: isDone ? 'var(--pill-active-color)' : 'transparent' }}>
                    {isDone && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="var(--bg2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </button>
                </td>
                <td><span style={{ color: isDone ? 'var(--muted)' : 'var(--text)', cursor: 'pointer' }}>{todo.title}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
