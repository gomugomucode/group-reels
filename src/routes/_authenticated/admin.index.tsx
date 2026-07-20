import { useMemo, useState, useEffect } from "react";
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
  TrendingUp,
  ArrowRight,
  ThumbsUp,
  Eye,
  Settings,
  Sparkles,
  RefreshCw,
  Activity,
  Globe,
  Layers,
  Heart,
  PlusCircle,
  UserCheck,
  MessageSquare,
  BarChart3,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/app-layout";
import { StatCard } from "@/components/stat-card";
import { CreatorInsights } from "@/components/creator-insights";
import { useAdminDashboardData } from "@/hooks/use-data";
import { triggerFullSync } from "@/lib/analytics.functions";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  type Platform,
} from "@/lib/video-platforms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount } from "@/lib/youtube";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

const CHART_COLORS = [
  "var(--color-chart-1, #3b82f6)",
  "var(--color-chart-2, #10b981)",
  "var(--color-chart-3, #f59e0b)",
  "var(--color-chart-4, #ef4444)",
  "var(--color-chart-5, #8b5cf6)",
  "var(--color-muted-foreground, #6b7280)",
];

interface AdminSettings {
  appName: string;
  refreshInterval: string;
  syncEnabled: boolean;
  registrationsEnabled: boolean;
  groupsCreationEnabled: boolean;
  defaultDashboard: "overview" | "analytics" | "activity" | "settings";
}

interface ActivityEvent {
  id: string;
  type: "user_joined" | "content_added" | "content_refreshed" | "group_created";
  title: string;
  description: string;
  timestamp: string;
  icon: any;
  color: string;
}

function AdminDashboard() {
  const { data: adminData, isLoading: adminLoading, refetch } = useAdminDashboardData();
  const syncFn = useServerFn(triggerFullSync);
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);

  // Admin settings from local storage
  const [settings, setSettings] = useState<AdminSettings>(() => {
    try {
      const stored = localStorage.getItem("admin_settings");
      if (stored) {
        return {
          appName: "ReelHub Admin",
          refreshInterval: "6h",
          syncEnabled: true,
          registrationsEnabled: true,
          groupsCreationEnabled: true,
          defaultDashboard: "overview",
          ...JSON.parse(stored),
        };
      }
    } catch (e) {}
    return {
      appName: "ReelHub Admin",
      refreshInterval: "6h",
      syncEnabled: true,
      registrationsEnabled: true,
      groupsCreationEnabled: true,
      defaultDashboard: "overview",
    };
  });

  const [activeTab, setActiveTab] = useState<"overview" | "analytics" | "activity" | "settings">(
    settings.defaultDashboard
  );

  useEffect(() => {
    // Keep tab in sync with default dashboard settings on first load
    setActiveTab(settings.defaultDashboard);
  }, [settings.defaultDashboard]);

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

  // Basic totals
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

  const topTeams = useMemo(() => {
    return [...analyticsSummary]
      .sort((a, b) => (b.total_views ?? 0) - (a.total_views ?? 0))
      .slice(0, 5);
  }, [analyticsSummary]);

  // Redesigned Today's metrics (Task 1)
  const todayMetrics = useMemo(() => {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const oneDayAgoMs = oneDayAgo.getTime();

    // Group history entries by video ID
    const historyByVideo: Record<string, typeof historyData> = {};
    historyData.forEach((entry) => {
      if (!historyByVideo[entry.video_link_id]) {
        historyByVideo[entry.video_link_id] = [];
      }
      historyByVideo[entry.video_link_id].push(entry);
    });

    let viewsGrowth = 0;
    let likesGrowth = 0;

    Object.entries(historyByVideo).forEach(([_, entries]) => {
      const sorted = [...entries].sort(
        (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
      );
      if (sorted.length === 0) return;

      const latest = sorted[sorted.length - 1];
      const baseline = sorted.find((e) => new Date(e.recorded_at).getTime() >= oneDayAgoMs) || sorted[0];

      viewsGrowth += Math.max(0, (latest.views ?? 0) - (baseline.views ?? 0));
      likesGrowth += Math.max(0, (latest.likes ?? 0) - (baseline.likes ?? 0));
    });

    // Today's growth percentage (total views vs views today)
    const growthPercent =
      totals.views > 0
        ? Math.min(100, Math.max(0, (viewsGrowth / (totals.views - viewsGrowth + 1)) * 100))
        : 0;

    // Distinct platform count
    const connectedPlatforms = new Set(videos.map((v) => v.platform)).size;

    // Pending refreshes
    const pendingRefreshes = videos.filter((v) => v.status === "pending").length;

    // System Status
    const isSystemHealthy = settings.syncEnabled && videos.filter((v) => v.status === "invalid").length / (videos.length || 1) < 0.2;

    return {
      views: viewsGrowth,
      likes: likesGrowth,
      growthPercent,
      connectedPlatforms,
      pendingRefreshes,
      status: isSystemHealthy ? "Healthy" : "Attention Required",
    };
  }, [historyData, videos, totals.views, settings.syncEnabled]);

  // Cumulative User Growth (Task 8)
  const userGrowthData = useMemo(() => {
    const monthMap = new Map<string, number>();
    profiles.forEach((p) => {
      if (!p.created_at) return;
      const date = new Date(p.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
    });
    const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    let cumulative = 0;
    return sortedMonths.map(([month, count]) => {
      cumulative += count;
      const [year, m] = month.split("-");
      const label = new Date(Number(year), Number(m) - 1).toLocaleDateString(undefined, {
        month: "short",
        year: "2-digit",
      });
      return { date: label, users: cumulative };
    });
  }, [profiles]);

  // Cumulative Content Growth (Task 8)
  const contentGrowthData = useMemo(() => {
    const monthMap = new Map<string, number>();
    videos.forEach((v) => {
      if (!v.created_at) return;
      const date = new Date(v.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
    });
    const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    let cumulative = 0;
    return sortedMonths.map(([month, count]) => {
      cumulative += count;
      const [year, m] = month.split("-");
      const label = new Date(Number(year), Number(m) - 1).toLocaleDateString(undefined, {
        month: "short",
        year: "2-digit",
      });
      return { date: label, content: cumulative };
    });
  }, [videos]);

  // Top Creators by total views (Task 8)
  const topCreatorsData = useMemo(() => {
    const creatorMap = new Map<string, { username: string; views: number; videos: number }>();
    videos.forEach((v) => {
      const creatorId = v.created_by;
      const profile = profiles.find((p) => p.id === creatorId);
      const username = profile?.username || "Platform Creator";
      const existing = creatorMap.get(username) ?? { username, views: 0, videos: 0 };
      existing.views += v.last_view_count ?? 0;
      existing.videos += 1;
      creatorMap.set(username, existing);
    });
    return Array.from(creatorMap.values())
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }, [videos, profiles]);

  // Platform Distribution
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

  // Unified dynamic Activity Feed list (Task 9)
  const activityFeedEvents = useMemo(() => {
    const events: ActivityEvent[] = [];

    // 1. Registrations
    profiles.slice(0, 10).forEach((p) => {
      events.push({
        id: `reg-${p.id}`,
        type: "user_joined",
        title: "User Registered",
        description: `${p.username} (${p.email}) joined the workspace.`,
        timestamp: p.created_at,
        icon: UserCheck,
        color: "bg-blue-500/10 text-blue-500",
      });
    });

    // 2. Content Uploads
    videos.slice(0, 15).forEach((v) => {
      const groupName = groups.find((g) => g.id === v.group_id)?.team_name || "a team";
      events.push({
        id: `vid-${v.id}`,
        type: "content_added",
        title: "Content Added",
        description: `New ${PLATFORM_LABELS[v.platform]} video "${v.title || "Untitled"}" linked to "${groupName}".`,
        timestamp: v.created_at,
        icon: PlusCircle,
        color: "bg-emerald-500/10 text-emerald-500",
      });
    });

    // 3. Stats Refreshes
    videos
      .filter((v) => v.last_fetched_at)
      .slice(0, 10)
      .forEach((v) => {
        events.push({
          id: `ref-${v.id}`,
          type: "content_refreshed",
          title: "Statistics Synced",
          description: `Metrics for "${v.title || "Untitled"}" refreshed (Views: ${formatCount(
            v.last_view_count ?? 0
          )}).`,
          timestamp: v.last_fetched_at!,
          icon: RefreshCw,
          color: "bg-purple-500/10 text-purple-500",
        });
      });

    // 4. Groups Created
    groups.slice(0, 5).forEach((g) => {
      events.push({
        id: `group-${g.id}`,
        type: "group_created",
        title: "Team Group Created",
        description: `Collaboration team "${g.team_name}" registered with ${g.member_names.length} creators.`,
        timestamp: g.created_at,
        icon: FolderKanban,
        color: "bg-amber-500/10 text-amber-500",
      });
    });

    // Sort all chronologically descending
    return events
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 30);
  }, [profiles, videos, groups]);

  // Global Search Engine (Task 5)
  const globalSearchResults = useMemo(() => {
    if (!search.trim()) return [];
    const keyword = search.trim().toLowerCase();
    const matches = [
      ...profiles
        .filter((profile) => {
          const haystack = [profile.username, profile.email, profile.team_name ?? ""]
            .join(" ")
            .toLowerCase();
          return haystack.includes(keyword);
        })
        .map((profile) => ({
          type: "User",
          label: profile.username,
          description: profile.email,
          href: `/admin/users/${profile.id}`,
        })),
      ...groups
        .filter((group) => {
          const haystack = [group.team_name, ...(group.member_names ?? [])].join(" ").toLowerCase();
          return haystack.includes(keyword);
        })
        .map((group) => ({
          type: "Group",
          label: group.team_name,
          description: `${group.member_names.length} members`,
          href: "/admin/groups",
        })),
      ...videos
        .filter((video) => {
          const haystack = [video.title ?? "", video.url, video.platform].join(" ").toLowerCase();
          return haystack.includes(keyword);
        })
        .map((video) => ({
          type: "Video",
          label: video.title ?? "Untitled video",
          description: video.url,
          href: "/admin/content",
        })),
    ].slice(0, 8);
    return matches;
  }, [groups, profiles, search, videos]);

  // Settings Save Handler
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem("admin_settings", JSON.stringify(settings));
      toast.success("Admin configuration updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update configuration");
    }
  };

  const loading = adminLoading;

  return (
    <AppLayout>
      {/* Redesigned Premium Header */}
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            {settings.appName}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            System health, platform-wide analytics aggregator, configuration dashboard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5"
            onClick={async () => {
              if (syncing) return;
              setSyncing(true);
              try {
                await syncFn();
                await refetch();
                toast.success("Analytics synced successfully!");
              } catch (err: any) {
                toast.error(err.message || "Sync failed");
              } finally {
                setSyncing(false);
              }
            }}
            disabled={loading || syncing}
          >
            <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Syncing…" : "Sync Stats"}</span>
          </Button>
          <Button asChild size="sm" className="h-9 gap-1.5">
            <Link to="/admin/analytics">
              <Settings className="size-3.5" />
              <span>Engine Status</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="mb-6 flex border-b border-border">
        {(["overview", "analytics", "activity", "settings"] as const).map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 transition-all ${
              activeTab === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "activity" ? "Activity Timeline" : tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Global search */}
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-md font-bold">Global Admin Console Search</h2>
                    <p className="text-xs text-muted-foreground">
                      Search profiles, teams, or link URLs in the platform workspace.
                    </p>
                  </div>
                  <div className="w-full max-w-xl">
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Type email, channel, team title, url..."
                      className="bg-background"
                    />
                  </div>
                </div>
                {search.trim() && (
                  <div className="mt-3 rounded-xl border border-border bg-background/50 p-2 space-y-1">
                    {globalSearchResults.length === 0 ? (
                      <p className="p-3 text-center text-xs text-muted-foreground">
                        No matches in users, groups, or content.
                      </p>
                    ) : (
                      globalSearchResults.map((result, index) => (
                        <div
                          key={`${result.type}-${index}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-card px-3 py-1.5 text-xs hover:border-primary/50"
                        >
                          <div>
                            <p className="font-semibold">{result.label}</p>
                            <p className="text-[10px] text-muted-foreground">{result.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
                              {result.type}
                            </span>
                            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                              <Link to={result.href}>Open</Link>
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Quick Links */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="p-4 hover:bg-secondary/15 transition-colors border border-border bg-card">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-semibold">Users Management</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Manage user profiles and roles</p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="h-8">
                      <Link to="/admin/users">Open <ArrowRight className="ml-1 size-3.5" /></Link>
                    </Button>
                  </div>
                </Card>
                <Card className="p-4 hover:bg-secondary/15 transition-colors border border-border bg-card">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-semibold">Teams & Groups</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Monitor collaborative squads</p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="h-8">
                      <Link to="/admin/groups">Open <ArrowRight className="ml-1 size-3.5" /></Link>
                    </Button>
                  </div>
                </Card>
                <Card className="p-4 hover:bg-secondary/15 transition-colors border border-border bg-card">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-semibold">Content Library</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Audit uploaded video links</p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="h-8">
                      <Link to="/admin/content">Open <ArrowRight className="ml-1 size-3.5" /></Link>
                    </Button>
                  </div>
                </Card>
                <Card className="p-4 hover:bg-secondary/15 transition-colors border border-border bg-card">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-semibold">Analytics Panel</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Track system sync logs</p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="h-8">
                      <Link to="/admin/analytics">Open <ArrowRight className="ml-1 size-3.5" /></Link>
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Contest-wide statistics cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <StatCard label="Total Users" value={profiles.length.toLocaleString()} icon={<Users className="size-4" />} />
                <StatCard label="Total Teams" value={groups.length.toLocaleString()} icon={<Layers className="size-4 text-accent" />} />
                <StatCard label="Total Videos" value={videos.length.toLocaleString()} icon={<Video className="size-4 text-success" />} />
                <StatCard label="Total Views" value={totals.views.toLocaleString()} icon={<Eye className="size-4" />} />
                <StatCard label="Total Likes" value={totals.likes.toLocaleString()} icon={<Heart className="size-4 text-rose-500" />} />
                <StatCard label="Total Comments" value={totals.comments.toLocaleString()} icon={<MessageSquare className="size-4 text-primary" />} />
              </div>

              {/* Two Core Charts */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Platform Distribution */}
                <Card className="p-5 bg-card border border-border">
                  <CardHeader className="p-0 mb-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Layers className="size-4 text-accent" /> Platform Distribution
                    </CardTitle>
                  </CardHeader>
                  <div className="h-64">
                    {platformData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No platform distribution data.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={platformData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={3}
                            dataKey="count"
                            nameKey="platform"
                          >
                            {platformData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "var(--color-popover)",
                              border: "1px solid var(--color-border)",
                              borderRadius: 8,
                              fontSize: 11,
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </Card>

                {/* Views by Platform */}
                <Card className="p-5 bg-card border border-border">
                  <CardHeader className="p-0 mb-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <BarChart3 className="size-4 text-success" /> Views by Platform
                    </CardTitle>
                  </CardHeader>
                  <div className="h-64">
                    {platformData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No view statistics yet.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={platformData}>
                          <defs>
                            <linearGradient id="adminBarGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.9}/>
                              <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                          <XAxis dataKey="platform" stroke="var(--color-muted-foreground)" fontSize={10} />
                          <YAxis stroke="var(--color-muted-foreground)" fontSize={10} tickFormatter={(v) => formatCount(v)} />
                          <Tooltip
                            contentStyle={{
                              background: "var(--color-popover)",
                              border: "1px solid var(--color-border)",
                              borderRadius: 8,
                              fontSize: 11,
                            }}
                            formatter={(v: any) => [`${v.toLocaleString()} views`]}
                          />
                          <Bar dataKey="views" fill="url(#adminBarGradient)" radius={[6, 6, 0, 0]} isAnimationActive={true} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </Card>
              </div>

              {/* Tables: Top Teams & Recent Activity */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Top Teams Standings Table */}
                <Card className="shadow-sm border border-border bg-card">
                  <CardHeader className="p-5">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Trophy className="size-5 text-amber-500" /> Top Teams
                    </CardTitle>
                    <CardDescription className="text-xs">Highest performing collaboration groups</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16 text-center text-xs">Rank</TableHead>
                          <TableHead className="text-xs">Team</TableHead>
                          <TableHead className="text-right text-xs">Videos</TableHead>
                          <TableHead className="text-right text-xs">Views</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topTeams.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-xs text-muted-foreground">
                              No team rankings available
                            </TableCell>
                          </TableRow>
                        ) : (
                          topTeams.map((team, idx) => (
                            <TableRow key={team.group_id} className="text-xs">
                              <TableCell className="text-center font-bold">{idx + 1}</TableCell>
                              <TableCell className="font-semibold">{team.team_name || "Collaboration Group"}</TableCell>
                              <TableCell className="text-right">{team.video_count || 0}</TableCell>
                              <TableCell className="text-right font-bold">{team.total_views?.toLocaleString() || 0}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Recent Activity feed */}
                <Card className="shadow-sm border border-border bg-card">
                  <CardHeader className="p-5">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Activity className="size-5 text-primary" /> Recent Activity
                    </CardTitle>
                    <CardDescription className="text-xs font-medium">Recent platform timeline notifications</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[280px] overflow-y-auto pr-1">
                    {activityFeedEvents.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-12 text-center">No recent activity logs.</p>
                    ) : (
                      <div className="space-y-4 p-4 pt-0">
                        {activityFeedEvents.slice(0, 10).map((event) => {
                          const date = new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

          {/* TAB 2: ANALYTICS (Task 8) */}
          {activeTab === "analytics" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Primary Views/Likes line charts */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="shadow-sm">
                  <CardHeader className="p-5">
                    <CardTitle className="text-base font-bold flex items-center gap-1.5">
                      <TrendingUp className="size-4 text-primary" />
                      Views Growth History
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Total historical view volume over time
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    {historyData.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        No historical metric records found
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={historyData.slice(-50)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                          <XAxis
                            dataKey="recorded_at"
                            stroke="var(--color-muted-foreground)"
                            fontSize={10}
                            tickFormatter={(v) =>
                              new Date(v).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })
                            }
                          />
                          <YAxis
                            stroke="var(--color-muted-foreground)"
                            fontSize={10}
                            tickFormatter={(v) => formatCount(v)}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "var(--color-popover)",
                              border: "1px solid var(--color-border)",
                              borderRadius: 12,
                              fontSize: "11px",
                            }}
                            formatter={(v: any) => [`${v.toLocaleString()} views`]}
                          />
                          <Line
                            type="monotone"
                            dataKey="views"
                            stroke="var(--color-primary, #3b82f6)"
                            strokeWidth={2.5}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="p-5">
                    <CardTitle className="text-base font-bold flex items-center gap-1.5">
                      <Heart className="size-4 text-rose-500" />
                      Likes History
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Likes aggregate growth metrics
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    {historyData.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        No historical metric records found
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={historyData.slice(-50)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                          <XAxis
                            dataKey="recorded_at"
                            stroke="var(--color-muted-foreground)"
                            fontSize={10}
                            tickFormatter={(v) =>
                              new Date(v).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })
                            }
                          />
                          <YAxis
                            stroke="var(--color-muted-foreground)"
                            fontSize={10}
                            tickFormatter={(v) => formatCount(v)}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "var(--color-popover)",
                              border: "1px solid var(--color-border)",
                              borderRadius: 12,
                              fontSize: "11px",
                            }}
                            formatter={(v: any) => [`${v.toLocaleString()} likes`]}
                          />
                          <Line
                            type="monotone"
                            dataKey="likes"
                            stroke="#f43f5e"
                            strokeWidth={2.5}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Cumulative User & Content Growth */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="shadow-sm">
                  <CardHeader className="p-5">
                    <CardTitle className="text-base font-bold flex items-center gap-1.5">
                      <Users className="size-4 text-blue-500" />
                      User Growth Over Time
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Cumulative registered creator profiles
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    {userGrowthData.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        No creators registered yet
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={userGrowthData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                          <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={10} />
                          <YAxis stroke="var(--color-muted-foreground)" fontSize={10} />
                          <Tooltip
                            contentStyle={{
                              background: "var(--color-popover)",
                              border: "1px solid var(--color-border)",
                              borderRadius: 12,
                              fontSize: "11px",
                            }}
                          />
                          <Bar dataKey="users" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="p-5">
                    <CardTitle className="text-base font-bold flex items-center gap-1.5">
                      <Video className="size-4 text-emerald-500" />
                      Content Growth Over Time
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Cumulative links mapped in database
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    {contentGrowthData.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        No videos loaded yet
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={contentGrowthData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                          <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={10} />
                          <YAxis stroke="var(--color-muted-foreground)" fontSize={10} />
                          <Tooltip
                            contentStyle={{
                              background: "var(--color-popover)",
                              border: "1px solid var(--color-border)",
                              borderRadius: 12,
                              fontSize: "11px",
                            }}
                          />
                          <Bar dataKey="content" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Creators & Platform Breakdown */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="shadow-sm">
                  <CardHeader className="p-5">
                    <CardTitle className="text-base font-bold flex items-center gap-1.5">
                      <Sparkles className="size-4 text-indigo-500" />
                      Top Creators
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Profiles ranked by total views aggregate
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    {topCreatorsData.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        No creator statistics available
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topCreatorsData} layout="vertical" margin={{ left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                          <XAxis
                            type="number"
                            stroke="var(--color-muted-foreground)"
                            fontSize={10}
                            tickFormatter={(v) => formatCount(v)}
                          />
                          <YAxis
                            type="category"
                            dataKey="username"
                            stroke="var(--color-muted-foreground)"
                            fontSize={10}
                            width={80}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "var(--color-popover)",
                              border: "1px solid var(--color-border)",
                              borderRadius: 12,
                              fontSize: "11px",
                            }}
                            formatter={(v: any) => [`${v.toLocaleString()} views`]}
                          />
                          <Bar dataKey="views" fill="#6366f1" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="p-5">
                    <CardTitle className="text-base font-bold">Views by Social Media Platform</CardTitle>
                    <CardDescription className="text-xs">
                      Aggregate views weighted per channel
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    {platformData.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        No videos loaded yet
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={platformData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                          <XAxis dataKey="platform" stroke="var(--color-muted-foreground)" fontSize={10} />
                          <YAxis
                            stroke="var(--color-muted-foreground)"
                            fontSize={10}
                            tickFormatter={(v) => formatCount(v)}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "var(--color-popover)",
                              border: "1px solid var(--color-border)",
                              borderRadius: 12,
                              fontSize: "11px",
                            }}
                            formatter={(v: any) => [`${v.toLocaleString()} views`]}
                          />
                          <Bar dataKey="views" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Large Top 10 Videos detailed table */}
              <Card className="shadow-sm">
                <CardHeader className="p-5">
                  <CardTitle className="text-base font-bold">Top performing video links (All Platforms)</CardTitle>
                  <CardDescription className="text-xs">
                    The top 10 linked videos ranked by accumulated views
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Video</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="text-right">Likes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topVideosList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-xs text-muted-foreground">
                            No content videos mapped yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        topVideosList.map((v) => (
                          <TableRow key={v.id} className="text-xs">
                            <TableCell className="font-semibold max-w-[200px] truncate">
                              <a
                                href={v.url}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:text-primary flex items-center gap-1"
                              >
                                {v.title || "Untitled Video"}
                              </a>
                            </TableCell>
                            <TableCell>{v.channel_name || "—"}</TableCell>
                            <TableCell>{v.team_name}</TableCell>
                            <TableCell className="capitalize">{v.platform}</TableCell>
                            <TableCell className="text-right font-bold">
                              {v.last_view_count?.toLocaleString() || 0}
                            </TableCell>
                            <TableCell className="text-right text-rose-500">
                              {v.last_like_count?.toLocaleString() || 0}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 3: ACTIVITY TIMELINE (Task 9) */}
          {activeTab === "activity" && (
            <Card className="shadow-sm animate-in fade-in duration-200">
              <CardHeader className="p-5 border-b border-border">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Activity className="size-4 text-primary" />
                  Live Platform Activity Logs
                </CardTitle>
                <CardDescription className="text-xs">
                  Real-time events aggregated from workspace registrations, group setups, and content uploads.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {activityFeedEvents.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No activity records found on the system.
                  </div>
                ) : (
                  <div className="relative border-l border-border pl-6 space-y-6">
                    {activityFeedEvents.map((event) => {
                      const Icon = event.icon;
                      return (
                        <div key={event.id} className="relative group">
                          {/* Dot Icon */}
                          <span className={`absolute -left-[37px] top-0.5 flex size-6 items-center justify-center rounded-full ring-4 ring-background ${event.color}`}>
                            <Icon className="size-3.5" />
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-foreground">{event.title}</h4>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(event.timestamp).toLocaleString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                              {event.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* TAB 4: SETTINGS (Task 10) */}
          {activeTab === "settings" && (
            <Card className="shadow-sm max-w-2xl animate-in fade-in duration-200">
              <CardHeader className="p-5">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Settings className="size-4 text-primary" />
                  Admin Console Settings
                </CardTitle>
                <CardDescription className="text-xs">
                  Configure feature flags, default landing views, and console parameters. Persisted locally.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSaveSettings} className="space-y-6 text-sm">
                  {/* App Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="appName">Application Console Name</Label>
                    <Input
                      id="appName"
                      value={settings.appName}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, appName: e.target.value }))
                      }
                      placeholder="e.g. ReelHub Admin"
                      required
                    />
                  </div>

                  {/* Refresh Interval */}
                  <div className="space-y-1.5">
                    <Label htmlFor="refreshInterval">System Sync Cooldown</Label>
                    <Select
                      value={settings.refreshInterval}
                      onValueChange={(v) =>
                        setSettings((prev) => ({ ...prev, refreshInterval: v }))
                      }
                    >
                      <SelectTrigger id="refreshInterval">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1h">1 Hour</SelectItem>
                        <SelectItem value="6h">6 Hours (Recommended)</SelectItem>
                        <SelectItem value="12h">12 Hours</SelectItem>
                        <SelectItem value="24h">24 Hours</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      Regulates the background scheduler parameters for full API updates.
                    </p>
                  </div>

                  {/* Feature Toggles */}
                  <div className="space-y-3.5 border-t border-border pt-4">
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                      Feature Flags
                    </h3>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="toggle-sync" className="font-medium">
                          Automated API Syncing
                        </Label>
                        <p className="text-[10px] text-muted-foreground">
                          Run scheduled API sync operations automatically.
                        </p>
                      </div>
                      <Switch
                        id="toggle-sync"
                        checked={settings.syncEnabled}
                        onCheckedChange={(checked) =>
                          setSettings((prev) => ({ ...prev, syncEnabled: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="toggle-registrations" className="font-medium">
                          Allow User Registrations
                        </Label>
                        <p className="text-[10px] text-muted-foreground">
                          Toggle whether new users can register accounts.
                        </p>
                      </div>
                      <Switch
                        id="toggle-registrations"
                        checked={settings.registrationsEnabled}
                        onCheckedChange={(checked) =>
                          setSettings((prev) => ({ ...prev, registrationsEnabled: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="toggle-groups" className="font-medium">
                          Collaborative Group Creation
                        </Label>
                        <p className="text-[10px] text-muted-foreground">
                          Allow users to spawn new collaboration teams.
                        </p>
                      </div>
                      <Switch
                        id="toggle-groups"
                        checked={settings.groupsCreationEnabled}
                        onCheckedChange={(checked) =>
                          setSettings((prev) => ({ ...prev, groupsCreationEnabled: checked }))
                        }
                      />
                    </div>
                  </div>

                  {/* Default Dashboard */}
                  <div className="space-y-1.5 border-t border-border pt-4">
                    <Label htmlFor="defaultDashboard">Default Landing Dashboard View</Label>
                    <Select
                      value={settings.defaultDashboard}
                      onValueChange={(v: any) =>
                        setSettings((prev) => ({ ...prev, defaultDashboard: v }))
                      }
                    >
                      <SelectTrigger id="defaultDashboard">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="overview">Overview</SelectItem>
                        <SelectItem value="analytics">Analytics</SelectItem>
                        <SelectItem value="activity">Activity Timeline</SelectItem>
                        <SelectItem value="settings">Settings</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="submit">Save Configurations</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </AppLayout>
  );
}
