-- Migration: Fix legacy analytics aggregate trigger
-- Description: Corrects the broken `m.` / `c.` references in the analytics maintenance trigger used during Add Content writes.

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
      COALESCE(SUM(sub.views_per_platform), 0),
      COALESCE(
        jsonb_object_agg(COALESCE(sub.platform_id, 'other'), COALESCE(sub.views_per_platform, 0)),
        '{}'::jsonb
      )
    INTO v_total_views, v_platform_breakdown
    FROM (
      SELECT
        c.platform_id,
        SUM(m.views) AS views_per_platform
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
      COALESCE(SUM(sub.views_per_platform), 0),
      COALESCE(
        jsonb_object_agg(COALESCE(sub.platform_id, 'other'), COALESCE(sub.views_per_platform, 0)),
        '{}'::jsonb
      )
    INTO v_total_views, v_platform_breakdown
    FROM (
      SELECT
        c.platform_id,
        SUM(m.views) AS views_per_platform
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
