-- Migration: Admin & Auditing Systems
-- Description: Extends profiles to support user suspension, adds security helper functions, and creates audit and system logging tables.

-- 1. Extend profiles table with suspension fields safely
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- 2. Create helper to check if a user is active (not suspended)
CREATE OR REPLACE FUNCTION public.is_active_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND suspended_at IS NULL
  )
$$;

REVOKE ALL ON FUNCTION public.is_active_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user(uuid) TO authenticated;


-- 3. Create audit_logs table for user and admin actions
CREATE TABLE public.audit_logs (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for audit_logs
CREATE INDEX idx_audit_logs_actor ON public.audit_logs (actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs (action, created_at DESC);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

-- Policies for audit_logs (Admins only)
CREATE POLICY "Audit Logs: admin view" ON public.audit_logs
  FOR SELECT TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Audit Logs: admin write" ON public.audit_logs
  FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));


-- 4. Create admin_actions table for direct admin actions
CREATE TABLE public.admin_actions (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for admin_actions
CREATE INDEX idx_admin_actions_admin ON public.admin_actions (admin_id, created_at DESC);
CREATE INDEX idx_admin_actions_target ON public.admin_actions (target_user_id, created_at DESC);

-- Enable RLS on admin_actions
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_actions TO authenticated;
GRANT ALL ON public.admin_actions TO service_role;

-- Policies for admin_actions (Admins only)
CREATE POLICY "Admin Actions: admin view" ON public.admin_actions
  FOR SELECT TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Admin Actions: admin write" ON public.admin_actions
  FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));


-- 5. Create system_logs table for backend debugging
CREATE TABLE public.system_logs (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  message TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for system_logs
CREATE INDEX idx_system_logs_level_time ON public.system_logs (level, created_at DESC);

-- Enable RLS on system_logs
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_logs TO authenticated;
GRANT ALL ON public.system_logs TO service_role;

-- Policies for system_logs (Admins only)
CREATE POLICY "System Logs: admin view" ON public.system_logs
  FOR SELECT TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')));

CREATE POLICY "System Logs: admin write" ON public.system_logs
  FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));
