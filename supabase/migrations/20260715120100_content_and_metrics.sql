-- Migration: Content & Metrics Schema
-- Description: Sets up the unified content model (replacing specific video links) and metrics tracking systems.

-- 1. Create content table
CREATE TABLE public.content (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE, -- Backward compatibility
  social_account_id UUID REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  platform_id TEXT NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  title TEXT,
  description TEXT,
  url TEXT NOT NULL,
  external_id TEXT,
  content_type TEXT NOT NULL CHECK (content_type IN ('reel', 'short', 'video', 'post', 'story', 'live', 'other')),
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('valid', 'invalid', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Indexes for content
CREATE INDEX idx_content_user ON public.content (user_id);
CREATE INDEX idx_content_group ON public.content (group_id);
CREATE INDEX idx_content_social_account ON public.content (social_account_id);
CREATE INDEX idx_content_platform ON public.content (platform_id);
CREATE INDEX idx_content_type ON public.content (content_type);
CREATE INDEX idx_content_status ON public.content (status);
CREATE UNIQUE INDEX idx_content_url_active ON public.content (url) WHERE deleted_at IS NULL;

-- Enable RLS on content
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content TO authenticated;
GRANT ALL ON public.content TO service_role;

-- Policies for content
CREATE POLICY "Content: view own, group, or admin" ON public.content
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    (group_id IS NOT NULL AND (SELECT public.is_group_member(group_id))) OR
    (SELECT public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Content: insert own or group member" ON public.content
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    (group_id IS NULL OR (SELECT public.is_group_member(group_id)))
  );

CREATE POLICY "Content: update own, group owner, or admin" ON public.content
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid() OR
    (group_id IS NOT NULL AND (SELECT public.owns_group(group_id))) OR
    (SELECT public.has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    user_id = auth.uid() OR
    (group_id IS NOT NULL AND (SELECT public.owns_group(group_id))) OR
    (SELECT public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Content: delete own, group owner, or admin" ON public.content
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid() OR
    (group_id IS NOT NULL AND (SELECT public.owns_group(group_id))) OR
    (SELECT public.has_role(auth.uid(), 'admin'))
  );

-- Trigger for content updated_at
CREATE TRIGGER update_content_updated_at BEFORE UPDATE ON public.content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. Create content_metrics table (One-to-One with content)
CREATE TABLE public.content_metrics (
  content_id UUID NOT NULL PRIMARY KEY REFERENCES public.content(id) ON DELETE CASCADE,
  views BIGINT NOT NULL DEFAULT 0,
  likes BIGINT NOT NULL DEFAULT 0,
  comments BIGINT NOT NULL DEFAULT 0,
  shares BIGINT NOT NULL DEFAULT 0,
  saves BIGINT NOT NULL DEFAULT 0,
  watch_time_seconds BIGINT NOT NULL DEFAULT 0,
  followers_gained BIGINT NOT NULL DEFAULT 0,
  engagement_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  reach BIGINT NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  last_synced TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_fetched_at TIMESTAMPTZ,
  sync_status TEXT NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('idle', 'pending', 'success', 'error')),
  api_error TEXT
);

-- Enable RLS on content_metrics
ALTER TABLE public.content_metrics ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_metrics TO authenticated;
GRANT ALL ON public.content_metrics TO service_role;

-- Policies for content_metrics
CREATE POLICY "Metrics: view authorized" ON public.content_metrics
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content WHERE id = content_id));

CREATE POLICY "Metrics: admin or owner write" ON public.content_metrics
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.content
      WHERE id = content_id AND (user_id = auth.uid() OR (SELECT public.has_role(auth.uid(), 'admin')))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.content
      WHERE id = content_id AND (user_id = auth.uid() OR (SELECT public.has_role(auth.uid(), 'admin')))
    )
  );


-- 3. Create content_metrics_history table (One-to-Many historical logs)
CREATE TABLE public.content_metrics_history (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  views BIGINT NOT NULL DEFAULT 0,
  likes BIGINT NOT NULL DEFAULT 0,
  comments BIGINT NOT NULL DEFAULT 0,
  shares BIGINT NOT NULL DEFAULT 0,
  saves BIGINT NOT NULL DEFAULT 0,
  watch_time_seconds BIGINT NOT NULL DEFAULT 0,
  followers_gained BIGINT NOT NULL DEFAULT 0,
  engagement_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  reach BIGINT NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for content_metrics_history
CREATE INDEX idx_metrics_history_content_recorded 
  ON public.content_metrics_history (content_id, recorded_at DESC);

-- Enable RLS on content_metrics_history
ALTER TABLE public.content_metrics_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_metrics_history TO authenticated;
GRANT ALL ON public.content_metrics_history TO service_role;

-- Policies for content_metrics_history
CREATE POLICY "Metrics History: view authorized" ON public.content_metrics_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content WHERE id = content_id));

CREATE POLICY "Metrics History: admin or owner write" ON public.content_metrics_history
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.content
      WHERE id = content_id AND (user_id = auth.uid() OR (SELECT public.has_role(auth.uid(), 'admin')))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.content
      WHERE id = content_id AND (user_id = auth.uid() OR (SELECT public.has_role(auth.uid(), 'admin')))
    )
  );
