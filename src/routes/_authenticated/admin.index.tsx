import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import {
  Users,
  FolderKanban,
  Video,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  ThumbsUp,
  MessageSquare,
  Eye,
  Settings,
  Sparkles,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { StatCard } from "@/components/stat-card";
import { useAdminDashboardData } from "@/hooks/use-data";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  type Platform,
} from "@/lib/video-platforms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount } from "@/lib/youtube";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-muted-foreground)",
];

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4">
        <h3 className="font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}

function AdminDashboard() {
  const [search, setSearch] = useState("");
  const { data: adminData, isLoading: adminLoading } = useAdminDashboardData();

  const groups = adminData?.groups ?? [];
  const videos = adminData?.videos ?? [];
  const profiles = adminData?.profiles ?? [];
  const analyticsSummary = adminData?.analyticsSummary ?? [];
  const topVideosList = adminData?.topVideos ?? [];
  const historyData = adminData?.historyData ?? [];
  const totalMembers = adminData?.totalMembers ?? 0;
  const pendingInvitations = adminData?.pendingInvitations ?? 0;
  const activeCollaborations = adminData?.activeCollaborations ?? 0;
  const hasStoredAnalytics = adminData?.hasStoredAnalytics ?? false;

  // Metrics summary
  const totals = useMemo(() => {
    let views = 0;
    let likes = 0;
    let comments = 0;

    analyticsSummary.forEach((g) => {
      views += g.total_views ?? 0;
      likes += g.total_likes ?? 0;
      comments += g.total_comments ?? 0;
    });

    const averageViews = videos.length > 0 ? Math.round(views / videos.length) : 0;
    const invalidCount = videos.filter((v) => v.status === "invalid").length;
    const validCount = videos.filter((v) => v.status === "valid").length;

    return {
      views,
      likes,
      comments,
      averageViews,
      invalidCount,
      validCount,
    };
  }, [analyticsSummary, videos]);

  // Compute Platform distribution weighted by views
  const platformData = useMemo(() => {
    return PLATFORMS.map((p) => {
      const platformVideos = videos.filter((v) => v.platform === p);
      const views = platformVideos.reduce((sum, v) => sum + (v.last_view_count ?? 0), 0);
      return {
        platform: PLATFORM_LABELS[p],
        key: p as Platform,
        count: platformVideos.length,
        views,
      };
    }).filter((d) => d.count > 0);
  }, [videos]);

  // Top groups by total views
  const topGroupsData = useMemo(() => {
    return [...analyticsSummary]
      .sort((a, b) => b.total_views - a.total_views)
      .slice(0, 10)
      .map((g) => ({
        name: g.team_name.length > 14 ? g.team_name.slice(0, 13) + "…" : g.team_name,
        views: g.total_views,
        videos: g.video_count,
      }));
  }, [analyticsSummary]);

  // Most active groups by upload count
  const activeUploadersData = useMemo(() => {
    return [...analyticsSummary]
      .sort((a, b) => b.video_count - a.video_count)
      .slice(0, 10)
      .map((g) => ({
        name: g.team_name.length > 14 ? g.team_name.slice(0, 13) + "…" : g.team_name,
        videos: g.video_count,
      }));
  }, [analyticsSummary]);

  // Daily View Aggregator for Growth Chart
  const growthChartData = useMemo(() => {
    if (!historyData || historyData.length === 0) return [];

    const dayMap: Record<string, Record<string, number>> = {};
    const sortedHistory = [...historyData].sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );

    sortedHistory.forEach((h: any) => {
      const dateKey = new Date(h.recorded_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      if (!dayMap[dateKey]) {
        dayMap[dateKey] = {};
      }
      dayMap[dateKey][h.video_link_id] = h.views;
    });

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

  const topPlatform =
    [...platformData].sort((a, b) => b.views - a.views)[0]?.platform ?? "—";

  const monthlyUploadsData = useMemo(() => {
    const monthMap = new Map<string, { label: string; count: number; sortKey: string }>();
    videos.forEach((video) => {
      const createdAt = video.created_at ? new Date(video.created_at) : null;
      if (!createdAt || Number.isNaN(createdAt.getTime())) return;
      const sortKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}`;
      const label = createdAt.toLocaleDateString(undefined, { month: "short", year: "numeric" });
      const existing = monthMap.get(sortKey) ?? { label, count: 0, sortKey };
      existing.count += 1;
      monthMap.set(sortKey, existing);
    });
    return Array.from(monthMap.values())
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ label, count }) => ({ date: label, uploads: count }));
  }, [videos]);

  const dailyUploadsData = useMemo(() => {
    const map = new Map<string, number>();
    videos.forEach((video) => {
      const createdAt = video.created_at ? new Date(video.created_at) : null;
      if (!createdAt || Number.isNaN(createdAt.getTime())) return;
      const key = createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, uploads]) => ({ date, uploads }));
  }, [videos]);

  const monthlyGrowthData = useMemo(() => {
    const map = new Map<string, number>();
    historyData.forEach((entry) => {
      const date = new Date(entry.recorded_at);
      const key = date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
      map.set(key, (map.get(key) ?? 0) + (entry.views ?? 0));
    });
    return Array.from(map.entries()).map(([date, views]) => ({ date, views }));
  }, [historyData]);

  const globalSearchResults = useMemo(() => {
    if (!search.trim()) return [];
    const keyword = search.trim().toLowerCase();
    const matches = [
      ...profiles.filter((profile) => {
        const haystack = [profile.username, profile.email, profile.team_name ?? ""].join(" ").toLowerCase();
        return haystack.includes(keyword);
      }).map((profile) => ({
        type: "User",
        label: profile.username,
        description: profile.email,
        href: "/admin/users",
      })),
      ...groups.filter((group) => {
        const haystack = [group.team_name, ...(group.member_names ?? [])].join(" ").toLowerCase();
        return haystack.includes(keyword);
      }).map((group) => ({
        type: "Group",
        label: group.team_name,
        description: `${group.member_names.length} members`,
        href: "/admin/groups",
      })),
      ...videos.filter((video) => {
        const haystack = [video.title ?? "", video.url, video.platform].join(" ").toLowerCase();
        return haystack.includes(keyword);
      }).map((video) => ({
        type: "Video",
        label: video.title ?? "Untitled video",
        description: video.url,
        href: "/admin/video-links",
      })),
    ].slice(0, 8);
    return matches;
  }, [groups, profiles, search, videos]);

  const loading = adminLoading;

  return (
    <AppLayout>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Admin dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Overview of all teams, real video analytics, and platform activity.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link to="/admin/analytics">
            <Settings className="size-4" />
            <span>Sync Settings</span>
          </Link>
        </Button>
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Global admin search</h2>
            <p className="text-sm text-muted-foreground">Search users, groups, and video links from the admin console.</p>
          </div>
          <div className="w-full max-w-xl">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users, teams, or video links"
            />
          </div>
        </div>
        {search.trim() && (
          <div className="mt-3 rounded-xl border border-border bg-background/70 p-3">
            {globalSearchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching users, groups, or videos were found.</p>
            ) : (
              <div className="space-y-2">
                {globalSearchResults.map((result, index) => (
                  <div key={`${result.type}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/70 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{result.label}</p>
                      <p className="text-xs text-muted-foreground">{result.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {result.type}
                      </span>
                      <Button asChild variant="ghost" size="sm">
                        <Link to={result.href}>Open</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Real Platform Stats Grid ────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Total Users" value={profiles.length} icon={<Users className="size-4" />} accent />
            <StatCard label="Total Groups" value={groups.length} icon={<FolderKanban className="size-4" />} />
            <StatCard label="Total Members" value={totalMembers} icon={<Users className="size-4" />} />
            <StatCard label="Total Content" value={videos.length} icon={<Video className="size-4" />} />
            <StatCard label="Total Views" value={formatCount(totals.views)} icon={<Eye className="size-4" />} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Total Likes" value={formatCount(totals.likes)} icon={<ThumbsUp className="size-4" />} />
            <StatCard label="Total Comments" value={formatCount(totals.comments)} icon={<MessageSquare className="size-4" />} />
            <StatCard label="Pending Invitations" value={pendingInvitations} icon={<Users className="size-4" />} />
            <StatCard label="Active Collaborations" value={activeCollaborations} icon={<Users className="size-4" />} />
            <StatCard label="Invalid Links" value={totals.invalidCount} icon={<AlertTriangle className="size-4" />} />
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            {hasStoredAnalytics ? (
              <span>Analytics totals reflect synced and stored video data from the platform.</span>
            ) : (
              <span>Stored analytics data is limited right now, so totals are shown from the available records.</span>
            )}
          </div>

          {/* ── Views Growth Chart ──────────────────────────── */}
          {(growthChartData.length > 0 || monthlyGrowthData.length > 0) && (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <TrendingUp className="size-4 text-primary" /> Monthly Growth
                  </h3>
                  <p className="text-xs text-muted-foreground">Historical view volume by month across all teams</p>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyGrowthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} />
                      <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickFormatter={(v) => formatCount(v)} />
                      <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, color: "var(--color-popover-foreground)" }} formatter={(v: any) => [`${v.toLocaleString()} views`]} />
                      <Line type="monotone" dataKey="views" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Video className="size-4 text-primary" /> Monthly Uploads
                  </h3>
                  <p className="text-xs text-muted-foreground">New video links added across the platform over time</p>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyUploadsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} />
                      <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                      <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, color: "var(--color-popover-foreground)" }} />
                      <Bar dataKey="uploads" fill="var(--color-chart-3)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {(growthChartData.length > 0 || monthlyGrowthData.length > 0 || dailyUploadsData.length > 0) && (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Video className="size-4 text-primary" /> Daily Uploads
                  </h3>
                  <p className="text-xs text-muted-foreground">New video links added day by day across the platform</p>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyUploadsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} />
                      <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                      <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, color: "var(--color-popover-foreground)" }} />
                      <Bar dataKey="uploads" fill="var(--color-chart-4)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" /> Top Platform
                  </h3>
                  <p className="text-xs text-muted-foreground">The highest-performing platform by views</p>
                </div>
                <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/60 p-6 text-center">
                  <p className="text-4xl font-bold text-primary">{topPlatform}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Based on the latest aggregated video views.</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Multi Chart Distribution Grid ────────────────── */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <ChartCard title="Platform share (by views)" description="Views weighting per video platform">
              {platformData.length === 0 ? (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  No video views recorded yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={platformData}
                      dataKey="views"
                      nameKey="platform"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={50}
                      paddingAngle={2}
                    >
                      {platformData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        color: "var(--color-popover-foreground)",
                      }}
                      formatter={(v: any) => [formatCount(v) + " views"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Views by platform" description="Total aggregate views per video platform">
              {platformData.length === 0 ? (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  No video views recorded yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={platformData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="platform" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={12}
                      tickFormatter={(v) => formatCount(v)}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--color-secondary)" }}
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        color: "var(--color-popover-foreground)",
                      }}
                      formatter={(v: any) => [`${v.toLocaleString()} views`]}
                    />
                    <Bar dataKey="views" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* ── Top Groups and Top Uploaders Charts ──────────── */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <ChartCard title="Views by Group" description="Teams with the most video views aggregate">
              {topGroupsData.length === 0 ? (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  No group views recorded yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topGroupsData} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="var(--color-muted-foreground)"
                      fontSize={11}
                      tickFormatter={(v) => formatCount(v)}
                    />
                    <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} width={80} />
                    <Tooltip
                      cursor={{ fill: "var(--color-secondary)" }}
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        color: "var(--color-popover-foreground)",
                      }}
                      formatter={(v: any) => [`${v.toLocaleString()} views`]}
                    />
                    <Bar dataKey="views" fill="var(--color-accent)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Most Active Uploaders" description="Teams with the highest video link counts">
              {activeUploadersData.length === 0 ? (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  No upload statistics yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeUploadersData} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} />
                    <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} width={80} />
                    <Tooltip
                      cursor={{ fill: "var(--color-secondary)" }}
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        color: "var(--color-popover-foreground)",
                      }}
                      formatter={(v: any) => [`${v} video links`]}
                    />
                    <Bar dataKey="videos" fill="var(--color-chart-2)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* ── Top Performing Videos List ─────────────────── */}
          <div className="mt-6 rounded-2xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <h3 className="font-semibold text-lg">Top 10 Videos</h3>
              <p className="text-xs text-muted-foreground">Overall highest viewed videos across the platform</p>
            </div>
            <div className="divide-y divide-border">
              {topVideosList.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">No videos mapped yet.</p>
              ) : (
                topVideosList.map((v) => (
                  <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{v.title || "Untitled video"}</p>
                      <div className="flex items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                        <span className="font-medium text-foreground/95">{v.team_name}</span>
                        <span>•</span>
                        <span>{v.channel_name || "Unknown"}</span>
                        <span>•</span>
                        <a href={v.url} target="_blank" rel="noreferrer" className="hover:text-foreground">
                          {v.url.length > 35 ? v.url.slice(0, 34) + "..." : v.url}
                        </a>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{formatCount(v.last_view_count)} views</p>
                        <p className="text-[10px] text-muted-foreground">likes: {formatCount(v.last_like_count)}</p>
                      </div>
                      <Button asChild variant="ghost" size="icon" title="View Team Group">
                        <Link to="/groups/$id" params={{ id: v.group_id }}>
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Admin Management Routes ──────────────────────── */}
          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Manage</h2>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              to="/admin/groups"
              className="group flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary"
            >
              <div>
                <p className="font-semibold">All groups</p>
                <p className="text-sm text-muted-foreground">
                  Search, edit, disable, or delete any team group.
                </p>
              </div>
              <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
            <Link
              to="/admin/users"
              className="group flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary"
            >
              <div>
                <p className="font-semibold">User accounts</p>
                <p className="text-sm text-muted-foreground">
                  Manage roles and remove accounts.
                </p>
              </div>
              <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
            <Link
              to="/admin/content"
              className="group flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary"
            >
              <div>
                <p className="font-semibold">Content</p>
                <p className="text-sm text-muted-foreground">
                  Edit, refresh, filter, and remove content.
                </p>
              </div>
              <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
            <Link
              to="/admin/analytics"
              className="group flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary"
            >
              <div>
                <p className="font-semibold">Analytics</p>
                <p className="text-sm text-muted-foreground">
                  Review sync health, refresh all analytics, and export reports.
                </p>
              </div>
              <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
          </div>
        </>
      )}
    </AppLayout>
  );
}
