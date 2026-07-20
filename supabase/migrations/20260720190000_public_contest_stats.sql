-- Migration: Public Contest Stats Function
-- Description: Creates a SECURITY DEFINER database function to compile aggregate competition statistics for public landing page hero widgets.

CREATE OR REPLACE FUNCTION public.get_public_contest_stats()
RETURNS JSON AS $$
DECLARE
  v_total_participants INT;
  v_total_teams INT;
  v_total_videos INT;
  v_total_views BIGINT;
  v_total_likes BIGINT;
  v_total_comments BIGINT;
  v_engagement_rate NUMERIC;
  v_platform_breakdown JSONB;
  v_top_team_name TEXT;
  v_top_team_views INT;
  v_latest_video_title TEXT;
  v_latest_video_url TEXT;
  v_latest_video_platform TEXT;
  v_latest_video_published TIMESTAMPTZ;
  v_views_history JSONB;
BEGIN
  -- Total Participants (profiles count)
  SELECT COUNT(*) INTO v_total_participants FROM public.profiles;

  -- Total Teams (groups count)
  SELECT COUNT(*) INTO v_total_teams FROM public.groups;

  -- Total Videos
  SELECT COUNT(*) INTO v_total_videos FROM public.content WHERE content_type = 'video' AND deleted_at IS NULL;

  -- Views, Likes, Comments
  SELECT 
    COALESCE(SUM(views), 0),
    COALESCE(SUM(likes), 0),
    COALESCE(SUM(comments), 0)
  INTO v_total_views, v_total_likes, v_total_comments
  FROM public.content_metrics;

  -- Engagement Rate
  IF v_total_views > 0 THEN
    v_engagement_rate := ((v_total_likes + v_total_comments)::NUMERIC / v_total_views) * 100;
  ELSE
    v_engagement_rate := 0;
  END IF;

  -- Platform breakdown (count of videos per platform)
  SELECT jsonb_object_agg(platform_id, cnt) INTO v_platform_breakdown
  FROM (
    SELECT platform_id, COUNT(*) AS cnt
    FROM public.content
    WHERE content_type = 'video' AND deleted_at IS NULL
    GROUP BY platform_id
  ) sub;

  -- Top Performing Team (by views)
  SELECT g.team_name, a.total_views INTO v_top_team_name, v_top_team_views
  FROM public.analytics a
  JOIN public.groups g ON g.id = a.group_id
  ORDER BY a.total_views DESC
  LIMIT 1;

  -- Most recently uploaded video
  SELECT title, url, platform_id, published_at INTO v_latest_video_title, v_latest_video_url, v_latest_video_platform, v_latest_video_published
  FROM public.content
  WHERE content_type = 'video' AND deleted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  -- Views history over time (aggregated views by day)
  SELECT jsonb_agg(json_build_object('date', day, 'views', total_views)) INTO v_views_history
  FROM (
    SELECT 
      TO_CHAR(recorded_at, 'YYYY-MM-DD') AS day,
      SUM(views) AS total_views
    FROM public.content_metrics_history
    GROUP BY day
    ORDER BY day ASC
    LIMIT 30
  ) sub;

  RETURN json_build_object(
    'total_participants', v_total_participants,
    'total_teams', v_total_teams,
    'total_videos', v_total_videos,
    'total_views', v_total_views,
    'total_likes', v_total_likes,
    'total_comments', v_total_comments,
    'engagement_rate', ROUND(v_engagement_rate, 2),
    'platform_breakdown', COALESCE(v_platform_breakdown, '{}'::jsonb),
    'top_team_name', COALESCE(v_top_team_name, 'No Teams yet'),
    'top_team_views', COALESCE(v_top_team_views, 0),
    'latest_video', json_build_object(
      'title', COALESCE(v_latest_video_title, 'No videos yet'),
      'url', COALESCE(v_latest_video_url, ''),
      'platform', COALESCE(v_latest_video_platform, ''),
      'published_at', v_latest_video_published
    ),
    'views_history', COALESCE(v_views_history, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant public execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.get_public_contest_stats() TO authenticated, anon;
