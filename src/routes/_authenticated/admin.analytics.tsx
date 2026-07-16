import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Settings,
  Database,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Play,
  Activity,
  ShieldCheck,
  AlertCircle,
  Clock,
  History,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getAnalyticsSyncStatus,
  triggerFullSync,
} from "@/lib/analytics.functions";
import { useAdminAnalyticsSummary } from "@/hooks/use-data";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  component: AnalyticsSettingsPage,
});

function AnalyticsSettingsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const getStatusFn = useServerFn(getAnalyticsSyncStatus);
  const triggerFullSyncFn = useServerFn(triggerFullSync);
  
  const [syncing, setSyncing] = useState(false);

  const { data: analyticsData, isLoading: analyticsLoading } = useAdminAnalyticsSummary();

  // Fetch status logs
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-sync-status"],
    queryFn: () => getStatusFn(),
    enabled: isAdmin,
  });

  const handleExportCsv = () => {
    if (!analyticsData?.length) return;
    const headers = ["Team", "Videos", "Views", "Likes", "Comments"];
    const rows = analyticsData.map((item) => [item.team_name, item.video_count, item.total_views, item.total_likes, item.total_comments]);
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "admin-analytics.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    if (!analyticsData?.length) return;
    const headers = ["Team", "Videos", "Views", "Likes", "Comments"];
    const rows = analyticsData.map((item) => [item.team_name, item.video_count, item.total_views, item.total_likes, item.total_comments]);
    const tsv = [headers, ...rows].map((row) => row.join("\t")).join("\n");
    const blob = new Blob([tsv], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "admin-analytics.xls";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFullSync = async () => {
    if (syncing) return;
    setSyncing(true);
    const toastId = toast.loading("Triggering full platform synchronization...");
    try {
      const res = await triggerFullSyncFn();
      if (res.ok) {
        toast.success(`Sync finished! Mapped ${res.succeeded} videos successfully.`, {
          id: toastId,
        });
        refetch();
        // Invalidate all general view keys
        qc.invalidateQueries();
      } else {
        toast.error("Full synchronization failed", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred during sync", { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <AlertCircle className="size-10 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold mt-4">Unauthorized Access</h1>
          <p className="text-sm text-muted-foreground mt-2">Only administrators can view sync logs and configuration.</p>
          <Button className="mt-4" asChild>
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin">
              <ArrowLeft className="mr-1 size-4" /> Back to Admin
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            Export Excel
          </Button>
          <Button
            size="sm"
            onClick={handleFullSync}
            disabled={syncing || !data?.apiKeyConfigured}
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>Refresh All</span>
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Activity className="size-7 text-primary" /> Analytics Engine Settings
        </h1>
        <p className="mt-1 text-muted-foreground">
          Configure synchronization settings, monitor YouTube Data API integration, and view full logs.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── System Status Overview ────────────────────── */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-muted-foreground text-sm">Global Analytics Overview</h3>
                <p className="mt-1 text-sm text-muted-foreground">Platform-wide analytics across all groups and content.</p>
              </div>
              <Badge variant="secondary">{analyticsData?.length ?? 0} teams</Badge>
            </div>
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-center">Videos</TableHead>
                    <TableHead className="text-center">Views</TableHead>
                    <TableHead className="text-center">Likes</TableHead>
                    <TableHead className="text-center">Comments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analyticsLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                        Loading analytics...
                      </TableCell>
                    </TableRow>
                  ) : analyticsData?.length ? (
                    analyticsData.map((item) => (
                      <TableRow key={item.group_id}>
                        <TableCell className="font-medium">{item.team_name}</TableCell>
                        <TableCell className="text-center">{item.video_count}</TableCell>
                        <TableCell className="text-center">{item.total_views}</TableCell>
                        <TableCell className="text-center">{item.total_likes}</TableCell>
                        <TableCell className="text-center">{item.total_comments}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                        No analytics records available yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold text-muted-foreground text-sm">YouTube API Config</h3>
              <div className="mt-3 flex items-center gap-2">
                {data?.apiKeyConfigured ? (
                  <>
                    <Badge className="bg-success/15 text-success border-success/30 border" variant="outline">
                      <CheckCircle className="mr-1 size-3.5" /> Configured
                    </Badge>
                    <span className="text-xs text-muted-foreground">API key resides securely on server</span>
                  </>
                ) : (
                  <>
                    <Badge className="bg-destructive/15 text-destructive border-destructive/30 border" variant="outline">
                      <AlertTriangle className="mr-1 size-3.5" /> Missing API Key
                    </Badge>
                    <span className="text-xs text-muted-foreground">Set YOUTUBE_API_KEY env variable</span>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold text-muted-foreground text-sm">YouTube Link Database</h3>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold">{data?.totalYoutube}</span>
                <span className="text-xs text-muted-foreground">YouTube videos tracked</span>
              </div>
              <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                <span className="text-success font-medium">{data?.syncedYoutube} synced</span>
                <span className="text-destructive font-medium">{data?.failedYoutube} failed</span>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold text-muted-foreground text-sm">System Cron Status</h3>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Clock className="size-3.5 text-primary" /> Active (6 Hours)
                </Badge>
                <span className="text-xs text-muted-foreground">Sync triggers background scan</span>
              </div>
            </div>
          </div>

          {/* ── Quota Details Alert ────────────────────────── */}
          <div className="rounded-2xl border border-border bg-secondary/10 p-5">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> API Quota Optimization Notes
            </h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              To conserve your daily free allocation of <strong>10,000 YouTube Data API quota units</strong>, 
              automatic sync executes exactly <strong>every 6 hours</strong>. Manual single-video refreshes 
              by owners are throttled through a <strong>5-minute rate limit cooldown</strong>.
            </p>
          </div>

          {/* ── Recent Synchronization Logs ────────────────── */}
          <div className="rounded-2xl border border-border bg-card">
            <div className="border-b border-border p-4 flex items-center gap-2">
              <History className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">Synchronization History</h2>
            </div>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Triggered At</TableHead>
                    <TableHead>Execution Time</TableHead>
                    <TableHead className="text-center">Total Videos</TableHead>
                    <TableHead className="text-center">Succeeded</TableHead>
                    <TableHead className="text-center">Failed</TableHead>
                    <TableHead>Status / Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!data?.logs || data.logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No synchronization events recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.logs.map((log: any) => {
                      const elapsed = log.completed_at
                        ? `${Math.round(
                            (new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000
                          )}s`
                        : "Running...";
                        
                      const status = log.completed_at
                        ? log.videos_failed > 0
                          ? "partial"
                          : "success"
                        : "running";

                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium text-xs">
                            {new Date(log.started_at).toLocaleString()}
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {formatDistanceToNow(new Date(log.started_at), { addSuffix: true })}
                            </p>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{elapsed}</TableCell>
                          <TableCell className="text-center font-semibold text-xs">{log.videos_processed}</TableCell>
                          <TableCell className="text-center text-success text-xs">{log.videos_succeeded}</TableCell>
                          <TableCell className="text-center text-destructive text-xs">{log.videos_failed}</TableCell>
                          <TableCell>
                            {status === "success" && (
                              <Badge className="bg-success/15 text-success border-success/30 border" variant="outline">
                                Completed
                              </Badge>
                            )}
                            {status === "partial" && (
                              <Badge className="bg-warning/15 text-warning border-warning/30 border" variant="outline" title={log.error_summary || undefined}>
                                Errors logged
                              </Badge>
                            )}
                            {status === "running" && (
                              <Badge className="bg-secondary text-foreground animate-pulse" variant="outline">
                                Syncing...
                              </Badge>
                            )}
                            {log.error_summary && (
                              <p className="text-[10px] text-destructive truncate max-w-xs mt-1" title={log.error_summary}>
                                {log.error_summary.split("\n")[0]}
                              </p>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
