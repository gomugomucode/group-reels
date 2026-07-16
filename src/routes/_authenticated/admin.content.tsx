import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { syncVideoAnalytics } from "@/lib/analytics.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [platformFilter, setPlatformFilter] = useState<"all" | Platform>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | LinkStatus>("all");
  const [viewsFilter, setViewsFilter] = useState("all");
  const [likesFilter, setLikesFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortField, setSortField] = useState("newest");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Selected videos for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Dialog state
  const [editingLink, setEditingLink] = useState<VideoLink | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    url: "",
    platform: "youtube" as Platform,
    status: "valid" as LinkStatus,
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("*, metrics:content_metrics(*), group:groups(team_name)")
        .eq("content_type", "video")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Array<ContentWithMetrics & { group?: { team_name: string | null } }>).map((row) => ({
        ...mapContentToVideoLink(row),
        group: row.group,
      }));
    },
  });

  // Filter & Search computation (Task 4 & 5 & 6)
  const filteredVideos = useMemo(() => {
    return videosData
      .filter((v) => {
        // Search
        if (search.trim()) {
          const keyword = search.toLowerCase();
          const creator = profiles.find((p) => p.id === v.created_by);
          const matches =
            (v.title ?? "").toLowerCase().includes(keyword) ||
            v.url.toLowerCase().includes(keyword) ||
            (creator?.username ?? "").toLowerCase().includes(keyword) ||
            (v.group?.team_name ?? "").toLowerCase().includes(keyword);
          if (!matches) return false;
        }

        // Platform
        if (platformFilter !== "all" && v.platform !== platformFilter) return false;

        // Status
        if (statusFilter !== "all" && v.status !== statusFilter) return false;

        // Views range
        if (viewsFilter !== "all") {
          const views = v.last_view_count ?? 0;
          if (viewsFilter === "0-100" && views > 100) return false;
          if (viewsFilter === "100-10k" && (views <= 100 || views > 10000)) return false;
          if (viewsFilter === "10k-100k" && (views <= 10000 || views > 100000)) return false;
          if (viewsFilter === "100k+" && views <= 100000) return false;
        }

        // Likes range
        if (likesFilter !== "all") {
          const likes = v.last_like_count ?? 0;
          if (likesFilter === "0-10" && likes > 10) return false;
          if (likesFilter === "10-1k" && (likes <= 10 || likes > 1000)) return false;
          if (likesFilter === "1k-10k" && (likes <= 1000 || likes > 10000)) return false;
          if (likesFilter === "10k+" && likes <= 10000) return false;
        }

        // Date range
        if (dateFilter !== "all") {
          const createdTime = new Date(v.created_at).getTime();
          const now = Date.now();
          const dayMs = 24 * 60 * 60 * 1000;

          if (dateFilter === "today" && now - createdTime > dayMs) return false;
          if (dateFilter === "this-week" && now - createdTime > 7 * dayMs) return false;
          if (dateFilter === "this-month" && now - createdTime > 30 * dayMs) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sorting (Task 6)
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
  }, [videosData, search, platformFilter, statusFilter, viewsFilter, likesFilter, dateFilter, sortField, profiles]);

  // Paginated chunk
  const paginatedVideos = useMemo(() => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    return filteredVideos.slice(from, to);
  }, [filteredVideos, page]);

  const totalPages = Math.max(1, Math.ceil(filteredVideos.length / pageSize));

  // Single Item Mutations
  const updateLink = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: typeof editForm }) => {
      const { error } = await supabase
        .from("content")
        .update({
          title: values.title || null,
          url: values.url,
          platform_id: values.platform,
          status: values.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-video-links-list"] });
      qc.invalidateQueries({ queryKey: ["video-links-all"] });
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
      setSelectedIds((prev) => prev.filter((item) => item !== editingLink?.id));
      toast.success("Content link deleted");
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
      setSelectedIds([]);
      toast.success("Bulk delete complete");
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

  const openEditor = (video: VideoLink) => {
    setEditingLink(video);
    setEditForm({
      title: video.title ?? "",
      url: video.url ?? "",
      platform: video.platform ?? "youtube",
      status: video.status ?? "valid",
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

      {/* Advanced Filters Block (Task 6) */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {/* Search */}
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-xs"
            placeholder="Search title, URL, group, creator..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>

        {/* Platform */}
        <div>
          <Select
            value={platformFilter}
            onValueChange={(v) => {
              setPage(1);
              setPlatformFilter(v as "all" | Platform);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <div className="flex items-center gap-1.5">
                <Filter className="size-3 text-muted-foreground" />
                <SelectValue placeholder="Platform" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Platform: All</SelectItem>
              {PLATFORMS.map((option) => (
                <SelectItem key={option} value={option}>
                  {PLATFORM_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setPage(1);
              setStatusFilter(v as "all" | LinkStatus);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <div className="flex items-center gap-1.5">
                <Filter className="size-3 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status: All</SelectItem>
              <SelectItem value="valid">Status: Valid</SelectItem>
              <SelectItem value="invalid">Status: Invalid</SelectItem>
              <SelectItem value="pending">Status: Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Views */}
        <div>
          <Select value={viewsFilter} onValueChange={(v) => { setPage(1); setViewsFilter(v); }}>
            <SelectTrigger className="h-9 text-xs">
              <div className="flex items-center gap-1.5">
                <Filter className="size-3 text-muted-foreground" />
                <SelectValue placeholder="Views range" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Views: All</SelectItem>
              <SelectItem value="0-100">Views: 0 - 100</SelectItem>
              <SelectItem value="100-10k">Views: 100 - 10k</SelectItem>
              <SelectItem value="10k-100k">Views: 10k - 100k</SelectItem>
              <SelectItem value="100k+">Views: 100k+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Likes */}
        <div>
          <Select value={likesFilter} onValueChange={(v) => { setPage(1); setLikesFilter(v); }}>
            <SelectTrigger className="h-9 text-xs">
              <div className="flex items-center gap-1.5">
                <Filter className="size-3 text-muted-foreground" />
                <SelectValue placeholder="Likes range" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Likes: All</SelectItem>
              <SelectItem value="0-10">Likes: 0 - 10</SelectItem>
              <SelectItem value="10-1k">Likes: 10 - 1k</SelectItem>
              <SelectItem value="1k-10k">Likes: 1k - 10k</SelectItem>
              <SelectItem value="10k+">Likes: 10k+</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Date Filter */}
        <div>
          <Select value={dateFilter} onValueChange={(v) => { setPage(1); setDateFilter(v); }}>
            <SelectTrigger className="h-9 text-xs">
              <div className="flex items-center gap-1.5">
                <Filter className="size-3 text-muted-foreground" />
                <SelectValue placeholder="Date Linked" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Date Added: All Time</SelectItem>
              <SelectItem value="today">Date Added: Last 24 Hours</SelectItem>
              <SelectItem value="this-week">Date Added: Last 7 Days</SelectItem>
              <SelectItem value="this-month">Date Added: Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sorting field */}
        <div>
          <Select value={sortField} onValueChange={(v) => setSortField(v)}>
            <SelectTrigger className="h-9 text-xs">
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="size-3 text-muted-foreground" />
                <SelectValue placeholder="Sort" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Sort: Newest</SelectItem>
              <SelectItem value="oldest">Sort: Oldest</SelectItem>
              <SelectItem value="views-desc">Sort: Most Views</SelectItem>
              <SelectItem value="likes-desc">Sort: Most Likes</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
                    <TableCell colSpan={10} className="py-12 text-center text-xs text-muted-foreground">
                      No matching video links found in content databases.
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
                        <TableCell className="max-w-[200px]">
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
                        <TableCell className="max-w-[100px] truncate">
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
                            <Button variant="ghost" size="icon" className="size-8" title="Open Video Link" asChild>
                              <a href={video.url} target="_blank" rel="noreferrer">
                                <ExternalLink className="size-4" />
                              </a>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Content Link Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="video-title">Title / Name</Label>
              <Input
                id="video-title"
                value={editForm.title}
                onChange={(e) => setEditForm((current) => ({ ...current, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="video-url">Video link URL</Label>
              <Input
                id="video-url"
                value={editForm.url}
                onChange={(e) => setEditForm((current) => ({ ...current, url: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
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
