import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyticsService } from "@/lib/analytics.service";
import { extractYouTubeVideoId } from '@/lib/youtube';

// Helper: Assert that the caller is a group member, group owner, or admin
async function assertGroupAccess(supabase: any, groupId: string, userId: string) {
  // Check if admin
  const { data: isAdmin, error: adminErr } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (adminErr) throw new Error("Could not verify permissions");
  if (isAdmin) return;

  // Check if group owner
  const { data: isOwner, error: ownerErr } = await supabase.rpc("owns_group", {
    _group_id: groupId,
  });
  if (ownerErr) throw new Error("Could not verify group ownership");
  if (isOwner) return;

  // Check if group member
  const { data: isMember, error: memberErr } = await supabase.rpc("is_group_member", {
    _group_id: groupId,
  });
  if (memberErr) throw new Error("Could not verify group membership");
  if (!isMember) {
    throw new Error("Forbidden: You do not have access to this group");
  }
}

// Helper: Assert that the caller is group owner or admin
async function assertGroupOwnerOrAdmin(supabase: any, groupId: string, userId: string) {
  const { data: isAdmin, error: adminErr } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (adminErr) throw new Error("Could not verify permissions");
  if (isAdmin) return;

  const { data: isOwner, error: ownerErr } = await supabase.rpc("owns_group", {
    _group_id: groupId,
  });
  if (ownerErr) throw new Error("Could not verify group ownership");
  if (!isOwner) {
    throw new Error("Forbidden: Only group owners or admins can perform this action");
  }
}

// Helper: Assert that the caller is admin
async function assertAdmin(supabase: any, userId: string) {
  const { data: isAdmin, error: adminErr } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (adminErr) throw new Error("Could not verify permissions");
  if (!isAdmin) {
    throw new Error("Forbidden: Admin access required");
  }
}

function mapContentToVideoLink(row: any): any {
  const metrics = Array.isArray(row.metrics) ? row.metrics[0] : row.metrics;

  return {
    id: row.id,
    group_id: row.group_id ?? "",
    title: row.title,
    url: row.url,
    platform: row.platform_id,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.user_id,
    external_id: row.external_id,
    youtube_video_id: row.external_id, // kept for backward compatibility
    thumbnail_url: row.thumbnail_url,
    channel_name: null,
    published_at: row.published_at,
    duration_seconds: row.duration_seconds,
    last_view_count: metrics?.views ?? null,
    last_like_count: metrics?.likes ?? null,
    last_comment_count: metrics?.comments ?? null,
    last_fetched_at: metrics?.last_fetched_at ?? null,
    last_synced: metrics?.last_synced ?? null,
    sync_status: metrics?.sync_status ?? "idle",
    api_error: metrics?.api_error ?? null,
  };
}

/** Shared server-side sync executor function */
async function executeSyncVideoAnalytics(
  supabaseAdmin: any,
  videoLinkId: string,
  force: boolean
): Promise<{ ok: boolean; video?: any; skipped?: boolean; reason?: string; error?: string }> {
  console.log(`[SyncVideo] Starting sync execution for content_id: ${videoLinkId}, force: ${force}`);
  
  // Fetch the video link details
  const { data: row, error: fetchErr } = await supabaseAdmin
    .from("content")
    .select("*, metrics:content_metrics(*)")
    .eq("id", videoLinkId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchErr || !row) {
    console.error(`[SyncVideo] Error fetching video link or not found. ID: ${videoLinkId}. Error:`, fetchErr);
    throw new Error("Video link not found");
  }

  const video = mapContentToVideoLink(row);
  console.log(`[SyncVideo] Fetched video details: title="${video.title}", platform="${video.platform}", url="${video.url}"`);

  // Extract YouTube video ID for updating external_id (only for YouTube, but we do it for all for consistency)
  const videoId = extractYouTubeVideoId(video.url);
  // Note: For non-YouTube platforms, videoId will be null, but we only update external_id on success for YouTube.

  // Rate-limit check: maximum once every 30 minutes unless forced by owner/admin
  if (video.last_fetched_at && !force) {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    if (new Date(video.last_fetched_at) > thirtyMinutesAgo) {
      console.log(`[SyncVideo] Skipping sync due to cooldown limit (30 min). Last synced: ${video.last_fetched_at}`);
      return { ok: true, video, skipped: true, reason: "Recently synced" };
    }
  }

  // Fetch analytics using the service
  let analytics: any;
  try {
    analytics = await analyticsService.fetchAnalytics(video.url);
  } catch (err: any) {
    const now = new Date().toISOString();
    console.error(`[SyncVideo] Failed to fetch analytics for platform ${video.platform}:`, err);
    await supabaseAdmin
      .from("content_metrics")
      .update({
        sync_status: "error",
        api_error: err.message ?? "Unknown error",
        last_fetched_at: now,
      })
      .eq("content_id", video.id);
    return { ok: false, error: err.message ?? "Unknown error" };
  }

  const now = new Date().toISOString();
  const syncedAt = analytics.syncedAt ?? now;

  // Handle based on analytics status
  if (analytics.status === "success") {
    // Successful fetch: update content and content_metrics
    try {
      const [contentRes, metricsRes] = await Promise.all([
        // Update content
        supabaseAdmin
          .from("content")
          .update({
            title: analytics.title,
            thumbnail_url: analytics.thumbnail,
            published_at: analytics.publishedAt,
            duration_seconds: analytics.duration,
            status: "valid" as const,
            // Only update external_id if we have a videoId (YouTube) and it's different?
            // We'll update it if we have a videoId from the URL (should be same as analytics.platformId? but we don't have that)
            // We'll use the videoId we extracted earlier.
            external_id: videoId ?? undefined, // If videoId is null, we don't update external_id (will keep existing)
            updated_at: now,
          })
          .eq("id", video.id)
          .select()
          .single(),
        // Update content_metrics
        supabaseAdmin
          .from("content_metrics")
          .update({
            views: analytics.views,
            likes: analytics.likes,
            comments: analytics.comments,
            shares: analytics.shares,
            saves: analytics.saves,
            watch_time_seconds: 0, // Not provided by AnalyticsResult
            engagement_rate: 
              analytics.views > 0
                ? ((analytics.likes + analytics.comments) / analytics.views) * 100
                : 0,
            followers_gained: 0, // Not provided
            reach: 0, // Not provided
            impressions: 0, // Not provided
            last_fetched_at: now,
            last_synced: syncedAt,
            sync_status: "success" as const,
            api_error: null,
          })
          .eq("content_id", video.id)
          .select()
          .single(),
      ]);

      if (contentRes.error) {
        console.error(`[SyncVideo] Database error updating content:`, contentRes.error);
        throw contentRes.error;
      }
      if (metricsRes.error) {
        console.error(`[SyncVideo] Database error updating content_metrics:`, metricsRes.error);
        throw metricsRes.error;
      }

      // Insert a snapshot into content_metrics_history
      const { error: historyErr } = await supabaseAdmin
        .from("content_metrics_history")
        .insert({
          content_id: video.id,
          views: analytics.views,
          likes: analytics.likes,
          comments: analytics.comments,
          shares: analytics.shares,
          saves: analytics.saves,
          watch_time_seconds: 0,
          engagement_rate: 
            analytics.views > 0
              ? ((analytics.likes + analytics.comments) / analytics.views) * 100
              : 0,
          followers_gained: 0,
          reach: 0,
          impressions: 0,
          recorded_at: syncedAt,
        });

      if (historyErr) {
        console.warn("[SyncVideo] Failed to write to metrics history:", historyErr);
        // Not critical, we can still return success
      }

      const updatedVideo = mapContentToVideoLink({
        ...contentRes.data,
        metrics: metricsRes.data,
      });

      console.log(`[SyncVideo] Sync completed successfully for content_id: ${videoLinkId}`);
      return { ok: true, video: updatedVideo };
    } catch (err: any) {
      const now = new Date().toISOString();
      console.error(`[SyncVideo] Database error during sync:`, err);
      await supabaseAdmin
        .from("content_metrics")
        .update({
          sync_status: "error",
          api_error: err.message ?? "Unknown error",
          last_fetched_at: new Date().toISOString(),
        })
        .eq("content_id", video.id);
      return { ok: false, error: err.message ?? "Unknown error" };
    }
  } else {
    // Handle error statuses
    let contentUpdate = null;
    let metricsUpdate = {
      sync_status: "error" as const,
      api_error: "",
      last_fetched_at: now,
    };

    // Determine error message and whether to invalidate content
    let errorMessage = "Unknown error";
    switch (analytics.status) {
      case "invalid_url":
        errorMessage = "Invalid URL for platform";
        contentUpdate = { status: "invalid" }; // Invalidate content
        break;
      case "video_not_found":
        errorMessage = "Video not found (might be private or deleted)";
        contentUpdate = { status: "invalid" }; // Invalidate content
        break;
      case "requires_authorization":
        errorMessage = "Requires authorization";
        // Do not invalidate content; just mark error in metrics
        break;
      case "api_error":
        errorMessage = "API error";
        break;
      case "unsupported_platform":
        errorMessage = "Platform not supported";
        break;
      case "youtube_api_key_missing":
        errorMessage = "YouTube API key is not configured";
        break;
      default:
        errorMessage = `Unknown error: ${analytics.status}`;
        break;
    }

    metricsUpdate.api_error = errorMessage;

    try {
      // Update content if needed
      if (contentUpdate) {
        await supabaseAdmin
          .from("content")
          .update(contentUpdate)
          .eq("id", video.id);
      }

      // Update content_metrics
      await supabaseAdmin
        .from("content_metrics")
        .update(metricsUpdate)
        .eq("content_id", video.id);

      return { 
        ok: true, 
        video: { ...video, sync_status: "error", api_error: errorMessage }, 
        skipped: false, 
        reason: "Analytics fetch failed" 
      };
    } catch (err: any) {
      const now = new Date().toISOString();
      console.error(`[SyncVideo] Database error during error handling:`, err);
      await supabaseAdmin
        .from("content_metrics")
        .update({
          sync_status: "error",
          api_error: err.message ?? "Unknown error",
          last_fetched_at: new Date().toISOString(),
        })
        .eq("content_id", video.id);
      return { ok: false, error: err.message ?? "Unknown error" };
    }
  }
}

/** Sync analytics for a single video link */
export const syncVideoAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ videoLinkId: z.string().uuid(), force: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch the video link details to confirm access
    const { data: video, error: fetchErr } = await supabaseAdmin
      .from("content")
      .select("group_id")
      .eq("id", data.videoLinkId)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchErr || !video || !video.group_id) throw new Error("Video link not found or missing group");

    // Verify caller permission (member, owner, or admin)
    await assertGroupAccess(supabaseAdmin, video.group_id, userId);

    return executeSyncVideoAnalytics(supabaseAdmin, data.videoLinkId, !!data.force);
  });

/** Sync all YouTube video analytics in a group */
export const syncGroupAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ groupId: z.string().uuid(), force: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Assert that the user is the group owner or admin
    await assertGroupOwnerOrAdmin(supabaseAdmin, data.groupId, userId);

    // Fetch all YouTube video links in the group
    const { data: videos, error } = await supabaseAdmin
      .from("content")
      .select("id")
      .eq("group_id", data.groupId)
      .is("deleted_at", null);

    if (error) throw error;
    if (!videos || videos.length === 0) return { ok: true, processed: 0 };

    let succeeded = 0;
    let failed = 0;

    // Run sync sequentially to respect rate limits / concurrent requests
    for (const v of videos) {
      try {
        const result = await executeSyncVideoAnalytics(supabaseAdmin, v.id, !!data.force);
        if (result.ok) {
          succeeded++;
        } else {
          failed++;
        }
      } catch (err) {
        console.error(`Group sync failed for video ${v.id}:`, err);
        failed++;
      }
    }

    return { ok: true, processed: videos.length, succeeded, failed };
  });

/** Trigger a full synchronization of all YouTube videos across all groups (Admin only) */
export const triggerFullSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    // Verify admin access
    await assertAdmin(supabaseAdmin, userId);

    // Fetch all YouTube video links
    const { data: videos, error } = await supabaseAdmin
      .from("content")
      .select("id")
      .is("deleted_at", null);

    if (error) throw error;
    if (!videos || videos.length === 0) return { ok: true, processed: 0 };

    // Log started sync action
    const { data: syncLog, error: logErr } = await db
      .from("analytics_sync_log")
      .insert({
        triggered_by: userId,
        started_at: new Date().toISOString(),
        videos_processed: videos.length,
      })
      .select()
      .single();

    if (logErr) throw logErr;

    let succeeded = 0;
    let failed = 0;
    const errorsList: string[] = [];

    // Run sync sequentially
    for (const v of videos) {
      try {
        const result = await executeSyncVideoAnalytics(supabaseAdmin, v.id, true);
        if (result.ok) {
          succeeded++;
        } else {
          failed++;
          errorsList.push(`Video ${v.id}: ${result.error ?? "Failed"}`);
        }
      } catch (err: any) {
        failed++;
        errorsList.push(`Video ${v.id}: ${err.message || "Unknown error"}`);
      }
    }

    // Complete the sync log entry
    await db
      .from("analytics_sync_log")
      .update({
        completed_at: new Date().toISOString(),
        videos_succeeded: succeeded,
        videos_failed: failed,
        error_summary: errorsList.length > 0 ? errorsList.slice(0, 10).join("\n") : null,
      })
      .eq("id", syncLog.id);

    return { ok: true, processed: videos.length, succeeded, failed };
  });

/** Retrieve full sync logs and quota utilization details for Admin settings */
export const getAnalyticsSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    await assertAdmin(supabaseAdmin, userId);

    // Get last 15 sync logs
    const { data: logs, error: logsErr } = await db
      .from("analytics_sync_log")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(15);

    if (logsErr) throw logsErr;

    // Get simple counts of videos from base tables
    const { count: totalYoutube } = await supabaseAdmin
      .from("content")
      .select("*", { count: "exact", head: true })
      .eq("platform_id", "youtube")
      .is("deleted_at", null);

    const { count: syncedYoutube } = await supabaseAdmin
      .from("content_metrics")
      .select("content!inner(*)", { count: "exact", head: true })
      .eq("content.platform_id", "youtube")
      .is("content.deleted_at", null)
      .eq("sync_status", "success");

    const { count: failedYoutube } = await supabaseAdmin
      .from("content_metrics")
      .select("content!inner(*)", { count: "exact", head: true })
      .eq("content.platform_id", "youtube")
      .is("content.deleted_at", null)
      .eq("sync_status", "error");

    const { loadEnv } = await import("@/lib/env.server");
    loadEnv();
    const apiKeyConfigured = !!process.env.YOUTUBE_API_KEY;

    return {
      apiKeyConfigured,
      totalYoutube: totalYoutube || 0,
      syncedYoutube: syncedYoutube || 0,
      failedYoutube: failedYoutube || 0,
      logs: logs || [],
    };
  });