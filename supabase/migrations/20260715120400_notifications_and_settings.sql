-- Migration: Notifications, Settings, and Utilities
-- Description: Creates tables for user notifications, application settings, feature flags, webhooks, and activity feeds.

-- 1. Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- Indexes for notifications
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read);
CREATE INDEX idx_notifications_user_created ON public.notifications (user_id, created_at DESC);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- Policies for notifications
CREATE POLICY "Notifications: view own or admin" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (SELECT public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Notifications: update own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Notifications: delete own" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- 2. Create settings table (User/Workspace-specific settings)
CREATE TABLE public.settings (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

-- Enable RLS on settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;

-- Policies for settings
CREATE POLICY "Settings: view own or admin" ON public.settings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (SELECT public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Settings: insert own" ON public.settings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Settings: update own" ON public.settings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Settings: delete own" ON public.settings
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Trigger for settings updated_at
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3. Create feature_flags table (Global flags for feature rollouts)
CREATE TABLE public.feature_flags (
  key TEXT NOT NULL PRIMARY KEY,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  rules JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on feature_flags
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;

-- Policies for feature_flags
CREATE POLICY "Feature Flags: select authenticated" ON public.feature_flags
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Feature Flags: admin manage" ON public.feature_flags
  FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

-- Trigger for feature_flags updated_at
CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 4. Create webhooks table (For outgoing event subscriptions)
CREATE TABLE public.webhooks (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for webhooks
CREATE INDEX idx_webhooks_user ON public.webhooks (user_id);

-- Enable RLS on webhooks
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhooks TO authenticated;
GRANT ALL ON public.webhooks TO service_role;

-- Policies for webhooks
CREATE POLICY "Webhooks: view own or admin" ON public.webhooks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (SELECT public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Webhooks: insert own" ON public.webhooks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Webhooks: update own" ON public.webhooks
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Webhooks: delete own" ON public.webhooks
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Trigger for webhooks updated_at
CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON public.webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 5. Create activity_feed table (Dynamic UI updates)
CREATE TABLE public.activity_feed (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for activity_feed
CREATE INDEX idx_activity_feed_user_time ON public.activity_feed (user_id, created_at DESC);

-- Enable RLS on activity_feed
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_feed TO authenticated;
GRANT ALL ON public.activity_feed TO service_role;

-- Policies for activity_feed
CREATE POLICY "Activity Feed: view own or admin" ON public.activity_feed
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (SELECT public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Activity Feed: insert own" ON public.activity_feed
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
