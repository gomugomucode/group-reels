import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, Trash2, RefreshCw, ExternalLink, Pencil } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { syncVideoAnalytics } from "@/lib/analytics.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { VideoLink } from "@/hooks/use-data";

export const Route = createFileRoute("/_authenticated/admin/video-links")({
  component: AdminVideoLinksPage,
});

function AdminVideoLinksPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState<"all" | Platform>("all");
  const [status, setStatus] = useState<"all" | LinkStatus>("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editingLink, setEditingLink] = useState<VideoLink | null>(null);
  const [editForm, setEditForm] = useState({ title: "", url: "", platform: "youtube" as Platform, status: "valid" as LinkStatus });
  const pageSize = 10;

  const syncFn = useServerFn(syncVideoAnalytics);

  const { data: groupsData = [] } = useQuery({
    queryKey: ["admin-video-link-groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("groups").select("id, team_name").order("team_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; team_name: string | null }>;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-video-links", page, search, platform, status, groupFilter],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let query = supabase
        .from("video_links")
        .select("*, group:groups(team_name)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (search.trim()) {
        const term = search.trim();
        query = query.or(`title.ilike.%${term}%,url.ilike.%${term}%`);
      }
      if (platform !== "all") {
        query = query.eq("platform", platform);
      }
      if (status !== "all") {
        query = query.eq("status", status);
      }
      if (groupFilter !== "all") {
        query = query.eq("group_id", groupFilter);
      }

      const { data: videoData, error, count } = await query;
      if (error) throw error;

      return {
        videos: (videoData ?? []) as Array<VideoLink & { group?: { team_name: string | null } }>,
        totalCount: count ?? 0,
      };
    },
  });

  const videos = data?.videos ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.totalCount ?? 0) / pageSize));

  const openEditor = (video: VideoLink) => {
    setEditingLink(video);
    setEditForm({
      title: video.title ?? "",
      url: video.url ?? "",
      platform: video.platform ?? "youtube",
      status: video.status ?? "valid",
    });
  };

  const updateLink = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: typeof editForm }) => {
      const { error } = await supabase
        .from("video_links")
        .update({
          title: values.title || null,
          url: values.url,
          platform: values.platform,
          status: values.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-video-links"] });
      qc.invalidateQueries({ queryKey: ["video-links-all"] });
      setEditingLink(null);
      toast.success("Video link updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("video_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-video-links"] });
      qc.invalidateQueries({ queryKey: ["video-links-all"] });
      toast.success("Video link deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refreshLink = useMutation({
    mutationFn: async (videoLinkId: string) => {
      await syncFn({ data: { videoLinkId, force: true } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-video-links"] });
      qc.invalidateQueries({ queryKey: ["video-links-all"] });
      toast.success("Sync started");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = useMemo(() => ({
    total: data?.totalCount ?? 0,
    valid: videos.filter((video) => video.status === "valid").length,
    invalid: videos.filter((video) => video.status === "invalid").length,
    pending: videos.filter((video) => video.status === "pending").length,
  }), [data?.totalCount, videos]);

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Video links</h1>
          <p className="mt-1 text-muted-foreground">
            Review and manage every video link across all teams.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{stats.total} total</Badge>
          <Badge className="border-transparent bg-success/15 text-success">{stats.valid} valid</Badge>
          <Badge className="border-transparent bg-destructive/15 text-destructive">{stats.invalid} invalid</Badge>
          <Badge variant="secondary">{stats.pending} pending</Badge>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by title or URL..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={groupFilter} onValueChange={(value) => { setPage(1); setGroupFilter(value); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {groupsData.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.team_name ?? "Untitled group"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={platform} onValueChange={(value) => { setPage(1); setPlatform(value as "all" | Platform); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {PLATFORMS.map((option) => (
                <SelectItem key={option} value={option}>
                  {PLATFORM_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => { setPage(1); setStatus(value as "all" | LinkStatus); }}>
            <SelectTrigger className="w-[140px]">
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
      </div>

      <div className="rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {videos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No video links found.
                    </TableCell>
                  </TableRow>
                ) : (
                  videos.map((video) => (
                    <TableRow key={video.id}>
                      <TableCell>
                        <div className="font-medium">{video.title ?? "Untitled"}</div>
                        <div className="text-sm text-muted-foreground">{video.url}</div>
                      </TableCell>
                      <TableCell>{PLATFORM_LABELS[video.platform]}</TableCell>
                      <TableCell>
                        <Badge
                          className={video.status === "valid" ? "border-transparent bg-success/15 text-success" : video.status === "invalid" ? "border-transparent bg-destructive/15 text-destructive" : "border-transparent bg-muted/15 text-muted-foreground"}
                        >
                          {video.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{video.group?.team_name ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Open link" asChild>
                            <a href={video.url} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /></a>
                          </Button>
                          <Button variant="ghost" size="icon" title="Edit" onClick={() => openEditor(video)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Refresh" onClick={() => refreshLink.mutate(video.id)}>
                            <RefreshCw className="size-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive" title="Delete">
                                <Trash2 className="size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this video link?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently removes the link from the platform.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteLink.mutate(video.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={Boolean(editingLink)} onOpenChange={(open) => !open && setEditingLink(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit video link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="video-title">Title</Label>
              <Input id="video-title" value={editForm.title} onChange={(e) => setEditForm((current) => ({ ...current, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="video-url">URL</Label>
              <Input id="video-url" value={editForm.url} onChange={(e) => setEditForm((current) => ({ ...current, url: e.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={editForm.platform} onValueChange={(value) => setEditForm((current) => ({ ...current, platform: value as Platform }))}>
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
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(value) => setEditForm((current) => ({ ...current, status: value as LinkStatus }))}>
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
            <Button onClick={() => editingLink && updateLink.mutate({ id: editingLink.id, values: editForm })} disabled={updateLink.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
