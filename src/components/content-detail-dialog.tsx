import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { Eye, Heart, MessageSquare, Clock, ExternalLink, Calendar, RefreshCw } from "lucide-react";
import { formatCount } from "@/lib/youtube";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from "recharts";
import type { VideoLink } from "@/hooks/use-data";
import { PlatformBadge } from "@/components/platform-badge";
import { SyncStatusBadge } from "@/components/sync-status-badge";
import { VideoThumbnail } from "@/components/video-thumbnail";
import { useGroupMetricsHistory } from "@/hooks/use-data";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { syncVideoAnalytics } from "@/lib/analytics.functions";

export function ContentDetailDialog({
  video,
  open,
  onOpenChange,
}: {
  video: VideoLink | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const syncFn = useServerFn(syncVideoAnalytics);
  const { data: historyData = [] } = useGroupMetricsHistory(video?.group_id || "");

  const chartData = useMemo(() => {
    if (!video || !historyData.length) return [];
    
    const videoHistory = historyData.filter(h => h.video_link_id === video.id);
    const sorted = [...videoHistory].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    
    return sorted.map(h => ({
      date: new Date(h.recorded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      views: h.views,
      likes: h.likes,
      comments: h.comments,
    }));
  }, [video, historyData]);

  const handleRefresh = async () => {
    if (!video) return;
    const toastId = toast.loading("Syncing content...");
    try {
      const res = await syncFn({ data: { videoLinkId: video.id } });
      if (res.ok) {
        toast.success("Content synced successfully", { id: toastId });
        qc.invalidateQueries({ queryKey: ["video-links", video.group_id] });
        qc.invalidateQueries({ queryKey: ["group-metrics-history", video.group_id] });
      } else {
        toast.error(`Sync failed: ${res.error}`, { id: toastId });
      }
    } catch (e: any) {
      toast.error(e.message || "An unexpected error occurred", { id: toastId });
    }
  };

  if (!video) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold line-clamp-1">{video.title || "Untitled Video"}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 mt-2">
            <PlatformBadge platform={video.platform} />
            <SyncStatusBadge status={video.sync_status} />
            <a 
              href={video.url} 
              target="_blank" 
              rel="noreferrer" 
              className="text-primary hover:underline flex items-center gap-1 text-sm font-medium ml-2"
            >
              <ExternalLink className="size-3" /> View Original
            </a>
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 md:grid-cols-[300px_1fr] mt-4">
          <div className="space-y-4">
            {/* Thumbnail */}
            <div className="w-full aspect-video rounded-xl overflow-hidden border border-border bg-secondary/50">
              <VideoThumbnail
                platform={video.platform}
                thumbnailUrl={video.thumbnail_url}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Action/Info Bar */}
            <div className="flex flex-col gap-3">
              <Button onClick={handleRefresh} variant="outline" className="w-full justify-center gap-2">
                <RefreshCw className="size-4" /> Refresh Data
              </Button>
              <div className="text-sm text-muted-foreground space-y-2 border-t border-border pt-4 mt-2">
                {video.channel_name && (
                  <p className="flex justify-between">
                    <span>Creator:</span>
                    <span className="font-medium text-foreground">{video.channel_name}</span>
                  </p>
                )}
                {video.published_at && (
                  <p className="flex justify-between">
                    <span>Published:</span>
                    <span className="font-medium text-foreground">{new Date(video.published_at).toLocaleDateString()}</span>
                  </p>
                )}
                 <p className="flex justify-between">
                    <span>Last Synced:</span>
                    <span className="font-medium text-foreground">
                      {video.last_synced ? new Date(video.last_synced).toLocaleString() : "Never"}
                    </span>
                  </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Views"
                value={formatCount(video.last_view_count ?? 0)}
                icon={<Eye className="size-4" />}
                accent
              />
              <StatCard
                label="Likes"
                value={formatCount(video.last_like_count ?? 0)}
                icon={<Heart className="size-4" />}
              />
              <StatCard
                label="Comments"
                value={formatCount(video.last_comment_count ?? 0)}
                icon={<MessageSquare className="size-4" />}
              />
            </div>

            {/* Historical Chart */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold text-sm mb-4">Performance History</h3>
              <div className="h-64">
                {chartData.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
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
                      />
                      <Line
                        type="monotone"
                        dataKey="views"
                        stroke="var(--color-primary)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        name="Views"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    {chartData.length === 1 ? "Not enough data for chart (need at least 2 points)" : "No historical data available."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
