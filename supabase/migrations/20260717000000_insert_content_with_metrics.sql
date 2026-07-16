-- Migration: Atomic content + metrics insert helper
-- Description: Provides the single DB-side transaction that the Add Content flow depends on.

CREATE OR REPLACE FUNCTION public.insert_content_with_metrics(
  p_user_id UUID,
  p_group_id UUID,
  p_title TEXT,
  p_url TEXT,
  p_platform_id TEXT,
  p_content_type TEXT,
  p_status TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_content_id UUID;
BEGIN
  INSERT INTO public.content (
    user_id,
    group_id,
    title,
    url,
    platform_id,
    content_type,
    status,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_group_id,
    p_title,
    p_url,
    p_platform_id,
    p_content_type,
    p_status,
    now(),
    now()
  )
  RETURNING id INTO v_content_id;

  INSERT INTO public.content_metrics (
    content_id,
    views,
    likes,
    comments,
    shares,
    saves,
    watch_time_seconds,
    followers_gained,
    engagement_rate,
    reach,
    impressions,
    last_synced,
    last_fetched_at,
    sync_status,
    api_error
  )
  VALUES (
    v_content_id,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0.00,
    0,
    0,
    now(),
    NULL,
    'pending',
    NULL
  );

  RETURN v_content_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_content_with_metrics(
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.insert_content_with_metrics(
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) TO service_role;
