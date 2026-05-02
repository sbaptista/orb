-- ============================================================
-- TODOS RLS Policies
-- Generated: March 30, 2026
-- Run in Supabase SQL Editor after auth is wired up
-- ============================================================

-- users: each user can only see and edit their own row
create policy "users: select own" on users
  for select using (auth.uid() = id);

create policy "users: insert own" on users
  for insert with check (auth.uid() = id);

create policy "users: update own" on users
  for update using (auth.uid() = id);

-- products: owner sees all their products
create policy "projects: select own" on projects
  for select using (
    exists (select 1 from users where users.id = auth.uid())
  );

create policy "projects: insert own" on projects
  for insert with check (
    exists (select 1 from users where users.id = auth.uid())
  );

create policy "projects: update own" on projects
  for update using (
    exists (select 1 from users where users.id = auth.uid())
  );

create policy "projects: delete own" on projects
  for delete using (
    exists (select 1 from users where users.id = auth.uid())
  );

-- groups
create policy "groups: select own" on groups
  for select using (
    exists (select 1 from users where users.id = auth.uid())
  );

create policy "groups: insert own" on groups
  for insert with check (
    exists (select 1 from users where users.id = auth.uid())
  );

create policy "groups: update own" on groups
  for update using (
    exists (select 1 from users where users.id = auth.uid())
  );

create policy "groups: delete own" on groups
  for delete using (
    exists (select 1 from users where users.id = auth.uid())
  );

-- categories
create policy "categories: select own" on categories
  for select using (
    exists (select 1 from users where users.id = auth.uid())
  );

create policy "categories: insert own" on categories
  for insert with check (
    exists (select 1 from users where users.id = auth.uid())
  );

create policy "categories: update own" on categories
  for update using (
    exists (select 1 from users where users.id = auth.uid())
  );

create policy "categories: delete own" on categories
  for delete using (
    exists (select 1 from users where users.id = auth.uid())
  );

-- platforms
create policy "platforms: select own" on platforms
  for select using (
    exists (select 1 from users where users.id = auth.uid())
  );

create policy "platforms: insert own" on platforms
  for insert with check (
    exists (select 1 from users where users.id = auth.uid())
  );

create policy "platforms: update own" on platforms
  for update using (
    exists (select 1 from users where users.id = auth.uid())
  );

create policy "platforms: delete own" on platforms
  for delete using (
    exists (select 1 from users where users.id = auth.uid())
  );

-- priorities: readable by all authenticated users (system data)
create policy "priorities: select authenticated" on priorities
  for select using (
    exists (select 1 from users where users.id = auth.uid())
  );

-- todos
create policy "todos: select own" on todos
  for select using (
    exists (
      select 1 from projects
      where products.id = todos.product_id
      and exists (select 1 from users where users.id = auth.uid())
    )
  );

create policy "todos: insert own" on todos
  for insert with check (
    exists (
      select 1 from projects
      where products.id = todos.product_id
      and exists (select 1 from users where users.id = auth.uid())
    )
  );

create policy "todos: update own" on todos
  for update using (
    exists (
      select 1 from projects
      where products.id = todos.product_id
      and exists (select 1 from users where users.id = auth.uid())
    )
  );

create policy "todos: delete own" on todos
  for delete using (
    exists (
      select 1 from projects
      where products.id = todos.product_id
      and exists (select 1 from users where users.id = auth.uid())
    )
  );

-- todo_platforms
create policy "todo_platforms: select own" on todo_platforms
  for select using (
    exists (
      select 1 from todos
      where todos.id = todo_platforms.todo_id
      and exists (select 1 from users where users.id = auth.uid())
    )
  );

create policy "todo_platforms: insert own" on todo_platforms
  for insert with check (
    exists (
      select 1 from todos
      where todos.id = todo_platforms.todo_id
      and exists (select 1 from users where users.id = auth.uid())
    )
  );

create policy "todo_platforms: delete own" on todo_platforms
  for delete using (
    exists (
      select 1 from todos
      where todos.id = todo_platforms.todo_id
      and exists (select 1 from users where users.id = auth.uid())
    )
  );

-- audit_log: readable by authenticated users, insert only (no update/delete)
create policy "audit_log: select own" on audit_log
  for select using (
    exists (select 1 from users where users.id = auth.uid())
  );

create policy "audit_log: insert own" on audit_log
  for insert with check (
    exists (select 1 from users where users.id = auth.uid())
  );
