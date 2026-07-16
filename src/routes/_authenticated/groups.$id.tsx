import { useMemo, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Instagram,
  Youtube,
  Facebook,
  Music2,
  Linkedin,
  Globe,
  Search,
  Crown,
  Users,
  Ban,
  Mail,
  UserMinus,
  ShieldCheck,
  Clock,
  Check,
  X,
  RefreshCw,
  TrendingUp,
  Eye,
  Heart,
  MessageSquare,
  Sparkles,
  Calendar,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from "recharts";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import {
  useGroup,
  useVideoLinks,
  useGroupMembers,
  useGroupAnalyticsSummary,
  useGroupMetricsHistory,
  type VideoLink,
  type GroupMember,
} from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { GroupForm } from "@/components/group-form";
import { VideoLinkDialog } from "@/components/video-link-dialog";
import { PlatformBadge, StatusBadge } from "@/components/platform-badge";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PLATFORMS, PLATFORM_LABELS } from "@/lib/video-platforms";
import {
  inviteMember,
  cancelInvitation,
  resendInvitation,
  removeMember,
  transferOwnership,
} from "@/lib/group-collaboration.functions";
import { syncGroupAnalytics } from "@/lib/analytics.functions";

import { VideoThumbnail } from "@/components/video-thumbnail";
import { VideoStatsBadge } from "@/components/video-stats-badge";
import { SyncStatusBadge } from "@/components/sync-status-badge";
import { RefreshButton } from "@/components/refresh-button";
import { formatCount } from "@/lib/youtube";

export const Route = createFileRoute("/_authenticated/groups/$id")({
  component: GroupDetailPage,
});

const SOCIAL_ICONS = {
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
  facebook: Facebook,
  linkedin: Linkedin,
  website: Globe,
} as const;

// ─── Invite Form ────────────────────────────────────────────────────────────
function InviteForm({ groupId }: { groupId: string }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();
  const inviteFn = useServerFn(inviteMember);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await inviteFn({ data: { groupId, email: trimmed } });
      toast.success(`Invitation sent to ${trimmed}`);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["group-members", groupId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to send invitation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleInvite} className="flex gap-2 pt-1">
      <div className="relative flex-1">
        <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="email"
          className="pl-9"
          placeholder="Invite by email address..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
      </div>
      <Button type="submit" size="sm" disabled={loading || !email.trim()}>
        {loading ? "Sending…" : "Invite"}
      </Button>
    </form>
  );
}

// ─── Member Row ──────────────────────────────────────────────────────────────
function MemberRow({
  member,
  isOwnerOrAdmin,
  onCancel,
  onResend,
  onRemove,
  onTransfer,
}: {
  member: GroupMember;
  isOwnerOrAdmin: boolean;
  onCancel: (id: string) => void;
  onResend: (id: string) => void;
  onRemove: (id: string) => void;
  onTransfer: (id: string) => void;
}) {
  const statusColor =
    member.invitation_status === "accepted"
      ? "bg-success/15 text-success border-success/30"
      : member.invitation_status === "pending"
        ? "bg-warning/15 text-warning border-warning/30"
        : "bg-destructive/15 text-destructive border-destructive/30";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-secondary/20 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-foreground">{member.email}</span>
        <div className="mt-0.5 flex items-center gap-2">
          <Badge
            className={`border text-xs capitalize ${statusColor}`}
            variant="outline"
          >
            {member.invitation_status === "pending" && <Clock className="mr-1 size-3" />}
            {member.invitation_status === "accepted" && <Check className="mr-1 size-3" />}
            {member.invitation_status === "rejected" && <X className="mr-1 size-3" />}
            {member.invitation_status}
          </Badge>
          <Badge variant="outline" className="border text-xs capitalize">
            {member.role === "owner" ? (
              <><Crown className="mr-1 size-3 text-warning" /> Owner</>
            ) : (
              member.role
            )}
          </Badge>
        </div>
      </div>

      {isOwnerOrAdmin && member.role !== "owner" && (
        <div className="flex shrink-0 gap-1">
          {member.invitation_status === "pending" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => onResend(member.id)}
                title="Resend invitation"
              >
                <RefreshCw className="size-3" /> Resend
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onCancel(member.id)}
                title="Cancel invitation"
              >
                <X className="size-3" /> Cancel
              </Button>
            </>
          )}
          {member.invitation_status === "accepted" && member.user_id && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    title="Transfer ownership"
                  >
                    <ShieldCheck className="size-3" /> Transfer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Transfer ownership?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Transfer group ownership to <strong>{member.email}</strong>. You will become a
                      regular member. This cannot be undone without their cooperation.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onTransfer(member.id)}>
                      Transfer ownership
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    title="Remove member"
                  >
                    <UserMinus className="size-3" /> Remove
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove member?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Remove <strong>{member.email}</strong> from this group. They will lose access
                      to the group immediately.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => onRemove(member.id)}
                    >
                      Remove member
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {member.invitation_status === "accepted" && !member.user_id && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <UserMinus className="size-3" /> Remove
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove member?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Remove <strong>{member.email}</strong> from this group.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => onRemove(member.id)}
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
function GroupDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();

  // Queries
  const { data: group, isLoading } = useGroup(id);
  const { data: videos = [] } = useVideoLinks(id);
  const { data: members = [], isLoading: membersLoading } = useGroupMembers(id);
  const { data: analyticsSummary, isLoading: summaryLoading } = useGroupAnalyticsSummary(id);
  const { data: historyData = [] } = useGroupMetricsHistory(id);

  // Local UI states
  const [editing, setEditing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editLink, setEditLink] = useState<VideoLink | null>(null);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");
  const [groupSyncing, setGroupSyncing] = useState(false);

  // Permission checks
  const isOwner = !!group && group.created_by === user?.id;
  const canManage = isOwner || isAdmin; // Full admin rights over the group
  const myMembership = members.find(
    (m) => m.user_id === user?.id && m.invitation_status === "accepted",
  );
  // Members can edit/delete their own video links; owners/admins can edit all
  const canEditLink = (link: VideoLink) =>
    canManage || (!!myMembership && link.created_by === user?.id);

  // Filtering video links
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

  // Compute Top Performing Video
  const topVideo = useMemo(() => {
    if (!videos || videos.length === 0) return null;
    const validYoutube = videos.filter(
      (v) => v.platform === "youtube" && v.last_view_count !== null,
    );
    if (validYoutube.length === 0) return null;
    return validYoutube.reduce((prev, curr) => {
      const prevViews = prev.last_view_count ?? 0;
      const currViews = curr.last_view_count ?? 0;
      return currViews > prevViews ? curr : prev;
    });
  }, [videos]);

  // Compute Newest Video
  const newestVideo = useMemo(() => {
    if (!videos || videos.length === 0) return null;
    const validYoutube = videos.filter(
      (v) => v.platform === "youtube" && v.published_at !== null,
    );
    if (validYoutube.length === 0) return null;
    return validYoutube.reduce((prev, curr) => {
      const prevTime = new Date(prev.published_at!).getTime();
      const currTime = new Date(curr.published_at!).getTime();
      return currTime > prevTime ? curr : prev;
    });
  }, [videos]);

  // Daily View Aggregator for Growth Chart
  const growthChartData = useMemo(() => {
    if (!historyData || historyData.length === 0) return [];

    // 1. Group values by date string and video ID
    const dayMap: Record<string, Record<string, number>> = {};
    const dateSorted = [...historyData].sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );

    dateSorted.forEach((h: any) => {
      const dateKey = new Date(h.recorded_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      if (!dayMap[dateKey]) {
        dayMap[dateKey] = {};
      }
      dayMap[dateKey][h.video_link_id] = h.views;
    });

    // 2. Rolling sum across sorted dates
    const dates = Object.keys(dayMap);
    const lastSeenViews: Record<string, number> = {};

    return dates.map((date) => {
      const dayRecord = dayMap[date];
      Object.keys(dayRecord).forEach((vid) => {
        lastSeenViews[vid] = dayRecord[vid];
      });

      const totalViews = Object.values(lastSeenViews).reduce((sum, v) => sum + v, 0);

      return {
        date,
        views: totalViews,
      };
    });
  }, [historyData]);

  // Server functions
  const cancelFn = useServerFn(cancelInvitation);
  const resendFn = useServerFn(resendInvitation);
  const removeFn = useServerFn(removeMember);
  const transferFn = useServerFn(transferOwnership);
  const syncGroupFn = useServerFn(syncGroupAnalytics);

  const handleGroupSync = async () => {
    if (!canManage || groupSyncing) return;
    setGroupSyncing(true);
    const toastId = toast.loading("Updating all group video analytics...");
    try {
      const res = await syncGroupFn({ data: { groupId: id, force: true } });
      if (res.ok) {
        toast.success(`Successfully updated group analytics (${res.succeeded} succeeded)`, {
          id: toastId,
        });
        qc.invalidateQueries({ queryKey: ["video-links", id] });
        qc.invalidateQueries({ queryKey: ["group-analytics-summary", id] });
        qc.invalidateQueries({ queryKey: ["group-metrics-history", id] });
      } else {
        toast.error("Failed to sync group analytics", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred during synchronization", { id: toastId });
    } finally {
      setGroupSyncing(false);
    }
  };

  const handleCancel = async (memberId: string) => {
    try {
      await cancelFn({ data: { memberId } });
      toast.success("Invitation cancelled");
      qc.invalidateQueries({ queryKey: ["group-members", id] });
    } catch (e: any) {
      toast.error(e.message || "Failed to cancel");
    }
  };

  const handleResend = async (memberId: string) => {
    try {
      await resendFn({ data: { memberId } });
      toast.success("Invitation resent");
      qc.invalidateQueries({ queryKey: ["group-members", id] });
    } catch (e: any) {
      toast.error(e.message || "Failed to resend");
    }
  };

  const handleRemove = async (memberId: string) => {
    try {
      await removeFn({ data: { memberId } });
      toast.success("Member removed");
      qc.invalidateQueries({ queryKey: ["group-members", id] });
    } catch (e: any) {
      toast.error(e.message || "Failed to remove member");
    }
  };

  const handleTransfer = async (memberId: string) => {
    try {
      await transferFn({ data: { memberId } });
      toast.success("Ownership transferred");
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message || "Failed to transfer ownership");
    }
  };

  const deleteLink = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from("content")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-links", id] });
      qc.invalidateQueries({ queryKey: ["video-links-all"] });
      qc.invalidateQueries({ queryKey: ["group-analytics-summary", id] });
      toast.success("Content deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteGroup = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-group"] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group deleted");
      navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || summaryLoading) {
    return (
      <AppLayout>
        <Skeleton className="h-64 rounded-2xl" />
      </AppLayout>
    );
  }

  if (!group) {
    return (
      <AppLayout>
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <h1 className="text-xl font-semibold">Group not found</h1>
          <Button className="mt-4" asChild>
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const socialEntries = (
    ["instagram", "tiktok", "youtube", "facebook", "linkedin", "website"] as const
  )
    .map((k) => ({ key: k, url: group[k] }))
    .filter((s) => !!s.url);

  // Accepted members + legacy member_names fallback
  const acceptedMembers = members.filter((m) => m.invitation_status === "accepted");
  const pendingMembers = members.filter((m) => m.invitation_status === "pending");
  const showLegacyNames =
    acceptedMembers.length === 0 && group.member_names && group.member_names.length > 0;

  return (
    <AppLayout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
          <ArrowLeft className="mr-1 size-4" /> Back
        </Button>
        {canManage && (
          <Button
            size="sm"
            onClick={handleGroupSync}
            disabled={groupSyncing}
            variant="outline"
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${groupSyncing ? "animate-spin" : ""}`} />
            <span>Sync Group Analytics</span>
          </Button>
        )}
      </div>

      {editing && canManage ? (
        <>
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Edit group</h1>
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
              Cancel edit
            </Button>
          </div>
          <GroupForm userId={group.created_by} existing={group} />
        </>
      ) : (
        <>
          {/* ── Group Header Card ────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold">{group.team_name}</h1>
                  {group.disabled && (
                    <Badge className="border-transparent bg-destructive/15 text-destructive">
                      <Ban className="mr-1 size-3" /> Disabled
                    </Badge>
                  )}
                </div>
                {group.team_leader && (
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Crown className="size-4 text-warning" /> Led by {group.team_leader}
                  </p>
                )}
                {/* Legacy member_names */}
                {showLegacyNames && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Users className="size-4 text-muted-foreground" />
                    {group.member_names.map((m) => (
                      <Badge key={m} variant="secondary">
                        {m}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Pencil className="mr-1 size-4" /> Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive">
                        <Trash2 className="mr-1 size-4" /> Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this group?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently removes the group and all its content.
                          This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteGroup.mutate()}>
                          Delete group
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>

            {socialEntries.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {socialEntries.map(({ key, url }) => {
                  const Icon = SOCIAL_ICONS[key];
                  return (
                    <a
                      key={key}
                      href={url!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
                    >
                      <Icon className="size-4" /> {PLATFORM_LABELS[key as keyof typeof PLATFORM_LABELS] ?? key}
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Real Platform Stats Row ─────────────────────── */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Total Views"
              value={formatCount(analyticsSummary?.total_views ?? 0)}
              icon={<Eye className="size-4" />}
              accent
            />
            <StatCard
              label="Total Likes"
              value={formatCount(analyticsSummary?.total_likes ?? 0)}
              icon={<Heart className="size-4" />}
            />
            <StatCard
              label="Total Comments"
              value={formatCount(analyticsSummary?.total_comments ?? 0)}
              icon={<MessageSquare className="size-4" />}
            />
          </div>

          {/* ── Extended Highlight Highlights Grid ──────────── */}
          {(topVideo || newestVideo) && (
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {topVideo && (
                <div className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-between">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-semibold text-warning border border-warning/20">
                      <Sparkles className="size-3" /> Top Performing Video
                    </span>
                    <h3 className="mt-3 font-semibold line-clamp-1">{topVideo.title || "Untitled Video"}</h3>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      Channel: {topVideo.channel_name || "Unknown"}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Eye className="size-3" /> {formatCount(topVideo.last_view_count)} views
                    </span>
                    <a
                      href={topVideo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary font-medium hover:underline flex items-center gap-0.5"
                    >
                      Watch <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>
              )}

              {newestVideo && (
                <div className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-between">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20">
                      <Calendar className="size-3" /> Newest Upload
                    </span>
                    <h3 className="mt-3 font-semibold line-clamp-1">{newestVideo.title || "Untitled Video"}</h3>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      Uploaded by: {newestVideo.channel_name || "Unknown"}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">
                      Published {newestVideo.published_at ? new Date(newestVideo.published_at).toLocaleDateString() : "unknown"}
                    </span>
                    <a
                      href={newestVideo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary font-medium hover:underline flex items-center gap-0.5"
                    >
                      Watch <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Growth Chart ────────────────────────────────── */}
          {growthChartData.length > 0 && (
            <div className="mt-6 rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <TrendingUp className="size-4 text-primary" /> Views Growth
                  </h3>
                  <p className="text-xs text-muted-foreground">Cumulative views over time across group videos</p>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={growthChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} />
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={11}
                      tickFormatter={(v) => formatCount(v)}
                    />
                    <ChartTooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        color: "var(--color-popover-foreground)",
                      }}
                      formatter={(v: any) => [`${v.toLocaleString()} views`, "Total Views"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="views"
                      stroke="var(--color-primary)"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Team Members Panel ────────────────────────────── */}
          <div className="mt-6 rounded-2xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <div className="flex items-center gap-2">
                <Users className="size-5 text-primary" />
                <h2 className="text-lg font-semibold">Team members</h2>
                {members.length > 0 && (
                  <Badge variant="secondary">{acceptedMembers.length} active</Badge>
                )}
                {pendingMembers.length > 0 && (
                  <Badge className="bg-warning/15 text-warning border-warning/30 border" variant="outline">
                    {pendingMembers.length} pending
                  </Badge>
                )}
              </div>
            </div>

            <div className="p-4 space-y-3">
              {canManage && <InviteForm groupId={group.id} />}

              {membersLoading ? (
                <div className="space-y-2 pt-2">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-xl" />
                  ))}
                </div>
              ) : members.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No collaborators yet.{" "}
                  {canManage ? "Invite team members using the form above." : ""}
                </p>
              ) : (
                <div className="space-y-2 pt-2">
                  {members.map((m) => (
                    <MemberRow
                      key={m.id}
                      member={m}
                      isOwnerOrAdmin={canManage}
                      onCancel={handleCancel}
                      onResend={handleResend}
                      onRemove={handleRemove}
                      onTransfer={handleTransfer}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Video Links Panel with Thumbnails & Stats ── */}
          <div className="mt-6 rounded-2xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <h2 className="text-lg font-semibold">Content</h2>
              {/* Anyone who can see this group (owner, member, admin) can add links */}
              {(canManage || !!myMembership) && (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditLink(null);
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="mr-1 size-4" /> Add content
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-3 p-4">
              <div className="relative min-w-48 flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search..."
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

            <div className="divide-y divide-border">
              {filtered.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  {videos.length === 0
                    ? "No content yet. Paste your first social media URL to begin."
                    : "No content matches your filters."}
                </p>
              ) : (
                filtered.map((v) => (
                  <div key={v.id} className="flex flex-wrap items-center gap-4 p-4">
                    {/* Video thumbnail and small platform overlay */}
                    <VideoThumbnail
                      thumbnailUrl={v.thumbnail_url}
                      platform={v.platform}
                      title={v.title}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground truncate">{v.title || "Untitled Content"}</p>
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border border-border rounded px-1 py-0.5">{v.platform}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-muted-foreground">
                        {v.channel_name && <span>{v.channel_name}</span>}
                        {v.channel_name && <span>•</span>}
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 hover:text-foreground truncate max-w-xs"
                        >
                          {v.url}
                          <ExternalLink className="size-3 shrink-0" />
                        </a>
                        <span className="text-[10px]">Added {new Date(v.created_at).toLocaleDateString()}</span>
                      </div>
                      
                      {/* Metric summary counters */}
                      <VideoStatsBadge
                        views={v.last_view_count}
                        likes={v.last_like_count}
                        comments={v.last_comment_count}
                        syncStatus={v.sync_status}
                        apiError={v.api_error}
                        className="mt-2"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                      <SyncStatusBadge
                        status={v.sync_status}
                        apiError={v.api_error}
                        lastSynced={v.last_synced}
                      />
                      
                      <div className="flex items-center gap-1">
                        {/* Refresh Button */}
                          <RefreshButton
                            videoLinkId={v.id}
                            groupId={id}
                            lastFetchedAt={v.last_fetched_at}
                            syncStatus={v.sync_status}
                            canRefresh={canEditLink(v)}
                          />

                        {canEditLink(v) && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditLink(v);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => deleteLink.mutate(v.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {(canManage || !!myMembership) && (
            <VideoLinkDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              groupId={group.id}
              editing={editLink}
            />
          )}
        </>
      )}
    </AppLayout>
  );
}
