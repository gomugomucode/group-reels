import { useMemo, useState } from "react";
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
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import {
  useMyGroup,
  useVideoLinks,
  useMyMemberships,
  usePendingInvitations,
  useGroupMembers,
  useGroupMetricsHistory,
} from "@/hooks/use-data";
import { StatCard } from "@/components/stat-card";
import { VideoLinkDialog } from "@/components/video-link-dialog";
import { Button } from "@/components/ui/button";
import { VideoThumbnail } from "@/components/video-thumbnail";
import { VideoStatsBadge } from "@/components/video-stats-badge";
import { SyncStatusBadge } from "@/components/sync-status-badge";
import { RefreshButton } from "@/components/refresh-button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLATFORMS, PLATFORM_LABELS } from "@/lib/video-platforms";
import { Skeleton } from "@/components/ui/skeleton";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvitation, rejectInvitation } from "@/lib/group-collaboration.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const [editingLink, setEditingLink] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: ownedGroup, isLoading: ownedLoading } = useMyGroup(user?.id);
  const { data: memberships = [], isLoading: membershipsLoading } = useMyMemberships(user?.id);
  const { data: invites = [], isLoading: invitesLoading } = usePendingInvitations(profile?.email);

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
      toast.error(e.message || "Failed to accept invitation");
    }
  };

  const handleReject = async (inviteId: string) => {
    try {
      await rejectFn({ data: { memberId: inviteId } });
      toast.success("Invitation rejected");
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message || "Failed to reject invitation");
    }
  };

  const filtered = useMemo(() => {
    return videos.filter((v) => {
      const matchSearch =
        !search ||
        (v.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
        v.url.toLowerCase().includes(search.toLowerCase());
      const matchPlatform = platform === "all" || v.platform === platform;
      const matchStatus = status === "all" || v.status === status;
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
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back, {profile?.username ?? "there"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {isAdmin
              ? "You have admin access. Manage everything from the Admin dashboard."
              : "Manage your team's social profiles and content."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {allGroups.length > 1 && (
            <Select value={activeGroupId || ""} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="w-56">
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
          {activeGroup && (
            <div className="flex flex-wrap gap-2">
              {isAdmin && (
                <Button asChild variant="outline">
                  <Link to="/admin">
                    Open admin panel <ArrowRight className="ml-1 size-4" />
                  </Link>
                </Button>
              )}
              <Button asChild>
                <Link to="/groups/$id" params={{ id: activeGroup.id }}>
                  Open group page <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>
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

      {/* Main content */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : allGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Users className="size-7" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">Create your team group</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            Set up your group to start tracking your team's social media content.
          </p>
          <Button className="mt-6" onClick={() => navigate({ to: "/groups/new" })}>
            <Plus className="mr-1 size-4" /> Create group
          </Button>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Content"
              value={videos.length}
              icon={<Video className="size-4" />}
              accent
            />
            <StatCard
              label="Total Views"
              value={videos.reduce((acc, v) => acc + (v.last_view_count || 0), 0).toLocaleString()}
              icon={<Eye className="size-4" />}
            />
            <StatCard
              label="Total Likes"
              value={videos.reduce((acc, v) => acc + (v.last_like_count || 0), 0).toLocaleString()}
              icon={<ThumbsUp className="size-4" />}
            />
            <StatCard
              label="Today's Growth"
              value={todaysGrowth ?? "+0%"}
              icon={<TrendingUp className="size-4 text-success" />}
            />
          </div>

          {/* Content library */}
          <div className="mt-8 rounded-2xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 className="text-lg font-semibold">{activeGroup?.team_name || "Workspace"}</h2>
                <p className="text-sm text-muted-foreground">Recent Content</p>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild size="sm">
                  <Link to="/content/new">
                    <Plus className="mr-1 size-4" /> Add Content
                  </Link>
                </Button>
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
                <SelectTrigger className="w-40">
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
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="valid">Valid</SelectItem>
                  <SelectItem value="invalid">Invalid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Content rows */}
            <div className="divide-y divide-border">
              {filtered.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-muted-foreground">
                    {videos.length === 0
                      ? "No content yet. Click 'Add Content' to get started."
                      : "No content matches your filters."}
                  </p>
                </div>
              ) : (
                filtered.map((v) => (
                  <div key={v.id} className="flex flex-wrap items-center gap-4 p-4 hover:bg-secondary/20 transition-colors">
                    <VideoThumbnail thumbnailUrl={v.thumbnail_url} platform={v.platform} title={v.title} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{v.title || "Untitled content"}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-muted-foreground">
                        {v.channel_name && <span>{v.channel_name} • </span>}
                        <a href={v.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground truncate">
                          {v.url} <ExternalLink className="size-3 shrink-0" />
                        </a>
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
                        <Button variant="ghost" size="icon" onClick={() => { setEditingLink(v); setDialogOpen(true); }}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm("Delete this content?")) {
                              supabase.from("content").update({ deleted_at: new Date().toISOString() }).eq("id", v.id).then(() => {
                                qc.invalidateQueries();
                              });
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
        </>
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
    </AppLayout>
  );
}
