-- ============================================================
-- Fix RLS policies to include superadmin (role_id = 0)
-- 2026-05-10
-- ============================================================
-- role_id 0 = superadmin (by design)
-- role_id 1 = Admin
-- role_id 2 = Owner
-- Admin-level access uses role_id IN (0, 1)
-- User-permission checks use role_id IN (0, 1, 2)
-- ============================================================

-- Users
DROP POLICY IF EXISTS "users: select own" ON public.users;
CREATE POLICY "users: select own" ON public.users
    FOR SELECT USING (
        auth.uid() = id
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
    );

DROP POLICY IF EXISTS "users: update own" ON public.users;
CREATE POLICY "users: update own" ON public.users
    FOR UPDATE USING (
        auth.uid() = id
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
    );

-- Projects
DROP POLICY IF EXISTS "projects: select own" ON public.projects;
CREATE POLICY "projects: select own" ON public.projects
    FOR SELECT USING (
        created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
    );

DROP POLICY IF EXISTS "projects: insert own" ON public.projects;
CREATE POLICY "projects: insert own" ON public.projects
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1, 2))
    );

DROP POLICY IF EXISTS "projects: update own" ON public.projects;
CREATE POLICY "projects: update own" ON public.projects
    FOR UPDATE USING (
        created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
    );

DROP POLICY IF EXISTS "projects: delete own" ON public.projects;
CREATE POLICY "projects: delete own" ON public.projects
    FOR DELETE USING (
        created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
    );

-- Todos
DROP POLICY IF EXISTS "todos: select own" ON public.todos;
CREATE POLICY "todos: select own" ON public.todos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = todos.product_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
            )
        )
    );

DROP POLICY IF EXISTS "todos: insert own" ON public.todos;
CREATE POLICY "todos: insert own" ON public.todos
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = todos.product_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
            )
        )
    );

DROP POLICY IF EXISTS "todos: update own" ON public.todos;
CREATE POLICY "todos: update own" ON public.todos
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = todos.product_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
            )
        )
    );

DROP POLICY IF EXISTS "todos: delete own" ON public.todos;
CREATE POLICY "todos: delete own" ON public.todos
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = todos.product_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
            )
        )
    );

-- Groups
DROP POLICY IF EXISTS "groups: select own" ON public.groups;
CREATE POLICY "groups: select own" ON public.groups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = groups.product_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
            )
        )
    );

DROP POLICY IF EXISTS "groups: insert own" ON public.groups;
CREATE POLICY "groups: insert own" ON public.groups
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = groups.product_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
            )
        )
    );

DROP POLICY IF EXISTS "groups: update own" ON public.groups;
CREATE POLICY "groups: update own" ON public.groups
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = groups.product_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
            )
        )
    );

DROP POLICY IF EXISTS "groups: delete own" ON public.groups;
CREATE POLICY "groups: delete own" ON public.groups
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = groups.product_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
            )
        )
    );

-- Categories
DROP POLICY IF EXISTS "categories: select own" ON public.categories;
CREATE POLICY "categories: select own" ON public.categories
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = categories.product_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
            )
        )
    );

DROP POLICY IF EXISTS "categories: insert own" ON public.categories;
CREATE POLICY "categories: insert own" ON public.categories
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = categories.product_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
            )
        )
    );

DROP POLICY IF EXISTS "categories: update own" ON public.categories;
CREATE POLICY "categories: update own" ON public.categories
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = categories.product_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
            )
        )
    );

DROP POLICY IF EXISTS "categories: delete own" ON public.categories;
CREATE POLICY "categories: delete own" ON public.categories
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = categories.product_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
            )
        )
    );

-- Platforms
DROP POLICY IF EXISTS "platforms: select own" ON public.platforms;
CREATE POLICY "platforms: select own" ON public.platforms
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = platforms.product_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
            )
        )
    );

DROP POLICY IF EXISTS "platforms: insert own" ON public.platforms;
CREATE POLICY "platforms: insert own" ON public.platforms
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = platforms.product_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
            )
        )
    );

DROP POLICY IF EXISTS "platforms: update own" ON public.platforms;
CREATE POLICY "platforms: update own" ON public.platforms
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = platforms.product_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
            )
        )
    );

DROP POLICY IF EXISTS "platforms: delete own" ON public.platforms;
CREATE POLICY "platforms: delete own" ON public.platforms
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = platforms.product_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (0, 1))
            )
        )
    );
