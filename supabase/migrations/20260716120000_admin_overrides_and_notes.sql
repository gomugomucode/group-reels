-- Migration: Admin Overrides and Notes
-- Description: Adds notes column to content, adds updated_by, updated_at, manual_override to content_metrics, updates video_links view and triggers.

-- 1. Add notes column to content
ALTER TABLE public.content ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Add override columns to content_metrics
ALTER TABLE public.content_metrics ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.content_metrics ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.content_metrics ADD COLUMN IF NOT EXISTS manual_override BOOLEAN DEFAULT false;

-- 3. Recreate the video_links view with all new and override columns
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
  m.api_error,
  c.notes,
  m.updated_by,
  m.updated_at AS metrics_updated_at,
  m.manual_override,
  m.watch_time_seconds,
  m.engagement_rate
FROM public.content c
LEFT JOIN public.content_metrics m ON m.content_id = c.id
WHERE c.content_type = 'video' AND c.deleted_at IS NULL;

-- 4. Recreate triggers to support notes and overrides
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
    notes,
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
    NEW.notes,
    NEW.created_at,
    NEW.updated_at
  );

  INSERT INTO public.content_metrics (
    content_id,
    views,
    likes,
    comments,
    watch_time_seconds,
    engagement_rate,
    last_synced,
    last_fetched_at,
    sync_status,
    api_error,
    updated_by,
    updated_at,
    manual_override
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.last_view_count, 0),
    COALESCE(NEW.last_like_count, 0),
    COALESCE(NEW.last_comment_count, 0),
    COALESCE(NEW.watch_time_seconds, 0),
    COALESCE(NEW.engagement_rate, 0.00),
    COALESCE(NEW.last_synced, now()),
    NEW.last_fetched_at,
    NEW.sync_status,
    NEW.api_error,
    NEW.updated_by,
    NEW.metrics_updated_at,
    COALESCE(NEW.manual_override, false)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    notes = NEW.notes,
    updated_at = NEW.updated_at,
    user_id = NEW.created_by
  WHERE id = OLD.id;

  INSERT INTO public.content_metrics (
    content_id,
    views,
    likes,
    comments,
    watch_time_seconds,
    engagement_rate,
    last_synced,
    last_fetched_at,
    sync_status,
    api_error,
    updated_by,
    updated_at,
    manual_override
  )
  VALUES (
    OLD.id,
    COALESCE(NEW.last_view_count, 0),
    COALESCE(NEW.last_like_count, 0),
    COALESCE(NEW.last_comment_count, 0),
    COALESCE(NEW.watch_time_seconds, 0),
    COALESCE(NEW.engagement_rate, 0.00),
    COALESCE(NEW.last_synced, now()),
    NEW.last_fetched_at,
    NEW.sync_status,
    NEW.api_error,
    NEW.updated_by,
    NEW.metrics_updated_at,
    COALESCE(NEW.manual_override, false)
  )
  ON CONFLICT (content_id) DO UPDATE SET
    views = EXCLUDED.views,
    likes = EXCLUDED.likes,
    comments = EXCLUDED.comments,
    watch_time_seconds = EXCLUDED.watch_time_seconds,
    engagement_rate = EXCLUDED.engagement_rate,
    last_synced = EXCLUDED.last_synced,
    last_fetched_at = EXCLUDED.last_fetched_at,
    sync_status = EXCLUDED.sync_status,
    api_error = EXCLUDED.api_error,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at,
    manual_override = EXCLUDED.manual_override;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
