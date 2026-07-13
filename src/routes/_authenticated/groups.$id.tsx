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
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useGroup, useVideoLinks, useGroupMembers, type VideoLink, type GroupMember } from "@/hooks/use-data";
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

  const { data: group, isLoading } = useGroup(id);
  const { data: videos = [] } = useVideoLinks(id);
  const { data: members = [], isLoading: membersLoading } = useGroupMembers(id);

  const [editing, setEditing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editLink, setEditLink] = useState<VideoLink | null>(null);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");

  // Permission checks
  const isOwner = !!group && group.created_by === user?.id;
  const canManage = isOwner || isAdmin; // Full admin rights over the group
  const myMembership = members.find(
    (m) => m.user_id === user?.id && m.invitation_status === "accepted",
  );
  // Members can edit/delete their own video links; owners/admins can edit all
  const canEditLink = (link: VideoLink) =>
    canManage || (!!myMembership && link.created_by === user?.id);

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

  // Server functions
  const cancelFn = useServerFn(cancelInvitation);
  const resendFn = useServerFn(resendInvitation);
  const removeFn = useServerFn(removeMember);
  const transferFn = useServerFn(transferOwnership);

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
      const { error } = await supabase.from("video_links").delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-links", id] });
      qc.invalidateQueries({ queryKey: ["video-links-all"] });
      toast.success("Video link deleted");
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

  if (isLoading) {
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
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate({ to: "/dashboard" })}>
        <ArrowLeft className="mr-1 size-4" /> Back
      </Button>

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
                          This permanently removes the group and all its video links.
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

          {/* ── Stats Row ─────────────────────────────────────── */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Total videos" value={videos.length} icon={<Youtube className="size-4" />} accent />
            <StatCard
              label="Valid"
              value={videos.filter((v) => v.status === "valid").length}
              icon={<ExternalLink className="size-4" />}
            />
            <StatCard
              label="Invalid"
              value={videos.filter((v) => v.status === "invalid").length}
              icon={<Ban className="size-4" />}
            />
          </div>

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

          {/* ── Video Links Panel ─────────────────────────────── */}
          <div className="mt-6 rounded-2xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <h2 className="text-lg font-semibold">Video links</h2>
              {/* Anyone who can see this group (owner, member, admin) can add links */}
              {(canManage || !!myMembership) && (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditLink(null);
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="mr-1 size-4" /> Add video
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
                    ? "No video links yet. Add your first one!"
                    : "No links match your filters."}
                </p>
              ) : (
                filtered.map((v) => (
                  <div key={v.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{v.title || "Untitled video"}</p>
                      <a
                        href={v.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 truncate text-sm text-muted-foreground hover:text-foreground"
                      >
                        {v.url}
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    </div>
                    <PlatformBadge platform={v.platform} />
                    <StatusBadge status={v.status} />
                    {canEditLink(v) && (
                      <div className="flex gap-1">
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
                          className="text-destructive"
                          onClick={() => deleteLink.mutate(v.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
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
