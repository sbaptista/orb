'use client'

import { useId } from 'react'
import SettingsCrudList from './SettingsCrudList'

type Product = { id: string; name: string }
type Category = { id: string; name: string; product_id: string | null; sort_order: number }
type CatForm = { name: string; product_id: string; sort_order: string }

const EMPTY_FORM: CatForm = { name: '', product_id: '', sort_order: '0' }

export default function SettingsCategories() {
  const nameId = useId()
  const sortOrderId = useId()
  const productId = useId()

  return (
    <SettingsCrudList<Category, CatForm>
      config={{
        title: 'Categories',
        table: 'categories',
        itemLabel: 'Category',
        emptyForm: EMPTY_FORM,
        pageClass: 's-page',

        load: async (supabase) => {
          const [prodRes, catRes, todoRes] = await Promise.all([
            supabase.from('projects').select('id, name').order('sort_order'),
            supabase.from('categories').select('*').order('sort_order'),
            supabase.from('todos').select('category_id'),
          ])
          const counts: Record<string, number> = {}
          todoRes.data?.forEach((t: any) => {
            if (t.category_id) counts[t.category_id] = (counts[t.category_id] || 0) + 1
          })
          return {
            items: catRes.data ?? [],
            extra: { products: prodRes.data ?? [], todoCounts: counts },
          }
        },

        validate: form => !form.name.trim() ? 'Name is required' : null,
        toRecord: form => ({
          name: form.name.trim(),
          product_id: form.product_id || null,
          sort_order: Number(form.sort_order) || 0,
        }),
        toForm: item => ({
          name: item.name,
          product_id: item.product_id ?? '',
          sort_order: String(item.sort_order),
        }),
        getId: item => item.id,

        deleteWarning: (item, extra) => {
          const count = extra.todoCounts?.[item.id] ?? 0
          return (
            <>
              Delete <strong>{item.name}</strong>?
              {count > 0 && (
                <span className="text-muted" style={{ marginLeft: 'var(--sp-xs)' }}>
                  Cannot delete — {count} todo{count !== 1 ? 's' : ''} use this category.
                </span>
              )}
            </>
          )
        },
        canDelete: (item, extra) => (extra.todoCounts?.[item.id] ?? 0) === 0,

        scopeFilter: {
          defaultScope: '',
          defaultLabel: 'Global',
          getScopes: extra => (extra.products ?? []).map((p: Product) => ({ id: p.id, label: p.name })),
          filterItem: (item, scope) => scope === '' ? item.product_id === null : item.product_id === scope,
          applyToForm: (form, scope) => ({ ...form, product_id: scope }),
        },

        renderForm: ({ form, onChange, onSubmit, onCancel, submitLabel, saving, extra }) => (
          <div className="s-form">
            <div className="grid-2col mb-md">
              <div>
                <label htmlFor={nameId} className="label">Name *</label>
                <input
                  id={nameId}
                  className="input"
                  value={form.name}
                  onChange={e => onChange({ ...form, name: e.target.value })}
                  autoFocus
                  placeholder="Category name"
                />
              </div>
              <div>
                <label htmlFor={sortOrderId} className="label">Sort Order</label>
                <input
                  id={sortOrderId}
                  type="number"
                  className="input"
                  value={form.sort_order}
                  onChange={e => onChange({ ...form, sort_order: e.target.value })}
                />
              </div>
            </div>
            <div className="mb-md">
              <label htmlFor={productId} className="label">Product</label>
              <select
                id={productId}
                className="select"
                value={form.product_id}
                onChange={e => onChange({ ...form, product_id: e.target.value })}
              >
                <option value="">Global</option>
                {(extra.products ?? []).map((p: Product) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-row gap-sm">
              <button className="btn-primary" onClick={onSubmit} disabled={saving}>
                {saving ? 'Saving…' : submitLabel}
              </button>
              <button className="btn-cancel" onClick={onCancel}>Cancel</button>
            </div>
          </div>
        ),

        renderRow: ({ item, onEdit, onDelete, extra }) => (
          <div className="s-row">
            <div className="s-row-info">
              <p style={{ margin: 0 }} className="text-sm">{item.name}</p>
              <p style={{ margin: '2px 0 0' }} className="text-xs text-muted">sort: {item.sort_order}</p>
            </div>
            <span className="s-row-meta">
              {extra.todoCounts?.[item.id] ?? 0} todos
            </span>
            <button className="btn-row-action" onClick={onEdit}>Edit</button>
            <button className="btn-row-action btn-row-delete" onClick={onDelete}>Delete</button>
          </div>
        ),
      }}
    />
  )
}
