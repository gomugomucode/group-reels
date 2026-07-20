import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Search,
  Trash2,
  RefreshCw,
  ExternalLink,
  Pencil,
  Download,
  Filter,
  ArrowUpDown,
  Clapperboard,
  Users,
  Copy,
  RotateCcw,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { syncVideoAnalytics } from "@/lib/analytics.functions";
import { 
  adminEditContent, 
  adminDuplicateContent, 
  adminRestoreContent, 
  adminBulkRestore, 
  adminBulkPlatformChange 
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { VideoThumbnail } from "@/components/video-thumbnail";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLATFORMS, PLATFORM_LABELS, type Platform, type LinkStatus } from "@/lib/video-platforms";
import { mapContentToVideoLink, type ContentWithMetrics, type VideoLink } from "@/hooks/use-data";
import { formatCount } from "@/lib/youtube";

export const Route = createFileRoute("/_authenticated/admin/content")({
  component: AdminVideoLinksPage,
});

function AdminVideoLinksPage() {
  const qc = useQueryClient();
  const syncFn = useServerFn(syncVideoAnalytics);

  // States
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState<"all" | Platform>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortField, setSortField] = useState("newest");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Selected videos for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkPlatformId, setBulkPlatformId] = useState<Platform>("youtube");

  // Dialog state
  const [editingLink, setEditingLink] = useState<VideoLink | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    url: "",
    platform: "youtube" as Platform,
    status: "valid" as LinkStatus,
    thumbnailUrl: "",
    notes: "",
    views: 0,
    likes: 0,
    comments: 0,
    watchTimeSeconds: 0,
    engagementRate: 0.00,
    syncStatus: "idle",
    manualOverride: false,
  });

  // Query: Fetch profiles to map "Creator" (Task 4)
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-content-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, username, email");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Query: Fetch all content rows with metrics (Task 4 & 12)
  const { data: videosData = [], isLoading } = useQuery({
    queryKey: ["admin-video-links-list"],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("*, metrics:content_metrics(*), group:groups(team_name)")
        .eq("content_type", "video")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Array<ContentWithMetrics & { group?: { team_name: string | null } }>).map((row) => ({
        ...mapContentToVideoLink(row),
        group: row.group,
      }));
    },
  });

  // Unique teams list derived dynamically (Part 1 & 8)
  const uniqueTeams = useMemo(() => {
    const teamsMap = new Map<string, string>();
    videosData.forEach((v) => {
      if (v.group_id && v.group?.team_name) {
        teamsMap.set(v.group_id, v.group.team_name);
      }
    });
    return Array.from(teamsMap.entries()).map(([id, name]) => ({ id, name }));
  }, [videosData]);

  // Filter & Search computation (Part 1)
  const filteredVideos = useMemo(() => {
    return videosData
      .filter((v) => {
        // Search across title, url, creator name, email, team name
        if (search.trim()) {
          const keyword = search.toLowerCase();
          const creator = profiles.find((p) => p.id === v.created_by);
          const matches =
            (v.title ?? "").toLowerCase().includes(keyword) ||
            v.url.toLowerCase().includes(keyword) ||
            (creator?.username ?? "").toLowerCase().includes(keyword) ||
            (creator?.email ?? "").toLowerCase().includes(keyword) ||
            (v.group?.team_name ?? "").toLowerCase().includes(keyword);
          if (!matches) return false;
        }

        // Team filter
        if (teamFilter !== "all" && v.group_id !== teamFilter) return false;

        // Platform
        if (platformFilter !== "all" && v.platform !== platformFilter) return false;

        // Status filter: success, pending, failed, deleted
        if (statusFilter === "deleted") {
          if (!v.deleted_at) return false;
        } else {
          if (v.deleted_at) return false;
          if (statusFilter !== "all") {
            const match =
              (statusFilter === "pending" && (v.sync_status === "idle" || v.sync_status === "pending" || v.sync_status === "syncing")) ||
              (statusFilter === "success" && v.sync_status === "success") ||
              (statusFilter === "failed" && ((v.sync_status as any) === "error" || (v.sync_status as any) === "failed"));
            if (!match) return false;
          }
        }

        // Date range: 7days, 30days, 90days
        if (dateFilter !== "all") {
          const createdTime = new Date(v.created_at).getTime();
          const now = Date.now();
          const dayMs = 24 * 60 * 60 * 1000;

          if (dateFilter === "7days" && now - createdTime > 7 * dayMs) return false;
          if (dateFilter === "30days" && now - createdTime > 30 * dayMs) return false;
          if (dateFilter === "90days" && now - createdTime > 90 * dayMs) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortField === "newest") {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortField === "oldest") {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sortField === "views-desc") {
          return (b.last_view_count ?? 0) - (a.last_view_count ?? 0);
        }
        if (sortField === "likes-desc") {
          return (b.last_like_count ?? 0) - (a.last_like_count ?? 0);
        }
        return 0;
      });
  }, [videosData, search, teamFilter, platformFilter, statusFilter, dateFilter, sortField, profiles]);

  // Paginated chunk
  const paginatedVideos = useMemo(() => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    return filteredVideos.slice(from, to);
  }, [filteredVideos, page]);

  const totalPages = Math.max(1, Math.ceil(filteredVideos.length / pageSize));

  const editContentFn = useServerFn(adminEditContent);
  const duplicateContentFn = useServerFn(adminDuplicateContent);
  const restoreContentFn = useServerFn(adminRestoreContent);
  const bulkRestoreFn = useServerFn(adminBulkRestore);
  const bulkPlatformChangeFn = useServerFn(adminBulkPlatformChange);

  // Single Item Mutations
  const updateLink = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: typeof editForm }) => {
      const res = await editContentFn({
        data: {
          id,
          title: values.title || null,
          url: values.url,
          platform: values.platform,
          status: values.status,
          thumbnailUrl: values.thumbnailUrl || null,
          notes: values.notes || null,
          views: Number(values.views),
          likes: Number(values.likes),
          comments: Number(values.comments),
          watchTimeSeconds: Number(values.watchTimeSeconds),
          engagementRate: Number(values.engagementRate),
          syncStatus: values.syncStatus,
          manualOverride: values.manualOverride,
        }
      });
      if (!res.ok) throw new Error("Failed to update content details");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-video-links-list"] });
      qc.invalidateQueries({ queryKey: ["video-links-all"] });
      qc.invalidateQueries({ queryKey: ["video-links"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
      qc.invalidateQueries({ queryKey: ["group-analytics-summary"] });
      setEditingLink(null);
      toast.success("Content details saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("content")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-video-links-list"] });
      qc.invalidateQueries({ queryKey: ["video-links-all"] });
      qc.invalidateQueries({ queryKey: ["video-links"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
      qc.invalidateQueries({ queryKey: ["group-analytics-summary"] });
      setSelectedIds((prev) => prev.filter((item) => item !== editingLink?.id));
      toast.success("Content link deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreLink = useMutation({
    mutationFn: async (id: string) => {
      const res = await restoreContentFn({ data: { id } });
      if (!res.ok) throw new Error("Failed to restore link");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-video-links-list"] });
      qc.invalidateQueries({ queryKey: ["video-links-all"] });
      qc.invalidateQueries({ queryKey: ["video-links"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
      qc.invalidateQueries({ queryKey: ["group-analytics-summary"] });
      toast.success("Content link restored successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateLink = useMutation({
    mutationFn: async (id: string) => {
      const res = await duplicateContentFn({ data: { id } });
      if (!res.ok) throw new Error("Failed to duplicate content");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-video-links-list"] });
      qc.invalidateQueries({ queryKey: ["video-links-all"] });
      qc.invalidateQueries({ queryKey: ["video-links"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
      qc.invalidateQueries({ queryKey: ["group-analytics-summary"] });
      toast.success("Content duplicate created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refreshLink = useMutation({
    mutationFn: async (videoLinkId: string) => {
      await syncFn({ data: { videoLinkId, force: true } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-video-links-list"] });
      qc.invalidateQueries({ queryKey: ["video-links-all"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
      qc.invalidateQueries({ queryKey: ["video-links"] });
      qc.invalidateQueries({ queryKey: ["group-analytics-summary"] });
      toast.success("Sync operation started successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Bulk Mutations (Task 7)
  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("content")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-video-links-list"] });
      qc.invalidateQueries({ queryKey: ["video-links-all"] });
      qc.invalidateQueries({ queryKey: ["video-links"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
      qc.invalidateQueries({ queryKey: ["group-analytics-summary"] });
      setSelectedIds([]);
      toast.success("Bulk delete complete");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkRestore = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await bulkRestoreFn({ data: { ids } });
      if (!res.ok) throw new Error("Failed to bulk restore");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-video-links-list"] });
      qc.invalidateQueries({ queryKey: ["video-links-all"] });
      qc.invalidateQueries({ queryKey: ["video-links"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
      qc.invalidateQueries({ queryKey: ["group-analytics-summary"] });
      setSelectedIds([]);
      toast.success("Bulk restore complete");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkPlatformChange = useMutation({
    mutationFn: async ({ ids, platformId }: { ids: string[]; platformId: Platform }) => {
      const res = await bulkPlatformChangeFn({ data: { ids, platformId } });
      if (!res.ok) throw new Error("Failed to change platform in bulk");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-video-links-list"] });
      qc.invalidateQueries({ queryKey: ["video-links-all"] });
      qc.invalidateQueries({ queryKey: ["video-links"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
      qc.invalidateQueries({ queryKey: ["group-analytics-summary"] });
      setSelectedIds([]);
      toast.success("Bulk platform change completed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkRefresh = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await syncFn({ data: { videoLinkId: id, force: true } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-video-links-list"] });
      qc.invalidateQueries({ queryKey: ["video-links-all"] });
      qc.invalidateQueries({ queryKey: ["video-links"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
      qc.invalidateQueries({ queryKey: ["group-analytics-summary"] });
      setSelectedIds([]);
      toast.success("Bulk synchronizations initiated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(paginatedVideos.map((v) => v.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleExportCSV = () => {
    const listToExport =
      selectedIds.length > 0
        ? videosData.filter((v) => selectedIds.includes(v.id))
        : filteredVideos;

    if (listToExport.length === 0) {
      toast.error("No content available to export");
      return;
    }

    const headers = ["Title", "Platform", "Creator", "Team Name", "Views", "Likes", "Comments", "Created At", "Status"];
    const rows = listToExport.map((v) => {
      const creator = profiles.find((p) => p.id === v.created_by);
      return [
        v.title ?? "Untitled",
        v.platform,
        creator?.username ?? "Creator",
        v.group?.team_name ?? "",
        v.last_view_count ?? 0,
        v.last_like_count ?? 0,
        v.last_comment_count ?? 0,
        v.created_at,
        v.status,
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reelhub-content-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV file downloaded successfully!");
  };

  const copyContentUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success("Content URL copied to clipboard");
  };

  const openEditor = (video: VideoLink) => {
    setEditingLink(video);
    setEditForm({
      title: video.title ?? "",
      url: video.url ?? "",
      platform: video.platform ?? "youtube",
      status: video.status ?? "valid",
      thumbnailUrl: video.thumbnail_url ?? "",
      notes: (video as any).notes ?? "",
      views: Number(video.last_view_count ?? 0),
      likes: Number(video.last_like_count ?? 0),
      comments: Number(video.last_comment_count ?? 0),
      watchTimeSeconds: Number((video as any).watch_time_seconds ?? 0),
      engagementRate: Number((video as any).engagement_rate ?? 0.00),
      syncStatus: video.sync_status ?? "idle",
      manualOverride: (video as any).manual_override ?? false,
    });
  };

  const stats = useMemo(() => ({
    total: filteredVideos.length,
    valid: filteredVideos.filter((v) => v.status === "valid").length,
    invalid: filteredVideos.filter((v) => v.status === "invalid").length,
    pending: filteredVideos.filter((v) => v.status === "pending").length,
  }), [filteredVideos]);

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Clapperboard className="size-8 text-primary" />
            Content Database Moderator
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review linked media reels, audit status validations, and manage statistics refreshes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Bulk actions */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card p-1.5 px-3 shadow-sm animate-in fade-in duration-200">
              <span className="text-xs font-semibold text-muted-foreground mr-1.5">
                {selectedIds.length} selected:
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1 text-primary hover:text-primary-foreground"
                onClick={() => bulkRefresh.mutate(selectedIds)}
                disabled={bulkRefresh.isPending}
              >
                <RefreshCw className="size-3" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => bulkRestore.mutate(selectedIds)}
                disabled={bulkRestore.isPending}
              >
                <RotateCcw className="size-3" />
                Restore
              </Button>
              <Select value={bulkPlatformId} onValueChange={(value) => setBulkPlatformId(value as Platform)}>
                <SelectTrigger className="h-8 w-35 text-xs">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {PLATFORM_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => bulkPlatformChange.mutate({ ids: selectedIds, platformId: bulkPlatformId })}
                disabled={bulkPlatformChange.isPending}
              >
                <ArrowUpDown className="size-3" />
                Apply Platform
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    disabled={bulkDelete.isPending}
                  >
                    <Trash2 className="size-3" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {selectedIds.length} Content Links?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes the linked video rows and view logs from the platform.
                      This action is irreversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => bulkDelete.mutate(selectedIds)}>
                      Confirm Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs gap-1.5"
            onClick={handleExportCSV}
          >
            <Download className="size-4" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Basic Metrics Stats Row */}
      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary" className="px-2.5 py-1">
          {stats.total} matching videos
        </Badge>
        <Badge className="border-transparent bg-success/15 text-success px-2.5 py-1" variant="outline">
          {stats.valid} valid links
        </Badge>
        <Badge className="border-transparent bg-destructive/15 text-destructive px-2.5 py-1" variant="outline">
          {stats.invalid} invalid links
        </Badge>
        <Badge className="border-transparent bg-muted/30 text-muted-foreground px-2.5 py-1" variant="outline">
          {stats.pending} pending refresh
        </Badge>
      </div>

      {/* Combined search/filter toolbar (Part 1 & Part 9) */}
      <div className="mb-4 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 p-4 bg-card border border-border rounded-xl">
        {/* Search */}
        <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-xs"
            placeholder="Search title, URL, creator..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>

        {/* Team Dropdown */}
        <div>
          <Select value={teamFilter} onValueChange={(v) => { setPage(1); setTeamFilter(v); }}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {uniqueTeams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Platform Filter */}
        <div>
          <Select value={platformFilter} onValueChange={(v) => { setPage(1); setPlatformFilter(v as any); }}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {PLATFORMS.map((option) => (
                <SelectItem key={option} value={option}>
                  {PLATFORM_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <div>
          <Select value={statusFilter} onValueChange={(v) => { setPage(1); setStatusFilter(v); }}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="success">Synced</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date Filter */}
        <div>
          <Select value={dateFilter} onValueChange={(v) => { setPage(1); setDateFilter(v); }}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="90days">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sorting & Clear Filters Row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Sort By:</span>
          <Select value={sortField} onValueChange={(v) => setSortField(v)}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Sort Order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="views-desc">Most Views</SelectItem>
              <SelectItem value="likes-desc">Most Likes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(search.trim() || teamFilter !== "all" || platformFilter !== "all" || statusFilter !== "all" || dateFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-primary"
            onClick={() => {
              setSearch("");
              setTeamFilter("all");
              setPlatformFilter("all");
              setStatusFilter("all");
              setDateFilter("all");
              setPage(1);
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Content Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg w-full" />
            ))}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        paginatedVideos.length > 0 &&
                        paginatedVideos.every((v) => selectedIds.includes(v.id))
                      }
                      onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                    />
                  </TableHead>
                  <TableHead>Preview</TableHead>
                  <TableHead>Video Details</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedVideos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Clapperboard className="size-8 text-muted-foreground animate-pulse" />
                        <p className="font-semibold text-sm">No matching content found.</p>
                        <p className="text-xs text-muted-foreground">Try changing your filters.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedVideos.map((video) => {
                    const isRowSelected = selectedIds.includes(video.id);
                    const creator = profiles.find((p) => p.id === video.created_by);

                    return (
                      <TableRow key={video.id} className={isRowSelected ? "bg-secondary/20 text-xs" : "text-xs"}>
                        <TableCell>
                          <Checkbox
                            checked={isRowSelected}
                            onCheckedChange={(checked) => handleSelectRow(video.id, Boolean(checked))}
                          />
                        </TableCell>
                        <TableCell>
                          <VideoThumbnail
                            platform={video.platform as import("@/lib/video-platforms").Platform}
                            thumbnailUrl={video.thumbnail_url}
                            title={video.title}
                            className="size-10 rounded object-cover shadow-sm bg-muted"
                          />
                        </TableCell>
                        <TableCell className="max-w-50">
                          <p className="font-semibold text-foreground truncate" title={video.title ?? "Untitled"}>
                            {video.title ?? "Untitled Content"}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={video.url}>
                            {video.url}
                          </p>
                        </TableCell>
                        <TableCell className="capitalize">{PLATFORM_LABELS[video.platform]}</TableCell>
                        <TableCell>
                          {creator ? (
                            <Link
                              to="/admin/users/$id"
                              params={{ id: creator.id }}
                              className="font-medium hover:text-primary flex items-center gap-1 text-[11px]"
                            >
                              <Users className="size-3" />
                              {creator.username}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">Unknown</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-25 truncate">
                          {video.group?.team_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {video.last_view_count == null ? "—" : video.last_view_count.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-rose-500">
                          {video.last_like_count == null ? "—" : video.last_like_count.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              video.status === "valid"
                                ? "border-transparent bg-success/15 text-success text-[10px] font-semibold"
                                : video.status === "invalid"
                                ? "border-transparent bg-destructive/15 text-destructive text-[10px] font-semibold"
                                : "border-transparent bg-muted/30 text-muted-foreground text-[10px] font-semibold"
                            }
                          >
                            {video.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="size-8" title="Open Original Content" asChild>
                              <a href={video.url} target="_blank" rel="noreferrer">
                                <ExternalLink className="size-4" />
                              </a>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title="Copy content URL"
                              onClick={() => copyContentUrl(video.url)}
                            >
                              <Copy className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title="Edit link details"
                              onClick={() => openEditor(video)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title="Synchronize stats"
                              onClick={() => refreshLink.mutate(video.id)}
                            >
                              <RefreshCw className="size-4 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title="Duplicate content"
                              onClick={() => duplicateLink.mutate(video.id)}
                            >
                              <Copy className="size-4" />
                            </Button>
                            {video.deleted_at ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-primary"
                                title="Restore content"
                                onClick={() => restoreLink.mutate(video.id)}
                              >
                                <RotateCcw className="size-4" />
                              </Button>
                            ) : (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="size-8 text-destructive" title="Delete content link">
                                    <Trash2 className="size-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete this content link?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This removes the content link from the dashboard group statistics and metrics logs.
                                      This action is irreversible.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteLink.mutate(video.id)}>
                                      Delete Link
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination controls */}
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <span>
                Showing {(page - 1) * pageSize + 1} -{" "}
                {Math.min(page * pageSize, filteredVideos.length)} of {filteredVideos.length} videos
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit Content Dialog */}
      <Dialog
        open={Boolean(editingLink)}
        onOpenChange={(open) => !open && setEditingLink(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Content Link Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="video-title">Title / Name</Label>
                <Input
                  id="video-title"
                  value={editForm.title}
                  onChange={(e) => setEditForm((current) => ({ ...current, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="video-url">Video link URL</Label>
                <Input
                  id="video-url"
                  value={editForm.url}
                  onChange={(e) => setEditForm((current) => ({ ...current, url: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Platform</Label>
                <Select
                  value={editForm.platform}
                  onValueChange={(value) =>
                    setEditForm((current) => ({ ...current, platform: value as Platform }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {PLATFORM_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) =>
                    setEditForm((current) => ({ ...current, status: value as LinkStatus }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="valid">Valid</SelectItem>
                    <SelectItem value="invalid">Invalid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="video-thumbnail">Thumbnail URL</Label>
                <Input
                  id="video-thumbnail"
                  value={editForm.thumbnailUrl}
                  onChange={(e) => setEditForm((current) => ({ ...current, thumbnailUrl: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="video-notes">Admin Notes</Label>
                <Textarea
                  id="video-notes"
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) => setEditForm((current) => ({ ...current, notes: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="video-views">Views</Label>
                <Input
                  id="video-views"
                  type="number"
                  min={0}
                  value={editForm.views}
                  onChange={(e) => setEditForm((current) => ({ ...current, views: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="video-likes">Likes</Label>
                <Input
                  id="video-likes"
                  type="number"
                  min={0}
                  value={editForm.likes}
                  onChange={(e) => setEditForm((current) => ({ ...current, likes: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="video-comments">Comments</Label>
                <Input
                  id="video-comments"
                  type="number"
                  min={0}
                  value={editForm.comments}
                  onChange={(e) => setEditForm((current) => ({ ...current, comments: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="video-watch-time">Watch Time (seconds)</Label>
                <Input
                  id="video-watch-time"
                  type="number"
                  min={0}
                  value={editForm.watchTimeSeconds}
                  onChange={(e) => setEditForm((current) => ({ ...current, watchTimeSeconds: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="video-engagement-rate">Engagement Rate</Label>
                <Input
                  id="video-engagement-rate"
                  type="number"
                  min={0}
                  step="0.01"
                  value={editForm.engagementRate}
                  onChange={(e) => setEditForm((current) => ({ ...current, engagementRate: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="video-sync-status">Sync Status</Label>
                <Select
                  value={editForm.syncStatus}
                  onValueChange={(value) =>
                    setEditForm((current) => ({ ...current, syncStatus: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="idle">Idle</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="syncing">Syncing</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex items-center justify-between rounded-md border p-3 sm:col-span-2">
                <div>
                  <Label>Manual Override</Label>
                  <p className="text-[10px] text-muted-foreground">Mark this snapshot as admin-owned and keep the current values on the dashboard.</p>
                </div>
                <Switch
                  checked={editForm.manualOverride}
                  onCheckedChange={(checked) => setEditForm((current) => ({ ...current, manualOverride: Boolean(checked) }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLink(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => editingLink && updateLink.mutate({ id: editingLink.id, values: editForm })}
              disabled={updateLink.isPending}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
