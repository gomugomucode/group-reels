-- Migration: Backward Compatibility Layer
-- Description: Migrates existing video_links and video_metrics_history data to the new schema, drops the physical legacy tables, and creates writable SQL views in their place.

-- 1. Data Backfill
-- Migrate data from public.video_links to public.content
INSERT INTO public.content (
  id,
  user_id,
  group_id,
  platform_id,
  title,
  url,
  external_id,
  content_type,
  thumbnail_url,
  published_at,
  duration_seconds,
  status,
  created_at,
  updated_at
)
SELECT
  id,
  created_by,
  group_id,
  CASE 
    WHEN platform::TEXT IN ('youtube', 'facebook', 'instagram', 'tiktok', 'vimeo', 'linkedin', 'twitter', 'other') THEN platform::TEXT
    ELSE 'other'
  END AS platform_id,
  title,
  url,
  youtube_video_id,
  'video' AS content_type,
  thumbnail_url,
  published_at,
  duration_seconds,
  status::TEXT,
  created_at,
  updated_at
FROM public.video_links
ON CONFLICT (id) DO NOTHING;

-- Migrate data from public.video_links metrics to public.content_metrics
INSERT INTO public.content_metrics (
  content_id,
  views,
  likes,
  comments,
  last_synced,
  last_fetched_at,
  sync_status,
  api_error
)
SELECT
  id,
  COALESCE(last_view_count, 0),
  COALESCE(last_like_count, 0),
  COALESCE(last_comment_count, 0),
  COALESCE(last_synced, now()),
  last_fetched_at,
  sync_status,
  api_error
FROM public.video_links
ON CONFLICT (content_id) DO NOTHING;

-- Migrate metrics history
INSERT INTO public.content_metrics_history (
  id,
  content_id,
  views,
  likes,
  comments,
  recorded_at
)
SELECT
  id,
  video_link_id,
  views,
  likes,
  comments,
  recorded_at
FROM public.video_metrics_history
ON CONFLICT (id) DO NOTHING;


-- 2. Clean up old structures (Drop dependent views and then the tables)
DROP VIEW IF EXISTS public.group_analytics_summary CASCADE;
DROP VIEW IF EXISTS public.top_videos CASCADE;

DROP TABLE IF EXISTS public.video_metrics_history CASCADE;
DROP TABLE IF EXISTS public.video_links CASCADE;


-- 3. Re-create video_links as a writable VIEW
CREATE OR REPLACE VIEW public.video_links WITH (security_invoker = true) AS
SELECT
  c.id,
  c.group_id,
  c.title,
  c.url,
  CASE 
    WHEN c.platform_id IN ('youtube', 'facebook', 'instagram', 'tiktok', 'vimeo', 'other') THEN c.platform_id::public.platform_type
    ELSE 'other'::public.platform_type
  END AS platform,
  c.status::public.link_status AS status,
  c.created_at,
  c.updated_at,
  c.user_id AS created_by,
  c.external_id AS youtube_video_id,
  c.thumbnail_url,
  CAST(NULL AS TEXT) AS channel_name, -- Deprecated
  c.published_at,
  c.duration_seconds,
  m.views AS last_view_count,
  m.likes AS last_like_count,
  m.comments AS last_comment_count,
  m.last_fetched_at,
  m.last_synced,
  m.sync_status,
  m.api_error
FROM public.content c
LEFT JOIN public.content_metrics m ON m.content_id = c.id
WHERE c.content_type = 'video' AND c.deleted_at IS NULL;

GRANT SELECT ON public.video_links TO authenticated;


-- 4. Re-create video_metrics_history as a writable VIEW
CREATE OR REPLACE VIEW public.video_metrics_history WITH (security_invoker = true) AS
SELECT
  h.id,
  h.content_id AS video_link_id,
  h.views,
  h.likes,
  h.comments,
  h.recorded_at
FROM public.content_metrics_history h
JOIN public.content c ON c.id = h.content_id
WHERE c.content_type = 'video';

GRANT SELECT ON public.video_metrics_history TO authenticated;


-- 5. Define INSTEAD OF triggers for legacy writes to video_links
CREATE OR REPLACE FUNCTION public.legacy_video_links_insert_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_platform_id TEXT;
BEGIN
  v_platform_id := NEW.platform::TEXT;
  IF NOT EXISTS (SELECT 1 FROM public.platforms WHERE id = v_platform_id) THEN
    v_platform_id := 'other';
  END IF;

  INSERT INTO public.content (
    id,
    user_id,
    group_id,
    platform_id,
    title,
    url,
    external_id,
    content_type,
    thumbnail_url,
    published_at,
    duration_seconds,
    status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.created_by,
    NEW.group_id,
    v_platform_id,
    NEW.title,
    NEW.url,
    NEW.youtube_video_id,
    'video',
    NEW.thumbnail_url,
    NEW.published_at,
    NEW.duration_seconds,
    NEW.status::TEXT,
    NEW.created_at,
    NEW.updated_at
  );

  INSERT INTO public.content_metrics (
    content_id,
    views,
    likes,
    comments,
    last_synced,
    last_fetched_at,
    sync_status,
    api_error
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.last_view_count, 0),
    COALESCE(NEW.last_like_count, 0),
    COALESCE(NEW.last_comment_count, 0),
    COALESCE(NEW.last_synced, now()),
    NEW.last_fetched_at,
    NEW.sync_status,
    NEW.api_error
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER legacy_video_links_insert
INSTEAD OF INSERT ON public.video_links
FOR EACH ROW EXECUTE FUNCTION public.legacy_video_links_insert_trigger();


CREATE OR REPLACE FUNCTION public.legacy_video_links_update_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_platform_id TEXT;
BEGIN
  v_platform_id := NEW.platform::TEXT;
  IF NOT EXISTS (SELECT 1 FROM public.platforms WHERE id = v_platform_id) THEN
    v_platform_id := 'other';
  END IF;

  UPDATE public.content SET
    group_id = NEW.group_id,
    platform_id = v_platform_id,
    title = NEW.title,
    url = NEW.url,
    external_id = NEW.youtube_video_id,
    thumbnail_url = NEW.thumbnail_url,
    published_at = NEW.published_at,
    duration_seconds = NEW.duration_seconds,
    status = NEW.status::TEXT,
    updated_at = NEW.updated_at,
    user_id = NEW.created_by
  WHERE id = OLD.id;

  INSERT INTO public.content_metrics (
    content_id,
    views,
    likes,
    comments,
    last_synced,
    last_fetched_at,
    sync_status,
    api_error
  )
  VALUES (
    OLD.id,
    COALESCE(NEW.last_view_count, 0),
    COALESCE(NEW.last_like_count, 0),
    COALESCE(NEW.last_comment_count, 0),
    COALESCE(NEW.last_synced, now()),
    NEW.last_fetched_at,
    NEW.sync_status,
    NEW.api_error
  )
  ON CONFLICT (content_id) DO UPDATE SET
    views = EXCLUDED.views,
    likes = EXCLUDED.likes,
    comments = EXCLUDED.comments,
    last_synced = EXCLUDED.last_synced,
    last_fetched_at = EXCLUDED.last_fetched_at,
    sync_status = EXCLUDED.sync_status,
    api_error = EXCLUDED.api_error;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER legacy_video_links_update
INSTEAD OF UPDATE ON public.video_links
FOR EACH ROW EXECUTE FUNCTION public.legacy_video_links_update_trigger();


CREATE OR REPLACE FUNCTION public.legacy_video_links_delete_trigger()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.content WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER legacy_video_links_delete
INSTEAD OF DELETE ON public.video_links
FOR EACH ROW EXECUTE FUNCTION public.legacy_video_links_delete_trigger();


-- 6. Define INSTEAD OF trigger for legacy writes to video_metrics_history
CREATE OR REPLACE FUNCTION public.legacy_video_metrics_history_insert_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.content_metrics_history (
    id,
    content_id,
    views,
    likes,
    comments,
    recorded_at
  )
  VALUES (
    NEW.id,
    NEW.video_link_id,
    NEW.views,
    NEW.likes,
    NEW.comments,
    NEW.recorded_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER legacy_video_metrics_history_insert
INSTEAD OF INSERT ON public.video_metrics_history
FOR EACH ROW EXECUTE FUNCTION public.legacy_video_metrics_history_insert_trigger();


-- 7. Re-create legacy analytics dependent views
CREATE OR REPLACE VIEW public.group_analytics_summary WITH (security_invoker = true) AS
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

GRANT SELECT ON public.group_analytics_summary TO authenticated;


CREATE OR REPLACE VIEW public.top_videos WITH (security_invoker = true) AS
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


-- 8. Trigger to automatically keep the physical analytics table updated
CREATE OR REPLACE FUNCTION public.update_legacy_analytics_table()
RETURNS TRIGGER AS $$
DECLARE
  v_group_id UUID;
  v_platform_breakdown JSONB;
  v_total_views BIGINT;
BEGIN
  SELECT group_id INTO v_group_id FROM public.content WHERE id = NEW.content_id;
  
  IF v_group_id IS NOT NULL THEN
    SELECT 
      COALESCE(SUM(m.views), 0),
      COALESCE(jsonb_object_agg(COALESCE(c.platform_id, 'other'), COALESCE(views_per_platform, 0)), '{}'::jsonb)
    INTO v_total_views, v_platform_breakdown
    FROM (
      SELECT c.platform_id, SUM(m.views) AS views_per_platform
      FROM public.content c
      JOIN public.content_metrics m ON m.content_id = c.id
      WHERE c.group_id = v_group_id AND c.deleted_at IS NULL
      GROUP BY c.platform_id
    ) sub;

    INSERT INTO public.analytics (group_id, total_views, platform_breakdown, last_updated)
    VALUES (v_group_id, v_total_views::INTEGER, v_platform_breakdown, now())
    ON CONFLICT (group_id) DO UPDATE SET
      total_views = EXCLUDED.total_views,
      platform_breakdown = EXCLUDED.platform_breakdown,
      last_updated = EXCLUDED.last_updated;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_legacy_analytics
  AFTER INSERT OR UPDATE ON public.content_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_legacy_analytics_table();


CREATE OR REPLACE FUNCTION public.update_legacy_analytics_table_on_content_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_group_id UUID;
  v_platform_breakdown JSONB;
  v_total_views BIGINT;
BEGIN
  v_group_id := OLD.group_id;
  
  IF v_group_id IS NOT NULL THEN
    SELECT 
      COALESCE(SUM(m.views), 0),
      COALESCE(jsonb_object_agg(COALESCE(c.platform_id, 'other'), COALESCE(views_per_platform, 0)), '{}'::jsonb)
    INTO v_total_views, v_platform_breakdown
    FROM (
      SELECT c.platform_id, SUM(m.views) AS views_per_platform
      FROM public.content c
      JOIN public.content_metrics m ON m.content_id = c.id
      WHERE c.group_id = v_group_id AND c.deleted_at IS NULL
      GROUP BY c.platform_id
    ) sub;

    INSERT INTO public.analytics (group_id, total_views, platform_breakdown, last_updated)
    VALUES (v_group_id, v_total_views::INTEGER, v_platform_breakdown, now())
    ON CONFLICT (group_id) DO UPDATE SET
      total_views = EXCLUDED.total_views,
      platform_breakdown = EXCLUDED.platform_breakdown,
      last_updated = EXCLUDED.last_updated;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_legacy_analytics_delete
  AFTER DELETE ON public.content
  FOR EACH ROW EXECUTE FUNCTION public.update_legacy_analytics_table_on_content_delete();
