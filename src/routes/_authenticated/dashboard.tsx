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
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useMyGroup, useVideoLinks } from "@/hooks/use-data";
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

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { data: group, isLoading } = useMyGroup(user?.id);
  const { data: videos = [] } = useVideoLinks(group?.id);

  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");

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
        {group && (
          <Button asChild>
            <Link to="/groups/$id" params={{ id: group.id }}>
              Open group page <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : !group ? (
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
              value={group.member_names.length}
              icon={<Users className="size-4" />}
            />
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 className="text-lg font-semibold">{group.team_name}</h2>
                <p className="text-sm text-muted-foreground">Your video links</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/groups/$id" params={{ id: group.id }}>
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
