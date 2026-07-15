import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Group = Database["public"]["Tables"]["groups"]["Row"];
export type VideoLink = Database["public"]["Tables"]["video_links"]["Row"];
export type Content = Database["public"]["Tables"]["content"]["Row"];
export type ContentMetrics = Database["public"]["Tables"]["content_metrics"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type ContentWithMetrics = Content & {
  metrics?: ContentMetrics | ContentMetrics[] | null;
};

export function mapContentToVideoLink(row: ContentWithMetrics): VideoLink {
  const metrics = Array.isArray(row.metrics) ? row.metrics[0] : row.metrics;

  return {
    id: row.id,
    group_id: row.group_id ?? "",
    title: row.title,
    url: row.url,
    platform: row.platform_id as VideoLink["platform"],
    status: row.status as VideoLink["status"],
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
    sync_status: (metrics?.sync_status ?? "idle") as VideoLink["sync_status"],
    api_error: metrics?.api_error ?? null,
  };
}

export function useMyGroup(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-group", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("created_by", userId!)
        .order("created_at", { ascending: true })
        .maybeSingle();
      if (error) throw error;
      return data as Group | null;
    },
  });
}

export function useGroup(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId!)
        .maybeSingle();
      if (error) throw error;
      return data as Group | null;
    },
  });
}

export function useAllGroups() {
  return useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Group[];
    },
  });
}

export function useVideoLinks(groupId: string | undefined) {
  return useQuery({
    queryKey: ["video-links", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("*, metrics:content_metrics(*)")
        .eq("group_id", groupId!)
        .eq("content_type", "video")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as ContentWithMetrics[]).map(mapContentToVideoLink);
    },
  });
}

export function useAllVideoLinks() {
  return useQuery({
    queryKey: ["video-links-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("*, metrics:content_metrics(*)")
        .eq("content_type", "video")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as ContentWithMetrics[]).map(mapContentToVideoLink);
    },
  });
}

export function useAllProfiles(enabled: boolean) {
  return useQuery({
    queryKey: ["profiles-all"],
    enabled,
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) throw error;
      const roleMap = new Map<string, string[]>();
      (roles ?? []).forEach((r) => {
        const list = roleMap.get(r.user_id) ?? [];
        list.push(r.role);
        roleMap.set(r.user_id, list);
      });
      return (profiles ?? []).map((p) => ({
        ...(p as ProfileRow),
        roles: roleMap.get(p.id) ?? [],
      }));
    },
  });
}

export function useAdminDashboardData() {
  return useQuery({
    queryKey: ["admin-dashboard-data"],
    queryFn: async () => {
      const [
        { data: profiles, error: profilesError },
        { data: groups, error: groupsError },
        { data: videos, error: videosError },
        { data: analyticsSummary, error: analyticsSummaryError },
        { data: topVideos, error: topVideosError },
        { data: historyData, error: historyError },
        { data: membershipRows, error: membershipsError },
        { data: roles, error: rolesError },
      ] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("groups").select("*").order("created_at", { ascending: false }),
        supabase.from("video_links").select("*").order("created_at", { ascending: false }),
        supabase.from("group_analytics_summary").select("*"),
        supabase.from("top_videos").select("*").limit(10),
        supabase.from("video_metrics_history").select("*").order("recorded_at", { ascending: true }),
        supabase.from("group_members").select("invitation_status"),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      if (profilesError) throw profilesError;
      if (groupsError) throw groupsError;
      if (videosError) throw videosError;
      if (analyticsSummaryError) throw analyticsSummaryError;
      if (topVideosError) throw topVideosError;
      if (historyError) throw historyError;
      if (membershipsError) throw membershipsError;
      if (rolesError) throw rolesError;

      const roleMap = new Map<string, string[]>();
      (roles ?? []).forEach((role) => {
        const list = roleMap.get(role.user_id) ?? [];
        list.push(role.role);
        roleMap.set(role.user_id, list);
      });

      const profilesWithRoles = (profiles ?? []).map((profile) => ({
        ...(profile as ProfileRow),
        roles: roleMap.get(profile.id) ?? [],
      }));

      const acceptedMembers = (membershipRows ?? []).filter((row: any) => row.invitation_status === "accepted").length;

      return {
        profiles: profilesWithRoles,
        groups: (groups ?? []) as Group[],
        videos: (videos ?? []) as VideoLink[],
        analyticsSummary: (analyticsSummary ?? []) as GroupAnalyticsSummary[],
        topVideos: (topVideos ?? []) as TopVideoRow[],
        historyData: (historyData ?? []) as VideoMetricsHistory[],
        totalMembers: acceptedMembers,
        pendingInvitations: (membershipRows ?? []).filter((row: any) => row.invitation_status === "pending").length,
        activeCollaborations: acceptedMembers,
        hasStoredAnalytics: (videos ?? []).some((video: VideoLink) =>
          video.last_view_count !== null || video.last_like_count !== null || video.last_comment_count !== null || video.last_fetched_at !== null,
        ),
      };
    },
  });
}

export type GroupMember = Database["public"]["Tables"]["group_members"]["Row"];

export function useAllGroupMembers() {
  return useQuery({
    queryKey: ["admin-group-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("*, group:groups(team_name)")
        .order("invited_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<GroupMember & { group?: { team_name: string | null } }>;
    },
  });
}

export function useGroupMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group-members", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("*")
        .eq("group_id", groupId!)
        .order("role", { ascending: false })
        .order("invited_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as GroupMember[];
    },
  });
}

export function useMyMemberships(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-memberships", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("*, group:groups(*)")
        .eq("user_id", userId!)
        .eq("invitation_status", "accepted");
      if (error) throw error;
      return data as (GroupMember & { group: Group })[];
    },
  });
}

export function usePendingInvitations(email: string | undefined) {
  return useQuery({
    queryKey: ["pending-invitations", email],
    enabled: !!email,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("*, group:groups(*)")
        .eq("email", email!.toLowerCase())
        .eq("invitation_status", "pending");
      if (error) throw error;
      return data as (GroupMember & { group: Group })[];
    },
  });
}

export type GroupAnalyticsSummary = Database["public"]["Views"]["group_analytics_summary"]["Row"];
export type TopVideoRow = Database["public"]["Views"]["top_videos"]["Row"];
export type VideoMetricsHistory = Database["public"]["Tables"]["video_metrics_history"]["Row"];

export function useVideoMetricsHistory(videoLinkId: string | undefined) {
  return useQuery({
    queryKey: ["video-metrics-history", videoLinkId],
    enabled: !!videoLinkId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_metrics_history")
        .select("*")
        .eq("video_link_id", videoLinkId!)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return data as VideoMetricsHistory[];
    },
  });
}

export function useGroupAnalyticsSummary(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group-analytics-summary", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_analytics_summary")
        .select("*")
        .eq("group_id", groupId!)
        .maybeSingle();
      if (error) throw error;
      return data as GroupAnalyticsSummary | null;
    },
  });
}

export function useAdminAnalyticsSummary() {
  return useQuery({
    queryKey: ["admin-analytics-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_analytics_summary")
        .select("*");
      if (error) throw error;
      return data as GroupAnalyticsSummary[];
    },
  });
}

export function useTopVideos(limit: number = 10) {
  return useQuery({
    queryKey: ["top-videos", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("top_videos")
        .select("*")
        .limit(limit);
      if (error) throw error;
      return data as TopVideoRow[];
    },
  });
}

export function useAllVideoMetricsHistory() {
  return useQuery({
    queryKey: ["all-video-metrics-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_metrics_history")
        .select("*, video_link:video_links(group_id, title)")
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return data as (VideoMetricsHistory & { video_link: { group_id: string; title: string | null } })[];
    },
  });
}

export function useGroupMetricsHistory(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group-metrics-history", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_metrics_history")
        .select("views, recorded_at, video_link_id, video_links!inner(group_id)")
        .eq("video_links.group_id", groupId!)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}


