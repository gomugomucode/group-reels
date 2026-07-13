import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Video,
  CheckCircle2,
  AlertTriangle,
  Users,
  Plus,
  ArrowRight,
  Search,
  ExternalLink,
  Check,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import {
  useMyGroup,
  useVideoLinks,
  useMyMemberships,
  usePendingInvitations,
  useGroupMembers,
} from "@/hooks/use-data";
import { StatCard } from "@/components/stat-card";
import { PlatformBadge, StatusBadge } from "@/components/platform-badge";
import { Button } from "@/components/ui/button";
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
import { acceptInvitation, rejectInvitation } from "@/lib/group-collaboration.functions";


export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

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

  const validCount = videos.filter((v) => v.status === "valid").length;
  const invalidCount = videos.filter((v) => v.status === "invalid").length;

  const membersCount = useMemo(() => {
    if (!activeGroup) return 0;
    const acceptedCount = activeMembers.filter((m) => m.invitation_status === "accepted").length;
    return acceptedCount > 0 ? acceptedCount : activeGroup.member_names.length;
  }, [activeGroup, activeMembers]);

  const isLoading = ownedLoading || membershipsLoading || invitesLoading || videosLoading;

  return (
    <AppLayout>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back, {profile?.username ?? "there"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {isAdmin
              ? "You have admin access. Manage everything from the Admin dashboard."
              : "Manage your team's social profiles and video links."}
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

      {invites.length > 0 && (
        <div className="mb-8 rounded-2xl border border-border bg-card p-5 animate-in fade-in-50 duration-200">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="size-5 text-primary" /> Pending Team Invitations ({invites.length})
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            You have been invited to collaborate with these student teams.
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
            Set up your group to add social media profiles and start collecting your
            team's video links.
          </p>
          <Button className="mt-6" onClick={() => navigate({ to: "/groups/new" })}>
            <Plus className="mr-1 size-4" /> Create group
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total videos"
              value={videos.length}
              icon={<Video className="size-4" />}
              accent
            />
            <StatCard
              label="Valid links"
              value={validCount}
              icon={<CheckCircle2 className="size-4" />}
            />
            <StatCard
              label="Needs attention"
              value={invalidCount}
              icon={<AlertTriangle className="size-4" />}
            />
            <StatCard
              label="Team members"
              value={membersCount}
              icon={<Users className="size-4" />}
            />
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 className="text-lg font-semibold">{activeGroup?.team_name}</h2>
                <p className="text-sm text-muted-foreground">Your video links</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/groups/$id" params={{ id: activeGroup?.id || "" }}>
                  <Plus className="mr-1 size-4" /> Add / manage
                </Link>
              </Button>
            </div>

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

            <div className="divide-y divide-border">
              {filtered.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  No video links match your filters yet.
                </p>
              ) : (
                filtered.map((v) => (
                  <div
                    key={v.id}
                    className="flex flex-wrap items-center gap-3 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {v.title || "Untitled video"}
                      </p>
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
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}
