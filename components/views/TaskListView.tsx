'use client'

import type { ViewProps, ViewTodo } from './types'
import { parseLocalDatetime } from './types'

function ActionButtons({
  todo, isClosed, statusColor, onSelectTodo, onToggleDone,
}: {
  todo: ViewTodo
  isClosed: (s: string) => boolean
  statusColor: (s: string) => string
  onSelectTodo: (t: ViewTodo) => void
  onToggleDone: (e: React.MouseEvent, t: ViewTodo) => void
}) {
  const isDone = isClosed(todo.status)
  return (
    <div className="tv-row-actions">
      {!isDone && (
        <button className="tv-action-btn" onClick={e => { e.stopPropagation(); onSelectTodo(todo) }} aria-label="Edit task" title="Edit task">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
          </svg>
          Edit
        </button>
      )}
      <button className="tv-action-btn" onClick={e => onToggleDone(e, todo)} aria-label={isDone ? 'Reopen' : 'Done'} title={isDone ? 'Reopen task' : 'Mark as done'}>
        <span className="tv-done-toggle" style={{ border: `2px solid ${isDone ? statusColor(todo.status) : 'var(--muted)'}`, background: isDone ? statusColor(todo.status) : 'transparent' }}>
          {isDone && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="var(--bg2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </span>
        {isDone ? 'Reopen' : 'Done'}
      </button>
    </div>
  )
}

export default function TaskListView({
  todos, isClosed, statusColor, productCodeMap,
  onSelectTodo, onToggleDone, selectedTodo, selectedIds,
  onToggleId, onToggleAll, hoveredId, onHover,
}: ViewProps) {
  if (todos.length === 0) {
    return <p className="text-sm text-muted" style={{ textAlign: 'center', padding: 'var(--sp-3xl) 0' }}>No todos found.</p>
  }

  return (
    <div className="tv-list-card" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="tv-table">
        <thead>
          <tr>
            <th style={{ width: '36px', textAlign: 'center' }}>
              <input type="checkbox" checked={todos.length > 0 && todos.every(t => selectedIds.includes(t.id))} onChange={onToggleAll} style={{ cursor: 'pointer' }} />
            </th>
            <th>Title</th>
            <th className="tv-th-actions" style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {todos.map(todo => {
            const isChecked = selectedIds.includes(todo.id)
            const isDone = isClosed(todo.status)
            const todoRef = productCodeMap.get(todo.product_id) && todo.todo_number != null
              ? `${productCodeMap.get(todo.product_id)}-${todo.todo_number}` : null

            return (
              <tr key={todo.id} onClick={() => onSelectTodo(todo)}
                onMouseEnter={() => onHover(todo.id)} onMouseLeave={() => onHover(null)}
                tabIndex={0} aria-label={`${todo.title}, ${todo.status}`}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelectTodo(todo) }}
                style={{ background: isChecked || selectedTodo?.id === todo.id ? 'var(--pill-active-bg)' : hoveredId === todo.id ? 'var(--bg3)' : 'transparent' }}>
                <td style={{ textAlign: 'center', width: '36px' }}>
                  <input type="checkbox" checked={isChecked} onChange={() => onToggleId(todo.id)} onClick={e => e.stopPropagation()} style={{ cursor: 'pointer' }} />
                </td>
                <td className="tv-td-content">
                  <div className="tv-td-content-row">
                    <div className="tv-td-content-inner">
                      <p className="tv-todo-title" style={{ fontSize: 'var(--fs-base)', color: isDone ? 'var(--muted)' : 'var(--text)', margin: 0 }}>
                        {todo.title}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                        {todoRef && <span className="text-xs text-muted">{todoRef}</span>}
                        {todo.due_at && (() => {
                          const isOverdue = !isDone && parseLocalDatetime(todo.due_at) < new Date()
                          const isDueToday = !isDone && parseLocalDatetime(todo.due_at).toDateString() === new Date().toDateString()
                          return (
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: 'var(--fs-version)', padding: '1px 6px', borderRadius: '4px',
                              background: isOverdue ? 'rgba(239,68,68,0.1)' : isDueToday ? 'rgba(245,158,11,0.1)' : 'rgba(100,116,139,0.1)',
                              color: isOverdue ? 'var(--error)' : isDueToday ? '#d97706' : 'var(--muted)',
                              border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.2)' : isDueToday ? 'rgba(245,158,11,0.2)' : 'rgba(100,116,139,0.15)'}`,
                              whiteSpace: 'nowrap',
                            }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                              </svg>
                              <span>
                                {parseLocalDatetime(todo.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                {' at '}
                                {parseLocalDatetime(todo.due_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                              </span>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                    <div className="tv-mobile-actions">
                      <ActionButtons todo={todo} isClosed={isClosed} statusColor={statusColor} onSelectTodo={onSelectTodo} onToggleDone={onToggleDone} />
                    </div>
                  </div>
                </td>
                <td className="tv-td-actions" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <ActionButtons todo={todo} isClosed={isClosed} statusColor={statusColor} onSelectTodo={onSelectTodo} onToggleDone={onToggleDone} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
