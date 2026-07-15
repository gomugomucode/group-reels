-- Migration: Sync System (Jobs and Logs)
-- Description: Creates the tables needed to manage, log, and monitor synchronization background jobs.

-- 1. Create sync_jobs table
CREATE TABLE public.sync_jobs (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_summary TEXT
);

-- Indexes for sync_jobs
CREATE INDEX idx_sync_jobs_user_started ON public.sync_jobs (triggered_by, started_at DESC);
CREATE INDEX idx_sync_jobs_status ON public.sync_jobs (status);

-- Enable RLS on sync_jobs
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_jobs TO authenticated;
GRANT ALL ON public.sync_jobs TO service_role;

-- Policies for sync_jobs
CREATE POLICY "Sync Jobs: view own or admin" ON public.sync_jobs
  FOR SELECT TO authenticated
  USING (triggered_by = auth.uid() OR (SELECT public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Sync Jobs: insert authenticated" ON public.sync_jobs
  FOR INSERT TO authenticated
  WITH CHECK (triggered_by = auth.uid());

CREATE POLICY "Sync Jobs: admin update" ON public.sync_jobs
  FOR UPDATE TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Sync Jobs: admin delete" ON public.sync_jobs
  FOR DELETE TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')));


-- 2. Create sync_logs table
CREATE TABLE public.sync_logs (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.sync_jobs(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for sync_logs
CREATE INDEX idx_sync_logs_job ON public.sync_logs (job_id);
CREATE INDEX idx_sync_logs_content ON public.sync_logs (content_id);

-- Enable RLS on sync_logs
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_logs TO authenticated;
GRANT ALL ON public.sync_logs TO service_role;

-- Policies for sync_logs
CREATE POLICY "Sync Logs: view own or admin" ON public.sync_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.sync_jobs j WHERE j.id = job_id AND j.triggered_by = auth.uid()) OR
    (SELECT public.has_role(auth.uid(), 'admin')) OR
    EXISTS (SELECT 1 FROM public.content c WHERE c.id = content_id)
  );

CREATE POLICY "Sync Logs: admin insert" ON public.sync_logs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Sync Logs: admin update" ON public.sync_logs
  FOR UPDATE TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Sync Logs: admin delete" ON public.sync_logs
  FOR DELETE TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')));
