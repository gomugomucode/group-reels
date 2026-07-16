import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
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
    last_view_count: metrics?.views ?? null,
    last_like_count: metrics?.likes ?? null,
    last_comment_count: metrics?.comments ?? null,
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
    staleTime: 60_000,
    gcTime: 300_000,
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
    staleTime: 60_000,
    gcTime: 300_000,
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
    staleTime: 60_000,
    gcTime: 300_000,
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
    staleTime: 60_000,
    gcTime: 300_000,
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
    staleTime: 60_000,
    gcTime: 300_000,
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
    staleTime: 60_000,
    gcTime: 300_000,
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
    staleTime: 60_000,
    gcTime: 300_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const [
        { data: profiles, error: profilesError },
        { data: groups, error: groupsError },
        { data: contentData, error: contentError },
        { data: historyData, error: historyError },
        { data: membershipRows, error: membershipsError },
        { data: roles, error: rolesError },
      ] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("groups").select("*").order("created_at", { ascending: false }),
        supabase
          .from("content")
          .select("*, metrics:content_metrics(*)")
          .eq("content_type", "video")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("content_metrics_history")
          .select("*, content!inner(group_id)")
          .is("content.deleted_at", null)
          .order("recorded_at", { ascending: true }),
        supabase.from("group_members").select("invitation_status"),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      if (profilesError) throw profilesError;
      if (groupsError) throw groupsError;
      if (contentError) throw contentError;
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
      
      const mappedVideos = ((contentData ?? []) as ContentWithMetrics[]).map(mapContentToVideoLink);

      // Aggregate group analytics summary client-side to remove compatibility view query
      const analyticsSummary = (groups ?? []).map((g) => {
        const groupVideos = mappedVideos.filter((v) => v.group_id === g.id);
        const total_views = groupVideos.reduce((sum, v) => sum + (v.last_view_count ?? 0), 0);
        const total_likes = groupVideos.reduce((sum, v) => sum + (v.last_like_count ?? 0), 0);
        const total_comments = groupVideos.reduce((sum, v) => sum + (v.last_comment_count ?? 0), 0);
        const valid_count = groupVideos.filter((v) => v.status === "valid").length;
        const invalid_count = groupVideos.filter((v) => v.status === "invalid").length;
        const youtube_count = groupVideos.filter((v) => v.platform === "youtube" && v.youtube_video_id !== null).length;
        const last_synced = groupVideos.length > 0 ? groupVideos.map(v => v.last_synced).sort().pop() || null : null;

        return {
          group_id: g.id,
          team_name: g.team_name,
          video_count: groupVideos.length,
          total_views,
          total_likes,
          total_comments,
          last_synced,
          valid_count,
          invalid_count,
          youtube_count,
        };
      });

      // Fetch top videos from mapped videos
      const topVideos = [...mappedVideos]
        .filter((v) => v.last_view_count !== null)
        .sort((a, b) => (b.last_view_count ?? 0) - (a.last_view_count ?? 0))
        .slice(0, 10)
        .map((v) => {
          const grp = (groups ?? []).find((g) => g.id === v.group_id);
          return {
            id: v.id,
            group_id: v.group_id,
            team_name: grp?.team_name ?? null,
            title: v.title,
            url: v.url,
            platform: v.platform,
            youtube_video_id: v.youtube_video_id,
            thumbnail_url: v.thumbnail_url,
            channel_name: null,
            last_view_count: v.last_view_count,
            last_like_count: v.last_like_count,
            last_comment_count: v.last_comment_count,
            last_synced: v.last_synced,
            sync_status: v.sync_status,
          };
        });

      const historicalMetrics = (historyData ?? []).map((h: any) => ({
        id: h.id,
        video_link_id: h.content_id,
        views: h.views,
        likes: h.likes,
        comments: h.comments,
        recorded_at: h.recorded_at,
      }));

      return {
        profiles: profilesWithRoles,
        groups: (groups ?? []) as Group[],
        videos: mappedVideos,
        analyticsSummary,
        topVideos,
        historyData: historicalMetrics,
        totalMembers: acceptedMembers,
        pendingInvitations: (membershipRows ?? []).filter((row: any) => row.invitation_status === "pending").length,
        activeCollaborations: acceptedMembers,
        hasStoredAnalytics: mappedVideos.some((video: VideoLink) =>
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
    staleTime: 60_000,
    gcTime: 300_000,
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
    staleTime: 60_000,
    gcTime: 300_000,
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
    staleTime: 60_000,
    gcTime: 300_000,
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
    staleTime: 60_000,
    gcTime: 300_000,
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

export type GroupAnalyticsSummary = {
  group_id: string;
  team_name: string;
  video_count: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  last_synced: string | null;
  valid_count: number;
  invalid_count: number;
  youtube_count: number;
};

export type TopVideoRow = {
  id: string;
  group_id: string;
  team_name: string | null;
  title: string | null;
  url: string;
  platform: string;
  youtube_video_id: string | null;
  thumbnail_url: string | null;
  channel_name: string | null;
  last_view_count: number | null;
  last_like_count: number | null;
  last_comment_count: number | null;
  last_synced: string | null;
  sync_status: string;
};

export type VideoMetricsHistory = Database["public"]["Tables"]["content_metrics_history"]["Row"];

export function useVideoMetricsHistory(videoLinkId: string | undefined) {
  return useQuery({
    queryKey: ["video-metrics-history", videoLinkId],
    enabled: !!videoLinkId,
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_metrics_history")
        .select("*")
        .eq("content_id", videoLinkId!)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((h) => ({
        id: h.id,
        video_link_id: h.content_id,
        views: h.views,
        likes: h.likes,
        comments: h.comments,
        recorded_at: h.recorded_at,
      })) as any[];
    },
  });
}

export function useGroupAnalyticsSummary(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group-analytics-summary", groupId],
    enabled: !!groupId,
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("*, metrics:content_metrics(*)")
        .eq("group_id", groupId!)
        .eq("content_type", "video")
        .is("deleted_at", null);
      if (error) throw error;

      const videos = (data ?? []) as ContentWithMetrics[];
      const mapped = videos.map(mapContentToVideoLink);
      const total_views = mapped.reduce((sum, v) => sum + (v.last_view_count ?? 0), 0);
      const total_likes = mapped.reduce((sum, v) => sum + (v.last_like_count ?? 0), 0);
      const total_comments = mapped.reduce((sum, v) => sum + (v.last_comment_count ?? 0), 0);
      const video_count = mapped.length;
      const valid_count = mapped.filter((v) => v.status === "valid").length;
      const invalid_count = mapped.filter((v) => v.status === "invalid").length;
      const youtube_count = mapped.filter((v) => v.platform === "youtube" && v.youtube_video_id !== null).length;
      const last_synced = mapped.length > 0 ? mapped.map(v => v.last_synced).sort().pop() || null : null;

      return {
        group_id: groupId!,
        team_name: "", // Will be merged from group info if needed
        video_count,
        total_views,
        total_likes,
        total_comments,
        last_synced,
        valid_count,
        invalid_count,
        youtube_count,
      };
    },
  });
}

export function useAdminAnalyticsSummary() {
  return useQuery({
    queryKey: ["admin-analytics-summary"],
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: async () => {
      const [{ data: groups, error: groupsErr }, { data: content, error: contentErr }] = await Promise.all([
        supabase.from("groups").select("id, team_name"),
        supabase
          .from("content")
          .select("group_id, status, platform_id, external_id, metrics:content_metrics(views, likes, comments, last_synced)")
          .eq("content_type", "video")
          .is("deleted_at", null),
      ]);
      if (groupsErr) throw groupsErr;
      if (contentErr) throw contentErr;

      const mappedVideos = ((content ?? []) as ContentWithMetrics[]).map(mapContentToVideoLink);

      return (groups ?? []).map((g) => {
        const groupVideos = mappedVideos.filter((v) => v.group_id === g.id);
        const total_views = groupVideos.reduce((sum, v) => sum + (v.last_view_count ?? 0), 0);
        const total_likes = groupVideos.reduce((sum, v) => sum + (v.last_like_count ?? 0), 0);
        const total_comments = groupVideos.reduce((sum, v) => sum + (v.last_comment_count ?? 0), 0);
        const valid_count = groupVideos.filter((v) => v.status === "valid").length;
        const invalid_count = groupVideos.filter((v) => v.status === "invalid").length;
        const youtube_count = groupVideos.filter((v) => v.platform === "youtube" && v.youtube_video_id !== null).length;
        const last_synced = groupVideos.length > 0 ? groupVideos.map(v => v.last_synced).sort().pop() || null : null;

        return {
          group_id: g.id,
          team_name: g.team_name,
          video_count: groupVideos.length,
          total_views,
          total_likes,
          total_comments,
          last_synced,
          valid_count,
          invalid_count,
          youtube_count,
        };
      });
    },
  });
}

export function useTopVideos(limit: number = 10) {
  return useQuery({
    queryKey: ["top-videos", limit],
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_metrics")
        .select("*, content!inner(*, group:groups(team_name))")
        .is("content.deleted_at", null)
        .order("views", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((m: any) => {
        const c = m.content;
        return {
          id: c.id,
          group_id: c.group_id,
          team_name: c.group?.team_name ?? null,
          title: c.title,
          url: c.url,
          platform: c.platform_id,
          youtube_video_id: c.external_id,
          thumbnail_url: c.thumbnail_url,
          channel_name: null,
          last_view_count: m.views,
          last_like_count: m.likes,
          last_comment_count: m.comments,
          last_synced: m.last_synced,
          sync_status: m.sync_status,
        };
      }) as any[];
    },
  });
}

export function useAllVideoMetricsHistory() {
  return useQuery({
    queryKey: ["all-video-metrics-history"],
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_metrics_history")
        .select("*, content!inner(group_id, title)")
        .is("content.deleted_at", null)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((h: any) => ({
        id: h.id,
        video_link_id: h.content_id,
        views: h.views,
        likes: h.likes,
        comments: h.comments,
        recorded_at: h.recorded_at,
        video_link: {
          group_id: h.content.group_id,
          title: h.content.title,
        },
      })) as any[];
    },
  });
}

export function useGroupMetricsHistory(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group-metrics-history", groupId],
    enabled: !!groupId,
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_metrics_history")
        .select("views, recorded_at, content_id, content!inner(group_id)")
        .eq("content.group_id", groupId!)
        .is("content.deleted_at", null)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((h: any) => ({
        views: h.views,
        recorded_at: h.recorded_at,
        video_link_id: h.content_id,
        video_links: {
          group_id: h.content.group_id,
        },
      })) as any[];
    },
  });
}

// -----------------------------------------------------------------------------
// Mutations for Analytics Sync
// -----------------------------------------------------------------------------
import { syncVideoAnalytics, syncGroupAnalytics } from "@/lib/analytics.functions";

export function useInvalidateAnalytics() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["video-links"] });
    queryClient.invalidateQueries({ queryKey: ["video-links-all"] });
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
    queryClient.invalidateQueries({ queryKey: ["admin-video-links-list"] });
    queryClient.invalidateQueries({ queryKey: ["group-analytics-summary"] });
    queryClient.invalidateQueries({ queryKey: ["admin-analytics-summary"] });
    queryClient.invalidateQueries({ queryKey: ["top-videos"] });
    queryClient.invalidateQueries({ queryKey: ["video-metrics-history"] });
    queryClient.invalidateQueries({ queryKey: ["all-video-metrics-history"] });
    queryClient.invalidateQueries({ queryKey: ["group-metrics-history"] });
  };
}

export function useSyncVideoAnalytics() {
  const invalidate = useInvalidateAnalytics();
  return useMutation({
    mutationFn: async (params: { videoLinkId: string; force?: boolean }) => {
      return await syncVideoAnalytics({ data: params });
    },
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useSyncGroupAnalytics() {
  const invalidate = useInvalidateAnalytics();
  return useMutation({
    mutationFn: async (params: { groupId: string; force?: boolean }) => {
      return await syncGroupAnalytics({ data: params });
    },
    onSuccess: () => {
      invalidate();
    },
  });
}
