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
  Line
} from "recharts";
import { Lightbulb, Trophy, TrendingUp, Filter, ExternalLink, MessageSquare, Heart, Eye } from "lucide-react";
import { type VideoLink } from "@/hooks/use-data";
import { StatCard } from "@/components/stat-card";
import { VideoThumbnail } from "@/components/video-thumbnail";
import { VideoStatsBadge } from "@/components/video-stats-badge";
import { formatCount } from "@/lib/youtube";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLATFORM_LABELS } from "@/lib/video-platforms";

interface CreatorInsightsProps {
  videos: VideoLink[];
  metricsHistory: any[];
}

const COLORS = ['#ef4444', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#6366f1'];

export function CreatorInsights({ videos, metricsHistory }: CreatorInsightsProps) {
  const [topSort, setTopSort] = useState<"views" | "likes" | "comments" | "engagement">("views");

  const stats = useMemo(() => {
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let lastUpdated = 0;
    const platformCounts: Record<string, number> = {};
    const platformViews: Record<string, number> = {};

    videos.forEach((v) => {
      totalViews += v.last_view_count || 0;
      totalLikes += v.last_like_count || 0;
      totalComments += v.last_comment_count || 0;
      
      const vUpdated = new Date(v.last_fetched_at || v.created_at).getTime();
      if (vUpdated > lastUpdated) lastUpdated = vUpdated;

      platformCounts[v.platform] = (platformCounts[v.platform] || 0) + 1;
      platformViews[v.platform] = (platformViews[v.platform] || 0) + (v.last_view_count || 0);
    });

    const avgEngagement = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;
    
    let bestPlatform = "None";
    let maxPlatformViews = -1;
    Object.entries(platformViews).forEach(([platform, views]) => {
      if (views > maxPlatformViews) {
        maxPlatformViews = views;
        bestPlatform = platform;
      }
    });

    return {
      totalContent: videos.length,
      totalViews,
      totalLikes,
      totalComments,
      avgEngagement,
      lastUpdated: lastUpdated > 0 ? new Date(lastUpdated) : null,
      bestPlatform,
      platformCounts
    };
  }, [videos]);

  const growthChartData = useMemo(() => {
    if (!metricsHistory || metricsHistory.length === 0) return [];
    
    // Group history by date (YYYY-MM-DD)
    const byDate: Record<string, number> = {};
    const sorted = [...metricsHistory].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    
    sorted.forEach((h: any) => {
      const dateStr = new Date(h.recorded_at).toISOString().split('T')[0];
      byDate[dateStr] = (byDate[dateStr] || 0) + (h.views || 0); // Simplified total for that day
    });

    return Object.entries(byDate).map(([date, views]) => ({ date, views }));
  }, [metricsHistory]);

  const topContent = useMemo(() => {
    return [...videos].sort((a, b) => {
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
  }, [videos, topSort]);

  const insights = useMemo(() => {
    const list = [];
    if (stats.bestPlatform !== "None") {
      list.push(`Your ${PLATFORM_LABELS[stats.bestPlatform as keyof typeof PLATFORM_LABELS] || stats.bestPlatform} content drives the most views.`);
    }
    if (stats.avgEngagement > 5) {
      list.push(`Great engagement! Your audience interacts with ${stats.avgEngagement.toFixed(1)}% of your views.`);
    } else if (stats.totalViews > 0) {
      list.push(`Your average engagement rate is ${stats.avgEngagement.toFixed(1)}%.`);
    }
    
    if (stats.lastUpdated) {
      const daysSince = Math.floor((Date.now() - stats.lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince > 2) {
        list.push(`Content hasn't been refreshed in ${daysSince} days.`);
      }
    }
    return list;
  }, [stats]);

  const platformData = useMemo(() => {
    return Object.entries(stats.platformCounts).map(([name, value]) => ({
      name: PLATFORM_LABELS[name as keyof typeof PLATFORM_LABELS] || name,
      value
    }));
  }, [stats.platformCounts]);

  return (
    <div className="space-y-6">
      {/* Profile Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard label="Total Content" value={stats.totalContent.toLocaleString()} icon={<Lightbulb className="size-4" />} accent />
        <StatCard label="Total Views" value={stats.totalViews.toLocaleString()} icon={<Eye className="size-4" />} />
        <StatCard label="Total Likes" value={stats.totalLikes.toLocaleString()} icon={<Heart className="size-4" />} />
        <StatCard label="Total Comments" value={stats.totalComments.toLocaleString()} icon={<MessageSquare className="size-4" />} />
        <StatCard label="Avg Engagement" value={`${stats.avgEngagement.toFixed(2)}%`} icon={<TrendingUp className="size-4 text-success" />} />
        <StatCard label="Best Platform" value={PLATFORM_LABELS[stats.bestPlatform as keyof typeof PLATFORM_LABELS] || stats.bestPlatform} icon={<Trophy className="size-4 text-amber-500" />} />
      </div>

      {/* Insights & Top Content Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Content */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="size-5 text-amber-500" /> Top Performing Content
            </h3>
            <Select value={topSort} onValueChange={(v: any) => setTopSort(v)}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="views">Most Views</SelectItem>
                <SelectItem value="likes">Most Likes</SelectItem>
                <SelectItem value="comments">Most Comments</SelectItem>
                <SelectItem value="engagement">Highest Engagement</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            {topContent.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No content available.</p>
            ) : (
              topContent.map((v, i) => (
                <div key={v.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                  <div className="font-bold text-muted-foreground w-4 text-center">{i + 1}</div>
                  <VideoThumbnail thumbnailUrl={v.thumbnail_url} platform={v.platform} className="w-16 h-10 rounded" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" title={v.title || "Untitled"}>{v.title || "Untitled Content"}</p>
                    <div className="flex text-xs text-muted-foreground gap-2 mt-0.5">
                      <span>{formatCount(v.last_view_count || 0)} views</span>
                      <span>•</span>
                      <span>{formatCount(v.last_like_count || 0)} likes</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Insights & Platform Distribution */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Lightbulb className="size-5 text-primary" /> Intelligence
            </h3>
            <ul className="space-y-3">
              {insights.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not enough data to generate insights.</p>
              ) : (
                insights.map((insight, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <div className="mt-1 size-1.5 rounded-full bg-primary shrink-0" />
                    <span>{insight}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
          
          <div className="rounded-2xl border border-border bg-card p-5">
             <h3 className="text-sm font-semibold mb-4">Platform Distribution</h3>
             <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={platformData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {platformData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                     contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        color: "var(--color-popover-foreground)",
                      }}
                  />
                </PieChart>
              </ResponsiveContainer>
             </div>
          </div>
        </div>
      </div>

      {/* Views Growth Chart */}
      {growthChartData.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" /> Views Growth
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Cumulative views over time</p>
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
    </div>
  );
}
