# Session Log — 2026-04-01 15:11

## Task
Add product `code` and per-product `todo_number` to the Todos app, surfacing a human-readable reference (e.g. "HELM-3") in the todo list and panel.

## Database changes (manual, via Supabase)

```sql
-- products table
ALTER TABLE products ADD COLUMN code varchar(10) UNIQUE;
UPDATE products SET code = UPPER(LEFT(name, 4));

-- todos table
ALTER TABLE todos ADD COLUMN todo_number integer;

CREATE OR REPLACE FUNCTION assign_todo_number()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(todo_number), 0) + 1
  INTO NEW.todo_number
  FROM todos
  WHERE product_id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_todo_number
BEFORE INSERT ON todos
FOR EACH ROW EXECUTE FUNCTION assign_todo_number();

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY created_at) AS rn
  FROM todos
)
UPDATE todos SET todo_number = numbered.rn
FROM numbered WHERE todos.id = numbered.id;
```

## Code changes

### `components/TodoView.tsx`
- Added `todo_number: number | null` to `Todo` type
- Added `code: string | null` to `Product` type
- Updated products fetch: `select('id, name, color, icon, code')`
- Added `productCodeMap` useMemo (Map<product_id, code>)
- Updated todo row meta line to prepend reference ("HELM-3") before group · category

### `components/DashboardProducts.tsx`
- Added `code: string | null` to local `Product` type
- Added `code: string` to `ProductForm` type and `EMPTY_FORM`
- `InlineProductForm`: added Code text input (max 10 chars, auto-uppercased); auto-populates from first 4 chars of name while user hasn't manually edited the field (tracked via `codeAutoSync` local state)
- `startEdit`: populates `code` from product
- `handleSave` / `handleAdd`: include `code` in Supabase upsert
- Product card: shows `p.code` in small muted monospace text below the product name

### `components/TodoPanel.tsx`
- Replaced "Task ID" (UUID) field with "ID" field showing human-readable reference (`${code}-${todo_number}`), falling back to UUID if data is unavailable

## Verification
- `npx tsc --noEmit` — no errors
