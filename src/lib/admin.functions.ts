import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error("Could not verify permissions");
  if (!data) throw new Error("Forbidden: admin access required");
}

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        makeAdmin: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    if (data.userId === userId && !data.makeAdmin) {
      throw new Error("You cannot remove your own admin role");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.makeAdmin) {
      const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: "admin" });
      if (error && error.code !== "23505") throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

export const setUserAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        disabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    if (data.userId === userId && data.disabled) {
      throw new Error("You cannot disable your own account");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ disabled: data.disabled, updated_at: new Date().toISOString() }).eq("id", data.userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

/** Update a user's editable account details. Admin only. */
export const updateUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        username: z.string().trim().min(2, "Username must be at least 2 characters").max(80),
        email: z.string().trim().email("Enter a valid email"),
        teamName: z.string().trim().min(2, "Team name is required").max(80),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email: data.email,
    });
    if (authError) throw new Error(authError.message);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        username: data.username,
        email: data.email,
        team_name: data.teamName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);

    return { ok: true };
  });

/** Permanently delete a user account (auth + cascading data). Admin only. */
export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    if (data.userId === userId) {
      throw new Error("You cannot delete your own admin account");
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Send a password reset email to a user. Admin only. */
export const sendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().email() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Update content details and override analytics metrics as Admin. */
export const adminEditContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().nullable(),
        url: z.string(),
        platform: z.string(),
        status: z.string(),
        thumbnailUrl: z.string().nullable(),
        notes: z.string().nullable(),
        views: z.number().nonnegative(),
        likes: z.number().nonnegative(),
        comments: z.number().nonnegative(),
        watchTimeSeconds: z.number().nonnegative(),
        engagementRate: z.number().nonnegative(),
        syncStatus: z.string(),
        manualOverride: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch old data for audit log comparison
    const { data: oldRow, error: fetchErr } = await supabaseAdmin
      .from("content")
      .select("*, metrics:content_metrics(*)")
      .eq("id", data.id)
      .maybeSingle();

    if (fetchErr || !oldRow) throw new Error("Content link not found");

    const oldMetrics = Array.isArray(oldRow.metrics) ? oldRow.metrics[0] : oldRow.metrics;
    
    const oldViews = oldMetrics?.views ? Number(oldMetrics.views) : 0;
    const oldLikes = oldMetrics?.likes ? Number(oldMetrics.likes) : 0;
    const oldComments = oldMetrics?.comments ? Number(oldMetrics.comments) : 0;
    const oldWatchTime = oldMetrics?.watch_time_seconds ? Number(oldMetrics.watch_time_seconds) : 0;
    const oldEngagement = oldMetrics?.engagement_rate ? Number(oldMetrics.engagement_rate) : 0.00;

    const metricsChanged = 
      data.views !== oldViews || 
      data.likes !== oldLikes || 
      data.comments !== oldComments ||
      data.watchTimeSeconds !== oldWatchTime ||
      data.engagementRate !== oldEngagement;

    const manualOverrideToSet = data.manualOverride || metricsChanged;

    const now = new Date().toISOString();

    // Update content table
    const { error: contentErr } = await supabaseAdmin
      .from("content")
      .update({
        title: data.title,
        url: data.url,
        platform_id: data.platform,
        status: data.status,
        thumbnail_url: data.thumbnailUrl,
        notes: data.notes,
        updated_at: now,
      })
      .eq("id", data.id);

    if (contentErr) throw new Error(contentErr.message);

    // Update content_metrics table
    const { error: metricsErr } = await supabaseAdmin
      .from("content_metrics")
      .update({
        views: data.views,
        likes: data.likes,
        comments: data.comments,
        watch_time_seconds: data.watchTimeSeconds,
        engagement_rate: data.engagementRate,
        sync_status: data.syncStatus,
        manual_override: manualOverrideToSet,
        updated_by: userId,
        updated_at: now,
        last_synced: now,
      })
      .eq("content_id", data.id);

    if (metricsErr) throw new Error(metricsErr.message);

    // Write metric history snapshot if values changed
    if (metricsChanged) {
      await supabaseAdmin.from("content_metrics_history").insert({
        content_id: data.id,
        views: data.views,
        likes: data.likes,
        comments: data.comments,
        watch_time_seconds: data.watchTimeSeconds,
        engagement_rate: data.engagementRate,
        recorded_at: now,
      });
    }

    // Construct audit changes diff
    const changes: Record<string, { old: any; new: any }> = {};
    if (data.title !== oldRow.title) changes.title = { old: oldRow.title, new: data.title };
    if (data.url !== oldRow.url) changes.url = { old: oldRow.url, new: data.url };
    if (data.platform !== oldRow.platform_id) changes.platform = { old: oldRow.platform_id, new: data.platform };
    if (data.status !== oldRow.status) changes.status = { old: oldRow.status, new: data.status };
    if (data.thumbnailUrl !== oldRow.thumbnail_url) changes.thumbnailUrl = { old: oldRow.thumbnail_url, new: data.thumbnailUrl };
    if (data.notes !== oldRow.notes) changes.notes = { old: oldRow.notes, new: data.notes };

    if (data.views !== oldViews) changes.views = { old: oldViews, new: data.views };
    if (data.likes !== oldLikes) changes.likes = { old: oldLikes, new: data.likes };
    if (data.comments !== oldComments) changes.comments = { old: oldComments, new: data.comments };
    if (data.watchTimeSeconds !== oldWatchTime) changes.watchTimeSeconds = { old: oldWatchTime, new: data.watchTimeSeconds };
    if (data.engagementRate !== oldEngagement) changes.engagementRate = { old: oldEngagement, new: data.engagementRate };
    if (data.syncStatus !== oldMetrics?.sync_status) changes.syncStatus = { old: oldMetrics?.sync_status, new: data.syncStatus };
    if (manualOverrideToSet !== oldMetrics?.manual_override) changes.manualOverride = { old: oldMetrics?.manual_override, new: manualOverrideToSet };

    if (Object.keys(changes).length > 0) {
      await supabaseAdmin.from("audit_logs").insert({
        actor_id: userId,
        action: "admin_edit_content",
        entity_type: "content",
        entity_id: data.id,
        metadata: {
          changes,
          old_values: {
            title: oldRow.title,
            url: oldRow.url,
            platform: oldRow.platform_id,
            status: oldRow.status,
            thumbnailUrl: oldRow.thumbnail_url,
            notes: oldRow.notes,
            views: oldViews,
            likes: oldLikes,
            comments: oldComments,
            watchTimeSeconds: oldWatchTime,
            engagementRate: oldEngagement,
            syncStatus: oldMetrics?.sync_status,
            manualOverride: oldMetrics?.manual_override,
          },
          new_values: data
        }
      });
    }

    return { ok: true };
  });

/** Duplicate a video link and its metrics. Admin only. */
export const adminDuplicateContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch original content and metrics
    const { data: original, error: fetchErr } = await supabaseAdmin
      .from("content")
      .select("*, metrics:content_metrics(*)")
      .eq("id", data.id)
      .maybeSingle();

    if (fetchErr || !original) throw new Error("Original content not found");

    const newContentId = crypto.randomUUID();

    // Insert duplicated content row
    const { error: contentErr } = await supabaseAdmin.from("content").insert({
      id: newContentId,
      user_id: original.user_id,
      group_id: original.group_id,
      platform_id: original.platform_id,
      title: original.title ? `${original.title} (Copy)` : "Untitled Content (Copy)",
      url: original.url,
      content_type: original.content_type,
      status: original.status,
      thumbnail_url: original.thumbnail_url,
      published_at: original.published_at,
      duration_seconds: original.duration_seconds,
      notes: original.notes,
    });

    if (contentErr) throw new Error(contentErr.message);

    // Insert duplicated metrics row
    const originalMetrics = Array.isArray(original.metrics) ? original.metrics[0] : original.metrics;
    const { error: metricsErr } = await supabaseAdmin.from("content_metrics").insert({
      content_id: newContentId,
      views: originalMetrics?.views ?? 0,
      likes: originalMetrics?.likes ?? 0,
      comments: originalMetrics?.comments ?? 0,
      watch_time_seconds: originalMetrics?.watch_time_seconds ?? 0,
      engagement_rate: originalMetrics?.engagement_rate ?? 0.00,
      sync_status: originalMetrics?.sync_status ?? "idle",
      api_error: originalMetrics?.api_error,
    });

    if (metricsErr) throw new Error(metricsErr.message);

    // Log action
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "admin_duplicate_content",
      entity_type: "content",
      entity_id: newContentId,
      metadata: { original_id: data.id }
    });

    return { ok: true, id: newContentId };
  });

/** Soft-restore a deleted content link. Admin only. */
export const adminRestoreContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("content")
      .update({ deleted_at: null, updated_at: new Date().toISOString() })
      .eq("id", data.id);

    if (error) throw new Error(error.message);

    // Log action
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "admin_restore_content",
      entity_type: "content",
      entity_id: data.id,
      metadata: { restored_at: new Date().toISOString() }
    });

    return { ok: true };
  });

/** Bulk soft-restore deleted content links. Admin only. */
export const adminBulkRestore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("content")
      .update({ deleted_at: null, updated_at: new Date().toISOString() })
      .in("id", data.ids);

    if (error) throw new Error(error.message);

    // Log action
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "admin_bulk_restore_content",
      entity_type: "content",
      metadata: { restored_ids: data.ids }
    });

    return { ok: true };
  });

/** Bulk modify platform for content links. Admin only. */
export const adminBulkPlatformChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      ids: z.array(z.string().uuid()),
      platformId: z.string(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("content")
      .update({ platform_id: data.platformId, updated_at: new Date().toISOString() })
      .in("id", data.ids);

    if (error) throw new Error(error.message);

    // Log action
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "admin_bulk_platform_change",
      entity_type: "content",
      metadata: { target_platform: data.platformId, modified_ids: data.ids }
    });

    return { ok: true };
  });

