-- ============================================================
-- TODOS-35: Data Lifecycle Migration
-- Description: Creates the Knowledge Repository and updates Todos for Archival.
-- ============================================================

-- 1. Knowledge Repository Table
CREATE TABLE IF NOT EXISTS public.knowledge_repo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    origin_todo_id UUID REFERENCES public.todos(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add archived_at to Todos
ALTER TABLE public.todos 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 3. RLS Policies for Knowledge Repo
ALTER TABLE public.knowledge_repo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_repo: select own" ON public.knowledge_repo
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = knowledge_repo.product_id
            AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid())
        )
    );

CREATE POLICY "knowledge_repo: insert own" ON public.knowledge_repo
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = knowledge_repo.product_id
            AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid())
        )
    );

CREATE POLICY "knowledge_repo: update own" ON public.knowledge_repo
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = knowledge_repo.product_id
            AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid())
        )
    );

CREATE POLICY "knowledge_repo: delete own" ON public.knowledge_repo
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = knowledge_repo.product_id
            AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid())
        )
    );

-- 4. Indices for performance
CREATE INDEX IF NOT EXISTS idx_knowledge_repo_product_id ON public.knowledge_repo(product_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_repo_tags ON public.knowledge_repo USING gin(tags);
