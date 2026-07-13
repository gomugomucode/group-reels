import { useMemo } from "react";
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
import {
  useAllGroups,
  useAllVideoLinks,
  useAllProfiles,
  useAdminAnalyticsSummary,
  useTopVideos,
  useAllVideoMetricsHistory,
} from "@/hooks/use-data";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  type Platform,
} from "@/lib/video-platforms";
import { Button } from "@/components/ui/button";
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
  // Queries
  const { data: groups = [], isLoading: gLoading } = useAllGroups();
  const { data: videos = [], isLoading: vLoading } = useAllVideoLinks();
  const { data: profiles = [], isLoading: pLoading } = useAllProfiles(true);
  const { data: analyticsSummary = [], isLoading: aLoading } = useAdminAnalyticsSummary();
  const { data: topVideosList = [], isLoading: topLoading } = useTopVideos(8);
  const { data: historyData = [], isLoading: historyLoading } = useAllVideoMetricsHistory();

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
      .slice(0, 8)
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
      .slice(0, 8)
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

  const loading = gLoading || vLoading || pLoading || aLoading || topLoading || historyLoading;

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

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Real Platform Stats Grid ────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Views" value={formatCount(totals.views)} icon={<Eye className="size-4" />} accent />
            <StatCard label="Total Likes" value={formatCount(totals.likes)} icon={<ThumbsUp className="size-4" />} />
            <StatCard label="Total Comments" value={formatCount(totals.comments)} icon={<MessageSquare className="size-4" />} />
            <StatCard label="Avg Views / Video" value={formatCount(totals.averageViews)} icon={<TrendingUp className="size-4" />} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-4">
            <StatCard label="Groups" value={groups.length} icon={<FolderKanban className="size-4" />} />
            <StatCard label="Total Video Links" value={videos.length} icon={<Video className="size-4" />} />
            <StatCard label="Invalid Links" value={totals.invalidCount} icon={<AlertTriangle className="size-4" />} />
            <StatCard label="Top Platform (by views)" value={topPlatform} icon={<Sparkles className="size-4" />} />
          </div>

          {/* ── Views Growth Chart ──────────────────────────── */}
          {growthChartData.length > 0 && (
            <div className="mt-6 rounded-2xl border border-border bg-card p-5">
              <div className="mb-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" /> Overall Views Growth
                </h3>
                <p className="text-xs text-muted-foreground">Cumulative views growth over time across all teams</p>
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
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        color: "var(--color-popover-foreground)",
                      }}
                      formatter={(v: any) => [`${v.toLocaleString()} views`, "Cumulative Views"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="views"
                      stroke="var(--color-primary)"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
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
            <ChartCard title="Top Groups (by total views)" description="Teams with the most video views aggregate">
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

            <ChartCard title="Most Active uploaders" description="Teams with the highest video link counts">
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
              <h3 className="font-semibold text-lg">Top Performing Videos</h3>
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
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
          </div>
        </>
      )}
    </AppLayout>
  );
}
