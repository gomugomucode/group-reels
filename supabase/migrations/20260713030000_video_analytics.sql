-- ============================================================
-- Phase 2: Real Video Analytics
-- Extends video_links, adds video_metrics_history,
-- analytics_sync_log, a summary view, and RLS policies.
-- ============================================================

-- ── 1. Extend video_links with analytics columns ─────────────
ALTER TABLE public.video_links
  ADD COLUMN IF NOT EXISTS youtube_video_id   TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url      TEXT,
  ADD COLUMN IF NOT EXISTS channel_name       TEXT,
  ADD COLUMN IF NOT EXISTS published_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_seconds   INTEGER,
  ADD COLUMN IF NOT EXISTS last_view_count    BIGINT,
  ADD COLUMN IF NOT EXISTS last_like_count    BIGINT,
  ADD COLUMN IF NOT EXISTS last_comment_count BIGINT,
  ADD COLUMN IF NOT EXISTS last_fetched_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_synced        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_status        TEXT NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS api_error          TEXT;

-- Index to speed up "sync all YouTube videos for a group"
CREATE INDEX IF NOT EXISTS idx_video_links_youtube_id
  ON public.video_links (youtube_video_id)
  WHERE youtube_video_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_video_links_platform_status
  ON public.video_links (platform, sync_status);

-- ── 2. video_metrics_history ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.video_metrics_history (
  id             UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  video_link_id  UUID        NOT NULL REFERENCES public.video_links(id) ON DELETE CASCADE,
  views          BIGINT      NOT NULL DEFAULT 0,
  likes          BIGINT      NOT NULL DEFAULT 0,
  comments       BIGINT      NOT NULL DEFAULT 0,
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.video_metrics_history TO authenticated;
GRANT ALL    ON public.video_metrics_history TO service_role;
ALTER TABLE public.video_metrics_history ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read history; writes go through service_role
CREATE POLICY "Metrics history: view authenticated" ON public.video_metrics_history
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_metrics_history_video_recorded
  ON public.video_metrics_history (video_link_id, recorded_at DESC);

-- ── 3. analytics_sync_log ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.analytics_sync_log (
  id                 UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at       TIMESTAMPTZ,
  videos_processed   INTEGER     NOT NULL DEFAULT 0,
  videos_succeeded   INTEGER     NOT NULL DEFAULT 0,
  videos_failed      INTEGER     NOT NULL DEFAULT 0,
  error_summary      TEXT
);

GRANT SELECT ON public.analytics_sync_log TO authenticated;
GRANT ALL    ON public.analytics_sync_log TO service_role;
ALTER TABLE public.analytics_sync_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read sync logs
CREATE POLICY "Sync log: admin only" ON public.analytics_sync_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_sync_log_started_at
  ON public.analytics_sync_log (started_at DESC);

-- ── 4. PostgreSQL view: group analytics summary ───────────────
CREATE OR REPLACE VIEW public.group_analytics_summary AS
SELECT
  g.id                                          AS group_id,
  g.team_name,
  COUNT(vl.id)                                  AS video_count,
  COALESCE(SUM(vl.last_view_count),    0)       AS total_views,
  COALESCE(SUM(vl.last_like_count),    0)       AS total_likes,
  COALESCE(SUM(vl.last_comment_count), 0)       AS total_comments,
  MAX(vl.last_synced)                           AS last_synced,
  COUNT(vl.id) FILTER (WHERE vl.status = 'valid')   AS valid_count,
  COUNT(vl.id) FILTER (WHERE vl.status = 'invalid') AS invalid_count,
  COUNT(vl.id) FILTER (WHERE vl.platform = 'youtube' AND vl.youtube_video_id IS NOT NULL) AS youtube_count
FROM public.groups g
LEFT JOIN public.video_links vl ON vl.group_id = g.id
GROUP BY g.id, g.team_name;

-- Grant view access to authenticated users
GRANT SELECT ON public.group_analytics_summary TO authenticated;
GRANT SELECT ON public.group_analytics_summary TO service_role;

-- ── 5. PostgreSQL view: top videos ───────────────────────────
CREATE OR REPLACE VIEW public.top_videos AS
SELECT
  vl.id,
  vl.group_id,
  g.team_name,
  vl.title,
  vl.url,
  vl.platform,
  vl.youtube_video_id,
  vl.thumbnail_url,
  vl.channel_name,
  vl.last_view_count,
  vl.last_like_count,
  vl.last_comment_count,
  vl.last_synced,
  vl.sync_status
FROM public.video_links vl
JOIN public.groups g ON g.id = vl.group_id
WHERE vl.last_view_count IS NOT NULL
ORDER BY vl.last_view_count DESC;

GRANT SELECT ON public.top_videos TO authenticated;
GRANT SELECT ON public.top_videos TO service_role;

-- ── 6. Helper: is_group_member function ──────────────────────
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id
      AND user_id = auth.uid()
      AND invitation_status = 'accepted'
  )
$$;
