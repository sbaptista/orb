-- ============================================================
-- TODOS RLS Policies
-- Updated: 2026-05-09 (added roles + project ownership)
-- ============================================================

-- Users: Admins can see/update all; owners see only themselves
create policy "users: select own" on users
  for select using (
    auth.uid() = id
    or exists (select 1 from users where users.id = auth.uid() and users.role_id IN (0, 1))
  );

create policy "users: insert own" on users
  for insert with check (auth.uid() = id);

create policy "users: update own" on users
  for update using (
    auth.uid() = id
    or exists (select 1 from users where users.id = auth.uid() and users.role_id IN (0, 1))
  );

-- Projects: Admins see all; owners see only their own
create policy "projects: select own or admin" on projects
  for select using (
    created_by = (select auth.uid())
    or (select is_admin())
  );

create policy "projects: insert own" on projects
  for insert with check ((select auth.uid()) is not null);

create policy "projects: update own or admin" on projects
  for update using (
    created_by = (select auth.uid())
    or (select is_admin())
  );

create policy "projects: delete own or admin" on projects
  for delete using (
    created_by = (select auth.uid())
    or (select is_admin())
  );

-- Todos: scoped through project ownership or admin role
create policy "todos: select own or admin" on todos
  for select using (
    exists (
      select 1 from projects
      where projects.id = todos.product_id
        and projects.created_by = (select auth.uid())
    )
    or (select is_admin())
  );

create policy "todos: insert own or admin" on todos
  for insert with check (
    exists (
      select 1 from projects
      where projects.id = todos.product_id
        and projects.created_by = (select auth.uid())
    )
    or (select is_admin())
  );

create policy "todos: update own or admin" on todos
  for update using (
    exists (
      select 1 from projects
      where projects.id = todos.product_id
        and projects.created_by = (select auth.uid())
    )
    or (select is_admin())
  );

create policy "todos: delete own or admin" on todos
  for delete using (
    exists (
      select 1 from projects
      where projects.id = todos.product_id
        and projects.created_by = (select auth.uid())
    )
    or (select is_admin())
  );

-- Groups: scoped through project ownership
create policy "groups: select own" on groups
  for select using (
    exists (
      select 1 from projects
      where projects.id = groups.product_id
      and (
        projects.created_by = auth.uid()
        or exists (select 1 from users where users.id = auth.uid() and users.role_id IN (0, 1))
      )
    )
  );

create policy "groups: insert own" on groups
  for insert with check (
    exists (
      select 1 from projects
      where projects.id = groups.product_id
      and (
        projects.created_by = auth.uid()
        or exists (select 1 from users where users.id = auth.uid() and users.role_id IN (0, 1))
      )
    )
  );

create policy "groups: update own" on groups
  for update using (
    exists (
      select 1 from projects
      where projects.id = groups.product_id
      and (
        projects.created_by = auth.uid()
        or exists (select 1 from users where users.id = auth.uid() and users.role_id IN (0, 1))
      )
    )
  );

create policy "groups: delete own" on groups
  for delete using (
    exists (
      select 1 from projects
      where projects.id = groups.product_id
      and (
        projects.created_by = auth.uid()
        or exists (select 1 from users where users.id = auth.uid() and users.role_id IN (0, 1))
      )
    )
  );

-- Categories: scoped through project ownership
create policy "categories: select own" on categories
  for select using (
    exists (
      select 1 from projects
      where projects.id = categories.product_id
      and (
        projects.created_by = auth.uid()
        or exists (select 1 from users where users.id = auth.uid() and users.role_id IN (0, 1))
      )
    )
  );

create policy "categories: insert own" on categories
  for insert with check (
    exists (
      select 1 from projects
      where projects.id = categories.product_id
      and (
        projects.created_by = auth.uid()
        or exists (select 1 from users where users.id = auth.uid() and users.role_id IN (0, 1))
      )
    )
  );

create policy "categories: update own" on categories
  for update using (
    exists (
      select 1 from projects
      where projects.id = categories.product_id
      and (
        projects.created_by = auth.uid()
        or exists (select 1 from users where users.id = auth.uid() and users.role_id IN (0, 1))
      )
    )
  );

create policy "categories: delete own" on categories
  for delete using (
    exists (
      select 1 from projects
      where projects.id = categories.product_id
      and (
        projects.created_by = auth.uid()
        or exists (select 1 from users where users.id = auth.uid() and users.role_id IN (0, 1))
      )
    )
  );

-- Platforms: scoped through project ownership
create policy "platforms: select own" on platforms
  for select using (
    exists (
      select 1 from projects
      where projects.id = platforms.product_id
      and (
        projects.created_by = auth.uid()
        or exists (select 1 from users where users.id = auth.uid() and users.role_id IN (0, 1))
      )
    )
  );

create policy "platforms: insert own" on platforms
  for insert with check (
    exists (
      select 1 from projects
      where projects.id = platforms.product_id
      and (
        projects.created_by = auth.uid()
        or exists (select 1 from users where users.id = auth.uid() and users.role_id IN (0, 1))
      )
    )
  );

create policy "platforms: update own" on platforms
  for update using (
    exists (
      select 1 from projects
      where projects.id = platforms.product_id
      and (
        projects.created_by = auth.uid()
        or exists (select 1 from users where users.id = auth.uid() and users.role_id IN (0, 1))
      )
    )
  );

create policy "platforms: delete own" on platforms
  for delete using (
    exists (
      select 1 from projects
      where projects.id = platforms.product_id
      and (
        projects.created_by = auth.uid()
        or exists (select 1 from users where users.id = auth.uid() and users.role_id IN (0, 1))
      )
    )
  );

-- priorities: readable by all authenticated users (system data)
create policy "priorities: select authenticated" on priorities
  for select using (
    exists (select 1 from users where users.id = auth.uid())
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
