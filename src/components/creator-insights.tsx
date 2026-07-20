import { useMemo, useState } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import { 
  Lightbulb, 
  Trophy, 
  TrendingUp, 
  Filter, 
  MessageSquare, 
  Heart, 
  Eye, 
  Users, 
  BarChart3, 
  Calendar, 
  Layers, 
  Clock, 
  Search,
  CheckCircle,
  Video,
  ListTodo
} from "lucide-react";
import { type VideoLink } from "@/hooks/use-data";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { VideoThumbnail } from "@/components/video-thumbnail";
import { formatCount } from "@/lib/youtube";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_LABELS, type Platform } from "@/lib/video-platforms";
import { PlatformBadge } from "@/components/platform-badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

interface CreatorInsightsProps {
  videos: VideoLink[];
  metricsHistory: any[];
  members: any[];
  allGroups?: any[];
  allCreators?: any[];
}

const COLORS = ['#ef4444', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#6366f1'];

export function CreatorInsights({ videos, metricsHistory, members, allGroups = [], allCreators = [] }: CreatorInsightsProps) {
  // Filter States
  const [searchKeyword, setSearchKeyword] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState("all");

  const [topSort, setTopSort] = useState<"views" | "likes" | "comments" | "engagement">("views");

  const getTeamName = (groupId: string | undefined | null) => {
    if (!groupId) return "Independent Creators";
    const group = allGroups.find((g) => g.id === groupId);
    return group?.team_name || "Independent Creators";
  };

  // Client-Side Video Filtering
  const filteredVideos = useMemo(() => {
    return videos.filter((v) => {
      // 1. Search keyword
      if (searchKeyword.trim()) {
        const keyword = searchKeyword.toLowerCase();
        const matches =
          (v.title ?? "").toLowerCase().includes(keyword) ||
          v.url.toLowerCase().includes(keyword) ||
          v.platform.toLowerCase().includes(keyword) ||
          (getTeamName(v.group_id) ?? "").toLowerCase().includes(keyword) ||
          (v.channel_name ?? "").toLowerCase().includes(keyword);
        if (!matches) return false;
      }

      // 2. Platform filter
      if (platformFilter !== "all" && v.platform !== platformFilter) return false;

      // 3. Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "pending" && (v.sync_status === "idle" || v.sync_status === "pending")) {
          // OK
        } else if (v.sync_status !== statusFilter) {
          return false;
        }
      }

      // 4. Team filter
      if (teamFilter !== "all" && v.group_id !== teamFilter) return false;

      // 5. Creator filter
      if (creatorFilter !== "all" && v.created_by !== creatorFilter) return false;

      // 6. Date Range filter
      if (dateRangeFilter !== "all") {
        const publishedMs = new Date(v.published_at || v.created_at).getTime();
        const nowMs = Date.now();
        const days = dateRangeFilter === "7d" ? 7 : dateRangeFilter === "30d" ? 30 : 90;
        if (nowMs - publishedMs > days * 24 * 60 * 60 * 1000) return false;
      }

      return true;
    });
  }, [videos, searchKeyword, platformFilter, statusFilter, teamFilter, creatorFilter, dateRangeFilter]);

  // Filter history data matching filtered videos
  const filteredHistory = useMemo(() => {
    const videoIds = new Set(filteredVideos.map(v => v.id));
    return metricsHistory.filter(h => videoIds.has(h.content_id || h.video_link_id));
  }, [metricsHistory, filteredVideos]);

  // Dynamic Statistics Calculations (Task 1)
  const stats = useMemo(() => {
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let lastUpdated = 0;
    const platformCounts: Record<string, number> = {};

    filteredVideos.forEach((v) => {
      totalViews += v.last_view_count || 0;
      totalLikes += v.last_like_count || 0;
      totalComments += v.last_comment_count || 0;
      
      const vUpdated = new Date(v.last_fetched_at || v.created_at).getTime();
      if (vUpdated > lastUpdated) lastUpdated = vUpdated;

      platformCounts[v.platform] = (platformCounts[v.platform] || 0) + 1;
    });

    const engagementRate = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;
    const avgViewsPerVideo = filteredVideos.length > 0 ? Math.round(totalViews / filteredVideos.length) : 0;
    const totalMembersCount = new Set(filteredVideos.map(v => v.created_by)).size || (members?.length ?? 0);
    const totalGroupsCount = new Set(filteredVideos.map(v => v.group_id).filter(Boolean)).size || (allGroups?.length ?? 0);

    return {
      totalMembers: totalMembersCount,
      totalGroups: totalGroupsCount,
      totalVideos: filteredVideos.length,
      totalViews,
      totalLikes,
      totalComments,
      engagementRate,
      avgViewsPerVideo
    };
  }, [filteredVideos, members, allGroups]);

  // Chart data 1: Views by Platform Bar Chart
  const viewsByPlatformData = useMemo(() => {
    const views: Record<string, number> = { youtube: 0, tiktok: 0, instagram: 0, facebook: 0 };
    filteredVideos.forEach((v) => {
      views[v.platform] = (views[v.platform] || 0) + (v.last_view_count || 0);
    });
    return Object.entries(views).map(([platform, count]) => ({
      platform: PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS] || platform,
      views: count
    }));
  }, [filteredVideos]);

  // Chart data 2: Platform Distribution Pie Chart
  const platformDistributionData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredVideos.forEach((v) => {
      counts[v.platform] = (counts[v.platform] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: PLATFORM_LABELS[name as keyof typeof PLATFORM_LABELS] || name,
      value
    }));
  }, [filteredVideos]);

  // Top Performing videos listing
  const topContent = useMemo(() => {
    return [...filteredVideos].sort((a, b) => {
      if (topSort === "views") return (b.last_view_count || 0) - (a.last_view_count || 0);
      if (topSort === "likes") return (b.last_like_count || 0) - (a.last_like_count || 0);
      if (topSort === "comments") return (b.last_comment_count || 0) - (a.last_comment_count || 0);
      if (topSort === "engagement") {
        const aEng = a.last_view_count ? ((a.last_like_count || 0) + (a.last_comment_count || 0)) / a.last_view_count : 0;
        const bEng = b.last_view_count ? ((b.last_like_count || 0) + (b.last_comment_count || 0)) / b.last_view_count : 0;
        return bEng - aEng;
      }
      return 0;
    }).slice(0, 5);
  }, [filteredVideos, topSort]);

  // Dynamic Contest Leaderboard calculations (Task 3)
  const teamStandings = useMemo(() => {
    const standingsMap: Record<string, {
      teamName: string;
      membersCount: number;
      videoCount: number;
      views: number;
      likes: number;
      comments: number;
      platforms: Set<string>;
    }> = {};

    filteredVideos.forEach((v) => {
      const teamId = v.group_id || "unassigned";
      const teamName = getTeamName(v.group_id);
      
      if (!standingsMap[teamId]) {
        standingsMap[teamId] = {
          teamName,
          membersCount: 0,
          videoCount: 0,
          views: 0,
          likes: 0,
          comments: 0,
          platforms: new Set<string>(),
        };
      }
      
      const s = standingsMap[teamId];
      s.videoCount += 1;
      s.views += v.last_view_count || 0;
      s.likes += v.last_like_count || 0;
      s.comments += v.last_comment_count || 0;
      if (v.platform) s.platforms.add(v.platform);
    });

    // Populate membersCount
    Object.entries(standingsMap).forEach(([teamId, s]) => {
      if (teamId === "unassigned") {
        s.membersCount = new Set(filteredVideos.filter(v => !v.group_id).map(v => v.created_by)).size;
      } else {
        const groupObj = allGroups.find(g => g.id === teamId);
        s.membersCount = groupObj?.member_names?.length || 1;
      }
    });

    return Object.entries(standingsMap)
      .map(([id, data]) => {
        const engagement = data.views > 0 ? ((data.likes + data.comments) / data.views) * 100 : 0;
        return {
          id,
          ...data,
          engagement,
        };
      })
      .sort((a, b) => b.views - a.views);
  }, [filteredVideos, allGroups]);

  // AI insights generator
  const insights = useMemo(() => {
    const list = [];
    let bestPlatform = "None";
    let maxPlatformViews = -1;
    const viewsByP: Record<string, number> = {};
    
    filteredVideos.forEach((v) => {
      viewsByP[v.platform] = (viewsByP[v.platform] || 0) + (v.last_view_count || 0);
    });

    Object.entries(viewsByP).forEach(([platform, views]) => {
      if (views > maxPlatformViews) {
        maxPlatformViews = views;
        bestPlatform = platform;
      }
    });

    if (bestPlatform !== "None") {
      list.push(`Your ${PLATFORM_LABELS[bestPlatform as keyof typeof PLATFORM_LABELS] || bestPlatform} content drives the most views.`);
    }
    if (stats.engagementRate > 5) {
      list.push(`Great engagement! Your audience interacts with ${stats.engagementRate.toFixed(1)}% of your views.`);
    }
    if (stats.avgViewsPerVideo > 1000) {
      list.push(`Impressive! Videos average ${stats.avgViewsPerVideo.toLocaleString()} views.`);
    }
    return list;
  }, [filteredVideos, stats]);

  return (
    <div className="space-y-6">
      {/* ── Filters & Search Panel ────────────────────────── */}
      <Card className="p-5 shadow-sm border border-border bg-card">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Filter className="size-4 text-primary" /> Advanced Analytics Filters
          </CardTitle>
          <CardDescription className="text-xs">Filter content library and charts simultaneously</CardDescription>
        </CardHeader>
        <div className="space-y-4">
          {/* Row 1: Search */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 h-9 text-xs"
              placeholder="Search team name, members, video title, platform..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
          </div>

          {/* Row 2: Selects */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>

            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="success">Synced</SelectItem>
                <SelectItem value="error">Sync Failed</SelectItem>
              </SelectContent>
            </Select>

            {/* Team Filter (Admin only or if group selection lists are passed) */}
            {allGroups.length > 0 && (
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {allGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.team_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Creator Filter */}
            {allCreators.length > 0 && (
              <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Creator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Creators</SelectItem>
                  {allCreators.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs border-dashed"
              onClick={() => {
                setSearchKeyword("");
                setPlatformFilter("all");
                setStatusFilter("all");
                setTeamFilter("all");
                setCreatorFilter("all");
                setDateRangeFilter("all");
              }}
            >
              Reset Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* ── 8 Analytics Cards Grid ────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <StatCard label="Total Members" value={stats.totalMembers} icon={<Users className="size-4" />} />
        <StatCard label="Total Groups" value={stats.totalGroups} icon={<Layers className="size-4 text-accent" />} />
        <StatCard label="Total Videos" value={stats.totalVideos} icon={<Video className="size-4 text-success" />} />
        <StatCard label="Total Views" value={stats.totalViews.toLocaleString()} icon={<Eye className="size-4" />} />
        <StatCard label="Total Likes" value={stats.totalLikes.toLocaleString()} icon={<Heart className="size-4" />} />
        <StatCard label="Total Comments" value={stats.totalComments.toLocaleString()} icon={<MessageSquare className="size-4 text-primary" />} />
        <StatCard label="Engagement Rate" value={`${stats.engagementRate.toFixed(2)}%`} icon={<TrendingUp className="size-4" />} accent />
        <StatCard label="Avg Views / Video" value={stats.avgViewsPerVideo.toLocaleString()} icon={<Trophy className="size-4 text-amber-500" />} />
      </div>

      {/* ── Visual Charts Suite ───────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Platform Distribution Pie Chart */}
        <Card className="p-5">
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
        <Card className="p-5">
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
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
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
                  <Bar dataKey="views" fill="url(#barGradient)" radius={[6, 6, 0, 0]} isAnimationActive={true} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* ── Dynamic Contest Leaderboard Table (Task 3) ────── */}
      <Card className="shadow-sm border border-border bg-card">
        <CardHeader className="p-5 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Trophy className="size-5 text-amber-500" /> Contest Standings
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">Real-time team standings across all content channels</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center text-xs">Rank</TableHead>
                  <TableHead className="text-xs">Team</TableHead>
                  <TableHead className="text-center text-xs">Members</TableHead>
                  <TableHead className="text-center text-xs">Videos</TableHead>
                  <TableHead className="text-right text-xs">Views</TableHead>
                  <TableHead className="text-right text-xs">Likes</TableHead>
                  <TableHead className="text-right text-xs">Comments</TableHead>
                  <TableHead className="text-right text-xs">Engagement %</TableHead>
                  <TableHead className="text-center text-xs">Platforms</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamStandings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-xs text-muted-foreground py-6">
                      No team standings available yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  teamStandings.map((team, idx) => {
                    const rank = idx + 1;
                    // Styling top three teams (Gold, Silver, Bronze)
                    const rankStyles = 
                      rank === 1 ? "bg-yellow-500/10 text-yellow-600 border border-yellow-500/30" :
                      rank === 2 ? "bg-zinc-400/15 text-zinc-500 border border-zinc-400/20" :
                      rank === 3 ? "bg-amber-600/10 text-amber-700 border border-amber-600/25" :
                      "bg-secondary/40 text-muted-foreground";

                    return (
                      <TableRow key={team.id} className="hover:bg-secondary/15 transition-colors">
                        <TableCell className="text-center">
                          <span className={`inline-grid size-6 place-items-center rounded-full text-xs font-bold ${rankStyles}`}>
                            {rank}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold text-xs text-foreground truncate max-w-[180px]">
                          {team.teamName}
                        </TableCell>
                        <TableCell className="text-center text-xs font-medium">{team.membersCount}</TableCell>
                        <TableCell className="text-center text-xs font-medium">{team.videoCount}</TableCell>
                        <TableCell className="text-right text-xs font-mono font-bold text-foreground">
                          {team.views.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">{team.likes.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{team.comments.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-xs font-mono font-semibold text-primary">
                          {team.engagement.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {Array.from(team.platforms).map((p) => (
                              <PlatformBadge key={p} platform={p as Platform} />
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Intelligence Box */}
      <Card className="p-5">
        <CardTitle className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Lightbulb className="size-5 text-primary" /> Intelligence Insights
        </CardTitle>
        <ul className="space-y-3">
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enough data to generate recommendations yet.</p>
          ) : (
            insights.map((insight, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                <div className="mt-1.5 size-1.5 rounded-full bg-primary shrink-0" />
                <span>{insight}</span>
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}
