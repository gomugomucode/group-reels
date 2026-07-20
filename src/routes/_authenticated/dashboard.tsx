import { useMemo, useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Video,
  Users,
  Plus,
  ArrowRight,
  Search,
  ExternalLink,
  Check,
  X,
  Pencil,
  Trash2,
  Eye,
  ThumbsUp,
  TrendingUp,
  BarChart3,
  Trophy,
  Copy,
  Link2,
  Mail,
  RefreshCw,
  MessageSquare,
  Layers,
  Heart,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { CreatorInsights } from "@/components/creator-insights";
import { useAuth } from "@/hooks/use-auth";
import {
  useMyGroup,
  useVideoLinks,
  useMyMemberships,
  usePendingInvitations,
  useGroupMembers,
  useGroupMetricsHistory,
  useTopVideos,
  useActivityFeed,
  useGroupLeaderboard,
} from "@/hooks/use-data";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { VideoLinkDialog } from "@/components/video-link-dialog";
import { Button } from "@/components/ui/button";
import { VideoThumbnail } from "@/components/video-thumbnail";
import { VideoStatsBadge } from "@/components/video-stats-badge";
import { SyncStatusBadge } from "@/components/sync-status-badge";
import { RefreshButton } from "@/components/refresh-button";
import { ContentDetailDialog } from "@/components/content-detail-dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { friendlyError } from "@/lib/error-messages";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLATFORMS, PLATFORM_LABELS } from "@/lib/video-platforms";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCount } from "@/lib/youtube";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvitation, rejectInvitation } from "@/lib/group-collaboration.functions";
import { type VideoLink, useSyncGroupAnalytics } from "@/hooks/use-data";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();

  useEffect(() => {
    if (isAdmin) {
      navigate({ to: "/admin", replace: true });
    }
  }, [isAdmin, navigate]);

  const [editingLink, setEditingLink] = useState<VideoLink | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailVideo, setDetailVideo] = useState<VideoLink | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: ownedGroup, isLoading: ownedLoading } = useMyGroup(user?.id);
  const { data: memberships = [], isLoading: membershipsLoading } = useMyMemberships(user?.id);
  const { data: invites = [], isLoading: invitesLoading } = usePendingInvitations(profile?.email);
  const { data: topVideos = [], isLoading: topVideosLoading } = useTopVideos(5);
  const { data: topGroups = [], isLoading: leaderboardLoading } = useGroupLeaderboard();
  const { data: activityFeed = [], isLoading: activityLoading } = useActivityFeed();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const allGroups = useMemo(() => {
    const list = [...memberships.map((m) => m.group)].filter(Boolean);
    if (ownedGroup && !list.some((g) => g.id === ownedGroup.id)) {
      list.unshift(ownedGroup);
    }
    return list;
  }, [ownedGroup, memberships]);

  const activeGroupId = selectedGroupId || ownedGroup?.id || memberships[0]?.group_id || null;
  const activeGroup = allGroups.find((g) => g.id === activeGroupId) || null;

  const activeMembership = memberships.find((m) => m.group_id === activeGroupId) || null;
  const groupRole = activeGroup?.created_by === user?.id ? "owner" : activeMembership?.role || null;

  const { data: videos = [], isLoading: videosLoading } = useVideoLinks(activeGroup?.id);
  const { data: activeMembers = [] } = useGroupMembers(activeGroup?.id);
  const { data: metricsHistory = [] } = useGroupMetricsHistory(activeGroup?.id);

  const syncMutation = useSyncGroupAnalytics();
  const handleRefreshAnalytics = async () => {
    if (!activeGroupId) return;
    const toastId = toast.loading("Syncing group analytics...");
    try {
      await syncMutation.mutateAsync({ groupId: activeGroupId, force: true });
      toast.success("Analytics synced successfully!", { id: toastId });
    } catch (e: any) {
      toast.error(e.message || "Failed to sync", { id: toastId });
    }
  };

  const handleDuplicate = async (v: VideoLink) => {
    setEditingLink({
      ...v,
      id: "", // Blank ID instructs the dialog to perform an INSERT
    });
    setDialogOpen(true);
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  };

  const teamRank = useMemo(() => {
    if (!activeGroupId || !topGroups) return "—";
    const sorted = [...topGroups].sort((a, b) => b.total_views - a.total_views);
    const index = sorted.findIndex((g) => g.group_id === activeGroupId);
    return index !== -1 ? `#${index + 1}` : "—";
  }, [topGroups, activeGroupId]);

  const teamStats = useMemo(() => {
    let views = 0;
    let likes = 0;
    let comments = 0;
    videos.forEach((v) => {
      views += v.last_view_count || 0;
      likes += v.last_like_count || 0;
      comments += v.last_comment_count || 0;
    });
    return {
      views,
      likes,
      comments,
      videosCount: videos.length,
      membersCount: activeMembers.filter((m) => m.invitation_status === "accepted").length || activeGroup?.member_names?.length || 0,
    };
  }, [videos, activeMembers, activeGroup]);

  // Chart data 1: Views by Platform Bar Chart
  const viewsByPlatformData = useMemo(() => {
    const viewsMap: Record<string, number> = { youtube: 0, tiktok: 0, instagram: 0, facebook: 0 };
    videos.forEach((v) => {
      viewsMap[v.platform] = (viewsMap[v.platform] || 0) + (v.last_view_count || 0);
    });
    return Object.entries(viewsMap).map(([platform, count]) => ({
      platform: PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS] || platform,
      views: count
    }));
  }, [videos]);

  // Chart data 2: Platform Distribution Pie Chart
  const platformDistributionData = useMemo(() => {
    const counts: Record<string, number> = {};
    videos.forEach((v) => {
      counts[v.platform] = (counts[v.platform] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: PLATFORM_LABELS[name as keyof typeof PLATFORM_LABELS] || name,
      value
    }));
  }, [videos]);

  const teamActivities = useMemo(() => {
    return activityFeed.filter((event: any) => {
      if (event.metadata?.group_id === activeGroupId) return true;
      if (activeGroup?.team_name && (
        (event.title ?? "").includes(activeGroup.team_name) ||
        (event.description ?? "").includes(activeGroup.team_name)
      )) return true;
      return false;
    });
  }, [activityFeed, activeGroupId, activeGroup]);

  const COLORS = ['#ef4444', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#6366f1'];

  const acceptFn = useServerFn(acceptInvitation);
  const rejectFn = useServerFn(rejectInvitation);

  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");

  const handleAccept = async (inviteId: string) => {
    try {
      await acceptFn({ data: { memberId: inviteId } });
      toast.success("Invitation accepted!");
      qc.invalidateQueries();
    } catch (e: any) {
      console.error("[AcceptInvite] error:", e);
      toast.error(friendlyError(e));
    }
  };

  const handleReject = async (inviteId: string) => {
    try {
      await rejectFn({ data: { memberId: inviteId } });
      toast.success("Invitation rejected");
      qc.invalidateQueries();
    } catch (e: any) {
      console.error("[RejectInvite] error:", e);
      toast.error(friendlyError(e));
    }
  };

  const filtered = useMemo(() => {
    return videos.filter((v) => {
      const matchSearch =
        !search ||
        (v.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
        v.url.toLowerCase().includes(search.toLowerCase());
      const matchPlatform = platform === "all" || v.platform === platform;
      
      const matchStatus =
        status === "all" ||
        (status === "pending" && (v.sync_status === "idle" || (v.sync_status as string) === "pending")) ||
        v.sync_status === status ||
        (status === "unsupported" && v.sync_status === "error" && v.api_error === "Platform analytics not supported without OAuth") ||
        (status === "failed" && v.sync_status === "error" && v.api_error !== "Platform analytics not supported without OAuth");

      return matchSearch && matchPlatform && matchStatus;
    });
  }, [videos, search, platform, status]);

  const membersCount = useMemo(() => {
    if (!activeGroup) return 0;
    const acceptedCount = activeMembers.filter((m) => m.invitation_status === "accepted").length;
    return acceptedCount > 0 ? acceptedCount : activeGroup.member_names.length;
  }, [activeGroup, activeMembers]);

  /** Compute today's view growth % from content_metrics_history */
  const todaysGrowth = useMemo(() => {
    if (metricsHistory.length === 0) return null;
    const oneDayAgoMs = Date.now() - 24 * 60 * 60 * 1000;

    // Group history entries by video id
    const byVideo: Record<string, typeof metricsHistory> = {};
    metricsHistory.forEach((h: any) => {
      const key = h.video_link_id as string;
      if (!byVideo[key]) byVideo[key] = [];
      byVideo[key].push(h);
    });

    let totalLatest = 0;
    let totalBaseline = 0;

    Object.values(byVideo).forEach((entries) => {
      const sorted = [...entries].sort(
        (a: any, b: any) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
      );
      if (sorted.length === 0) return;
      const latest = sorted[sorted.length - 1];
      const baseline =
        sorted.find((e: any) => new Date(e.recorded_at).getTime() >= oneDayAgoMs) || sorted[0];
      totalLatest += latest.views ?? 0;
      totalBaseline += baseline.views ?? 0;
    });

    if (totalBaseline === 0) return null;
    const pct = ((totalLatest - totalBaseline) / totalBaseline) * 100;
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}%`;
  }, [metricsHistory]);

  const isLoading = ownedLoading || membershipsLoading || invitesLoading || videosLoading;

  return (
    <AppLayout>
      {/* Welcome & Switcher Header */}
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Welcome back, {profile?.username ?? "there"}!
          </h1>
          {activeGroup && (
            <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5">
              Workspace of team <span className="font-semibold text-primary">{activeGroup.team_name}</span> ({groupRole})
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {allGroups.length > 1 && (
            <Select value={activeGroupId || ""} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="w-56 bg-card border border-border">
                <SelectValue placeholder="Switch team..." />
              </SelectTrigger>
              <SelectContent>
                {allGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.team_name} {g.created_by === user?.id ? "(Owner)" : "(Member)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Pending invitations */}
      {invites.length > 0 && (
        <div className="mb-8 rounded-2xl border border-border bg-card p-5 animate-in fade-in-50 duration-200">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="size-5 text-primary" /> Pending Team Invitations ({invites.length})
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            You have been invited to collaborate with these teams.
          </p>
          <div className="mt-4 space-y-3">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-4"
              >
                <div>
                  <p className="font-semibold text-foreground">
                    {invite.group?.team_name || "Unknown Team"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Role: <span className="capitalize font-medium text-foreground">{invite.role}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-success text-success-foreground hover:bg-success/90"
                    onClick={() => handleAccept(invite.id)}
                  >
                    <Check className="mr-1 size-4" /> Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleReject(invite.id)}
                  >
                    <X className="mr-1 size-4" /> Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main dashboard content */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl animate-pulse" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-2xl animate-pulse" />
        </div>
      ) : allGroups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Create your team group"
          description="Set up your group to start tracking your team's social media content."
          cta={
            <Button onClick={() => navigate({ to: "/groups/new" })}>
              <Plus className="mr-1.5 size-4" /> Create group
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column: Stats, Actions, Charts & Videos Table */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions Panel */}
            <Card className="p-4 bg-card border border-border">
              <CardHeader className="p-0 mb-3.5">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <TrendingUp className="size-4 text-primary" /> Team Quick Actions
                </CardTitle>
              </CardHeader>
              <div className="flex flex-wrap gap-2.5">
                <Button asChild size="sm" variant="outline" className="h-9 gap-1.5">
                  <Link to="/groups/new">
                    <Plus className="size-3.5" />
                    <span>Create Team</span>
                  </Link>
                </Button>
                {activeGroup && (
                  <>
                    <Button asChild size="sm" variant="outline" className="h-9 gap-1.5">
                      <Link to="/groups/$id" params={{ id: activeGroup.id }}>
                        <Pencil className="size-3.5" />
                        <span>Edit Team</span>
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="h-9 gap-1.5">
                      <Link to="/groups/$id" params={{ id: activeGroup.id }}>
                        <Mail className="size-3.5" />
                        <span>Invite Member</span>
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      className="h-9 gap-1.5"
                      onClick={() => {
                        setEditingLink(null);
                        setDialogOpen(true);
                      }}
                    >
                      <Video className="size-3.5" />
                      <span>Add Content</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 gap-1.5"
                      onClick={handleRefreshAnalytics}
                      disabled={syncMutation.isPending}
                    >
                      <RefreshCw className={`size-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                      <span>Refresh Analytics</span>
                    </Button>
                  </>
                )}
              </div>
            </Card>

            {/* Team statistics cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Card className="p-3 relative border-amber-500/20 bg-amber-500/5 text-amber-500">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider">
                  <span>Team Rank</span>
                  <Trophy className="size-4" />
                </div>
                <p className="text-2xl font-bold mt-1.5 font-mono">{teamRank}</p>
              </Card>
              <StatCard label="Total Members" value={teamStats.membersCount.toString()} icon={<Users className="size-4" />} />
              <StatCard label="Uploaded Videos" value={teamStats.videosCount.toString()} icon={<Video className="size-4 text-success" />} />
              <StatCard label="Total Views" value={teamStats.views.toLocaleString()} icon={<Eye className="size-4" />} />
              <StatCard label="Total Likes" value={teamStats.likes.toLocaleString()} icon={<ThumbsUp className="size-4 text-rose-500" />} />
              <StatCard label="Total Comments" value={teamStats.comments.toLocaleString()} icon={<MessageSquare className="size-4 text-primary" />} />
            </div>

            {/* Core Two Charts */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Platform Distribution Pie Chart */}
              <Card className="p-5 bg-card border border-border">
                <CardHeader className="p-0 mb-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="size-4 text-accent" /> Platform Distribution
                  </CardTitle>
                </CardHeader>
                <div className="h-64">
                  {platformDistributionData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No platform distribution data.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={platformDistributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {platformDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <ChartTooltip
                           contentStyle={{
                              background: "var(--color-popover)",
                              border: "1px solid var(--color-border)",
                              borderRadius: 8,
                              color: "var(--color-popover-foreground)",
                              fontSize: 11,
                            }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>

              {/* Views by Platform Bar Chart */}
              <Card className="p-5 bg-card border border-border">
                <CardHeader className="p-0 mb-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="size-4 text-success" /> Views by Platform
                  </CardTitle>
                </CardHeader>
                <div className="h-64">
                  {viewsByPlatformData.every(d => d.views === 0) ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No view statistics yet.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={viewsByPlatformData}>
                        <defs>
                          <linearGradient id="creatorBarGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.9}/>
                            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                        <XAxis dataKey="platform" stroke="var(--color-muted-foreground)" fontSize={10} />
                        <YAxis stroke="var(--color-muted-foreground)" fontSize={10} tickFormatter={(v) => formatCount(v)} />
                        <ChartTooltip
                          contentStyle={{
                            background: "var(--color-popover)",
                            border: "1px solid var(--color-border)",
                            borderRadius: 8,
                            color: "var(--color-popover-foreground)",
                            fontSize: 11,
                          }}
                          formatter={(v: any) => [`${v.toLocaleString()} views`, "Views"]}
                        />
                        <Bar dataKey="views" fill="url(#creatorBarGradient)" radius={[6, 6, 0, 0]} isAnimationActive={true} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>
            </div>

            {/* Content library */}
            <div className="rounded-2xl border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                <div>
                  <h2 className="text-lg font-semibold">{activeGroup?.team_name || "Workspace"} Content</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Manage and track your video metrics</p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3 p-4">
                <div className="relative min-w-48 flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search title or URL..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="w-40 bg-background border border-border">
                    <SelectValue placeholder="Platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All platforms</SelectItem>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PLATFORM_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-56 bg-background border border-border">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="syncing">Syncing</SelectItem>
                    <SelectItem value="success">Synced</SelectItem>
                    <SelectItem value="unsupported">Statistics Unavailable</SelectItem>
                    <SelectItem value="failed">Sync Failed</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="deleted">Deleted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Content rows */}
              <div className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <div className="p-6">
                    {videos.length === 0 ? (
                      <EmptyState
                        icon={Video}
                        title="No content yet"
                        description="Click 'Add Content' to start tracking your team's social media content."
                        cta={
                          <Button
                            onClick={() => {
                              setEditingLink(null);
                              setDialogOpen(true);
                            }}
                          >
                            <Plus className="mr-1.5 size-4" /> Add Content
                          </Button>
                        }
                      />
                    ) : (
                      <EmptyState
                        icon={Search}
                        title="No results found"
                        description="We couldn't find any content matching your filters. Try adjusting or clearing them."
                        cta={
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSearch("");
                              setPlatform("all");
                              setStatus("all");
                            }}
                          >
                            Clear filters
                          </Button>
                        }
                      />
                    )}
                  </div>
                ) : (
                  filtered.map((v) => (
                    <div key={v.id} className="flex flex-wrap items-center gap-4 p-4 hover:bg-secondary/20 transition-colors">
                      <VideoThumbnail thumbnailUrl={v.thumbnail_url} platform={v.platform} title={v.title} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground truncate">{v.title || "Untitled Content"}</p>
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border border-border rounded px-1 py-0.5">{v.platform}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-muted-foreground">
                          {v.channel_name && <span>{v.channel_name} • </span>}
                          <a href={v.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground truncate max-w-xs">
                            {v.url} <ExternalLink className="size-3 shrink-0" />
                          </a>
                          <span className="text-[10px]">Added {new Date(v.created_at).toLocaleDateString()}</span>
                        </div>
                        <VideoStatsBadge views={v.last_view_count} likes={v.last_like_count} comments={v.last_comment_count} syncStatus={v.sync_status} apiError={v.api_error} className="mt-2" />
                      </div>
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                        <SyncStatusBadge status={v.sync_status} apiError={v.api_error} lastSynced={v.last_synced} />
                        <div className="flex items-center gap-1">
                          {activeGroupId && (
                            <RefreshButton
                              videoLinkId={v.id}
                              groupId={activeGroupId}
                              lastFetchedAt={v.last_fetched_at}
                              syncStatus={v.sync_status}
                              canRefresh={true}
                            />
                          )}
                          <Button variant="ghost" size="icon" onClick={() => { setDetailVideo(v); setDetailOpen(true); }} title="View Analytics" aria-label="View analytics">
                            <BarChart3 className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setEditingLink(v); setDialogOpen(true); }} title="Edit content" aria-label="Edit content">
                            <Pencil className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDuplicate(v)} title="Duplicate video link">
                            <Copy className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleCopyLink(v.url)} title="Copy video link">
                            <Link2 className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            title="Delete content"
                            aria-label="Delete content"
                            onClick={async () => {
                              if (confirm("Delete this content?")) {
                                const toastId = toast.loading("Deleting content...");
                                try {
                                  const { error } = await supabase
                                    .from("content")
                                    .update({ deleted_at: new Date().toISOString() })
                                    .eq("id", v.id);
                                  if (error) throw error;
                                  toast.success("Content deleted successfully!", { id: toastId });
                                  qc.invalidateQueries({ queryKey: ["video-links"] });
                                  qc.invalidateQueries({ queryKey: ["video-links-all"] });
                                  qc.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
                                  qc.invalidateQueries({ queryKey: ["admin-video-links-list"] });
                                  qc.invalidateQueries({ queryKey: ["group-analytics-summary"] });
                                } catch (err: any) {
                                  console.error("[DeleteContent] error:", err);
                                  toast.error(friendlyError(err), { id: toastId });
                                }
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Collaborators & Timeline activity */}
          <div className="space-y-6">
            {/* Team Members List */}
            <Card className="border border-border bg-card">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Users className="size-5 text-primary" /> Team Members
                </CardTitle>
                <CardDescription className="text-xs">Current creators collaborating on this squad</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-3">
                  {activeMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between text-xs py-1">
                      <div>
                        <p className="font-semibold text-foreground">{member.email}</p>
                        <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{member.role}</p>
                      </div>
                      <Badge variant={member.invitation_status === "accepted" ? "default" : "secondary"} className="text-[10px]">
                        {member.invitation_status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Team Activity Timeline */}
            <Card className="border border-border bg-card">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BarChart3 className="size-5 text-primary" /> Recent Activity
                </CardTitle>
                <CardDescription className="text-xs">Chronological timeline events for your group</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px] overflow-y-auto pr-1 pt-2">
                {activityLoading ? (
                  <div className="space-y-2 p-2">
                    <Skeleton className="h-8 w-full animate-pulse" />
                    <Skeleton className="h-8 w-full animate-pulse" />
                  </div>
                ) : teamActivities.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-8 text-center">No recent activity logs.</p>
                ) : (
                  <div className="space-y-4 p-2 pt-0">
                    {teamActivities.map((event: any) => {
                      const date = new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <div key={event.id} className="flex gap-3 text-xs border-l border-border pl-3 pb-3 relative">
                          <span className="absolute -left-1.5 top-0.5 size-3 rounded-full bg-primary/20 border border-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground truncate">{event.title}</p>
                            <p className="text-muted-foreground text-[10px] mt-0.5">{event.description}</p>
                          </div>
                          <span className="text-[9px] text-muted-foreground shrink-0">{date}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Edit dialog */}
      {dialogOpen && activeGroupId && (
        <VideoLinkDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          groupId={activeGroupId}
          editing={editingLink}
        />
      )}

      {/* Content Detail Analytics */}
      <ContentDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        video={detailVideo}
      />
    </AppLayout>
  );
}
