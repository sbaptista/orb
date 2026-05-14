-- ============================================================
-- Strip admin bypass from ALL RLS policies (SELECT + mutations)
-- 2026-05-13
-- ============================================================
-- All cross-user access is handled by server actions using
-- createAdminClient() (service role key, bypasses RLS).
-- Client-side queries only return the authenticated user's
-- own data — no role-based exceptions.
-- ============================================================

-- ── Users ──

DROP POLICY IF EXISTS "users: select own" ON public.users;
CREATE POLICY "users: select own" ON public.users
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "users: update own" ON public.users;
CREATE POLICY "users: update own" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- ── Projects ──

DROP POLICY IF EXISTS "projects: select own" ON public.projects;
CREATE POLICY "projects: select own" ON public.projects
    FOR SELECT USING (created_by = auth.uid());

DROP POLICY IF EXISTS "projects: insert own" ON public.projects;
CREATE POLICY "projects: insert own" ON public.projects
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "projects: update own" ON public.projects;
CREATE POLICY "projects: update own" ON public.projects
    FOR UPDATE USING (created_by = auth.uid());

DROP POLICY IF EXISTS "projects: delete own" ON public.projects;
CREATE POLICY "projects: delete own" ON public.projects
    FOR DELETE USING (created_by = auth.uid());

-- ── Todos ──

DROP POLICY IF EXISTS "todos: select own" ON public.todos;
CREATE POLICY "todos: select own" ON public.todos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = todos.product_id
            AND projects.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "todos: insert own" ON public.todos;
CREATE POLICY "todos: insert own" ON public.todos
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = todos.product_id
            AND projects.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "todos: update own" ON public.todos;
CREATE POLICY "todos: update own" ON public.todos
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = todos.product_id
            AND projects.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "todos: delete own" ON public.todos;
CREATE POLICY "todos: delete own" ON public.todos
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = todos.product_id
            AND projects.created_by = auth.uid()
        )
    );

-- ── Groups ──

DROP POLICY IF EXISTS "groups: select own" ON public.groups;
CREATE POLICY "groups: select own" ON public.groups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = groups.product_id
            AND projects.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "groups: insert own" ON public.groups;
CREATE POLICY "groups: insert own" ON public.groups
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = groups.product_id
            AND projects.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "groups: update own" ON public.groups;
CREATE POLICY "groups: update own" ON public.groups
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = groups.product_id
            AND projects.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "groups: delete own" ON public.groups;
CREATE POLICY "groups: delete own" ON public.groups
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = groups.product_id
            AND projects.created_by = auth.uid()
        )
    );

-- ── Categories ──

DROP POLICY IF EXISTS "categories: select own" ON public.categories;
CREATE POLICY "categories: select own" ON public.categories
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = categories.product_id
            AND projects.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "categories: insert own" ON public.categories;
CREATE POLICY "categories: insert own" ON public.categories
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = categories.product_id
            AND projects.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "categories: update own" ON public.categories;
CREATE POLICY "categories: update own" ON public.categories
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = categories.product_id
            AND projects.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "categories: delete own" ON public.categories;
CREATE POLICY "categories: delete own" ON public.categories
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = categories.product_id
            AND projects.created_by = auth.uid()
        )
    );

-- ── Platforms ──

DROP POLICY IF EXISTS "platforms: select own" ON public.platforms;
CREATE POLICY "platforms: select own" ON public.platforms
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = platforms.product_id
            AND projects.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "platforms: insert own" ON public.platforms;
CREATE POLICY "platforms: insert own" ON public.platforms
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = platforms.product_id
            AND projects.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "platforms: update own" ON public.platforms;
CREATE POLICY "platforms: update own" ON public.platforms
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = platforms.product_id
            AND projects.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "platforms: delete own" ON public.platforms;
CREATE POLICY "platforms: delete own" ON public.platforms
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = platforms.product_id
            AND projects.created_by = auth.uid()
        )
    );
