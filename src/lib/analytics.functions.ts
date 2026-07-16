import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractYouTubeVideoId, buildYouTubeApiUrl, mapYouTubeResponse, httpStatusToSyncStatus } from "./youtube";

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
    youtube_video_id: row.external_id,
    thumbnail_url: row.thumbnail_url,
    channel_name: null,
    published_at: row.published_at,
    duration_seconds: row.duration_seconds,
    last_view_count: metrics?.views ?? 0,
    last_like_count: metrics?.likes ?? 0,
    last_comment_count: metrics?.comments ?? 0,
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
  // Fetch the video link details
  const { data: row, error: fetchErr } = await supabaseAdmin
    .from("content")
    .select("*, metrics:content_metrics(*)")
    .eq("id", videoLinkId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchErr || !row) throw new Error("Video link not found");

  const video = mapContentToVideoLink(row);

  if (video.platform !== "youtube") {
    throw new Error("Only YouTube videos are currently supported for analytics sync");
  }

  // Rate-limit check: maximum once every 5 minutes unless forced by owner/admin
  if (video.last_fetched_at && !force) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (new Date(video.last_fetched_at) > fiveMinutesAgo) {
      return { ok: true, video, skipped: true, reason: "Recently synced" };
    }
  }

  // Extract YouTube ID if not present
  let videoId = video.youtube_video_id;
  if (!videoId) {
    videoId = extractYouTubeVideoId(video.url);
    if (!videoId) {
      await Promise.all([
        supabaseAdmin.from("content").update({ status: "invalid" }).eq("id", video.id),
        supabaseAdmin
          .from("content_metrics")
          .update({
            sync_status: "error",
            api_error: "Invalid or unsupported YouTube URL structure",
            last_fetched_at: new Date().toISOString(),
          })
          .eq("content_id", video.id),
      ]);
      throw new Error("Invalid YouTube URL");
    }
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    await supabaseAdmin
      .from("content_metrics")
      .update({
        sync_status: "error",
        api_error: "YouTube Data API Key is not configured on the server",
        last_fetched_at: new Date().toISOString(),
      })
      .eq("content_id", video.id);
    throw new Error("YouTube API Key is missing on the server configuration");
  }

  // Mark as syncing in database
  await supabaseAdmin
    .from("content_metrics")
    .update({ sync_status: "syncing" })
    .eq("content_id", video.id);

  try {
    const apiUrl = buildYouTubeApiUrl(videoId, apiKey);
    const res = await fetch(apiUrl);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const statusText = errorData.error?.message || `HTTP error ${res.status}`;
      const syncStatus = httpStatusToSyncStatus(res.status, statusText);

      await supabaseAdmin
        .from("content_metrics")
        .update({
          sync_status: (syncStatus === "deleted" || syncStatus === "error" ? "error" : "pending") as any,
          api_error: statusText,
          last_fetched_at: new Date().toISOString(),
        })
        .eq("content_id", video.id);

      return { ok: false, error: statusText };
    }

    const json = await res.json();
    if (!json.items || json.items.length === 0) {
      // Video might be deleted, private, or invalid ID
      await Promise.all([
        supabaseAdmin.from("content").update({ status: "invalid" }).eq("id", video.id),
        supabaseAdmin
          .from("content_metrics")
          .update({
            sync_status: "error",
            api_error: "Video not found (might be private or deleted)",
            last_fetched_at: new Date().toISOString(),
          })
          .eq("content_id", video.id),
      ]);

      return { ok: false, error: "Video not found in YouTube Data API" };
    }

    const parsedStats = mapYouTubeResponse(json.items[0]);
    if (!parsedStats) {
      throw new Error("Failed to map YouTube API response");
    }

    const now = new Date().toISOString();

    const [contentRes, metricsRes] = await Promise.all([
      supabaseAdmin
        .from("content")
        .update({
          thumbnail_url: parsedStats.thumbnailUrl,
          published_at: parsedStats.publishedAt,
          duration_seconds: parsedStats.durationSeconds,
          status: "valid" as const,
          external_id: videoId,
          updated_at: now,
        })
        .eq("id", video.id)
        .select()
        .single(),
      supabaseAdmin
        .from("content_metrics")
        .update({
          views: parsedStats.viewCount,
          likes: parsedStats.likeCount,
          comments: parsedStats.commentCount,
          last_fetched_at: now,
          last_synced: now,
          sync_status: "success" as const,
          api_error: null,
        })
        .eq("content_id", video.id)
        .select()
        .single(),
    ]);

    if (contentRes.error) throw contentRes.error;
    if (metricsRes.error) throw metricsRes.error;

    const updatedVideo = mapContentToVideoLink({
      ...contentRes.data,
      metrics: metricsRes.data,
    });

    // Add a snapshot record to historical metrics table
    const { error: historyErr } = await supabaseAdmin
      .from("content_metrics_history")
      .insert({
        content_id: video.id,
        views: parsedStats.viewCount,
        likes: parsedStats.likeCount,
        comments: parsedStats.commentCount,
        recorded_at: now,
      });

    if (historyErr) {
      console.error("Failed to write to metrics history:", historyErr);
    }

    return { ok: true, video: updatedVideo };
  } catch (e: any) {
    const errMsg = e.message || "Unknown error occurred during sync";
    await supabaseAdmin
      .from("content_metrics")
      .update({
        sync_status: "error",
        api_error: errMsg,
        last_fetched_at: new Date().toISOString(),
      })
      .eq("content_id", video.id);

    return { ok: false, error: errMsg };
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

    if (fetchErr || !video) throw new Error("Video link not found");

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
      .eq("platform_id", "youtube")
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

    // Verify admin access
    await assertAdmin(supabaseAdmin, userId);

    // Fetch all YouTube video links
    const { data: videos, error } = await supabaseAdmin
      .from("content")
      .select("id")
      .eq("platform_id", "youtube")
      .is("deleted_at", null);

    if (error) throw error;
    if (!videos || videos.length === 0) return { ok: true, processed: 0 };

    // Log started sync action
    const { data: syncLog, error: logErr } = await supabaseAdmin
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
    await supabaseAdmin
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

    await assertAdmin(supabaseAdmin, userId);

    // Get last 15 sync logs
    const { data: logs, error: logsErr } = await supabaseAdmin
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

    const apiKeyConfigured = !!process.env.YOUTUBE_API_KEY;

    return {
      apiKeyConfigured,
      totalYoutube: totalYoutube || 0,
      syncedYoutube: syncedYoutube || 0,
      failedYoutube: failedYoutube || 0,
      logs: logs || [],
    };
  });
