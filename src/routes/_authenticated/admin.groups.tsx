import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, ExternalLink, Trash2, Ban, CheckCircle2, Pencil, Users, Instagram, Youtube, Facebook, Music2, Linkedin, Globe } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
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
import { groupSchema } from "@/lib/video-platforms";
import type { Group, VideoLink } from "@/hooks/use-data";

const SOCIALS = [
  { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/yourteam" },
  { key: "tiktok", label: "TikTok", icon: Music2, placeholder: "https://tiktok.com/@yourteam" },
  { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@yourteam" },
  { key: "facebook", label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/yourteam" },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "https://linkedin.com/company/yourteam" },
  { key: "website", label: "Website", icon: Globe, placeholder: "https://yourteam.com" },
] as const;

export const Route = createFileRoute("/_authenticated/admin/groups")({
  component: AdminGroupsPage,
});

function AdminGroupsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [viewingMembersGroup, setViewingMembersGroup] = useState<Group | null>(null);
  const [groupForm, setGroupForm] = useState({
    teamName: "",
    members: [""],
    socials: {} as Record<string, string>,
  });
  const pageSize = 10;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-groups", page, search],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let query = supabase
        .from("groups")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (search.trim()) {
        query = query.ilike("team_name", `%${search.trim()}%`);
      }

      const [{ data: groupsData, error, count }, { data: videosData }] = await Promise.all([
        query,
        supabase.from("video_links").select("id, group_id"),
      ]);
      if (error) throw error;

      return {
        groups: (groupsData ?? []) as Group[],
        videos: (videosData ?? []) as VideoLink[],
        totalCount: count ?? 0,
      };
    },
  });

  const groups = data?.groups ?? [];
  const videos = data?.videos ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.totalCount ?? 0) / pageSize));

  const openEditor = (group: Group) => {
    setEditingGroup(group);
    setGroupForm({
      teamName: group.team_name ?? "",
      members: group.member_names.length ? group.member_names : [""],
      socials: {
        instagram: group.instagram ?? "",
        tiktok: group.tiktok ?? "",
        youtube: group.youtube ?? "",
        facebook: group.facebook ?? "",
        linkedin: group.linkedin ?? "",
        website: group.website ?? "",
      },
    });
  };

  const toggleDisabled = useMutation({
    mutationFn: async ({ id, disabled }: { id: string; disabled: boolean }) => {
      const { error } = await supabase.from("groups").update({ disabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-groups"] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: typeof groupForm }) => {
      const parsed = groupSchema.safeParse({
        team_name: values.teamName,
        member_names: values.members.map((member) => member.trim()).filter(Boolean),
        instagram: values.socials.instagram ?? "",
        tiktok: values.socials.tiktok ?? "",
        youtube: values.socials.youtube ?? "",
        facebook: values.socials.facebook ?? "",
        linkedin: values.socials.linkedin ?? "",
        website: values.socials.website ?? "",
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);

      const payload = {
        team_name: parsed.data.team_name,
        member_names: parsed.data.member_names,
        instagram: parsed.data.instagram || null,
        tiktok: parsed.data.tiktok || null,
        youtube: parsed.data.youtube || null,
        facebook: parsed.data.facebook || null,
        linkedin: parsed.data.linkedin || null,
        website: parsed.data.website || null,
      };

      const { error } = await supabase.from("groups").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-groups"] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      qc.invalidateQueries({ queryKey: ["video-links-all"] });
      setEditingGroup(null);
      toast.success("Group updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-groups"] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      qc.invalidateQueries({ queryKey: ["video-links-all"] });
      toast.success("Group deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">All groups</h1>
        <p className="mt-1 text-muted-foreground">
          {data?.totalCount ?? 0} team{(data?.totalCount ?? 0) === 1 ? "" : "s"} registered.
        </p>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by team name..."
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
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
                  <TableHead>Team</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead className="text-center">Videos</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No groups found.
                    </TableCell>
                  </TableRow>
                ) : (
                  groups.map((g) => {
                    const count = videos.filter((v) => v.group_id === g.id).length;
                    return (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium">{g.team_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {g.member_names.length || 0}
                        </TableCell>
                        <TableCell className="text-center">{count}</TableCell>
                        <TableCell className="text-center">
                          {g.disabled ? (
                            <Badge className="border-transparent bg-destructive/15 text-destructive">
                              Disabled
                            </Badge>
                          ) : (
                            <Badge className="border-transparent bg-success/15 text-success">
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button asChild variant="ghost" size="icon" title="Open">
                              <Link to="/groups/$id" params={{ id: g.id }}>
                                <ExternalLink className="size-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="View members"
                              onClick={() => setViewingMembersGroup(g)}
                            >
                              <Users className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit"
                              onClick={() => openEditor(g)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={g.disabled ? "Enable" : "Disable"}
                              onClick={() =>
                                toggleDisabled.mutate({ id: g.id, disabled: !g.disabled })
                              }
                            >
                              {g.disabled ? (
                                <CheckCircle2 className="size-4" />
                              ) : (
                                <Ban className="size-4" />
                              )}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive" title="Delete">
                                  <Trash2 className="size-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete {g.team_name}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This permanently removes the group and all its video links.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteGroup.mutate(g.id)}>
                                    Delete
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

      <Dialog open={Boolean(viewingMembersGroup)} onOpenChange={(open) => !open && setViewingMembersGroup(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{viewingMembersGroup?.team_name ?? "Group members"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {viewingMembersGroup?.member_names?.length ? (
              viewingMembersGroup.member_names.map((member) => (
                <div key={member} className="rounded-lg border border-border px-3 py-2 text-sm">
                  {member}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No members listed for this group.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingMembersGroup(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingGroup)} onOpenChange={(open) => !open && setEditingGroup(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="group-team-name">Team name</Label>
              <Input
                id="group-team-name"
                value={groupForm.teamName}
                onChange={(e) => setGroupForm((current) => ({ ...current, teamName: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Members</Label>
              {groupForm.members.map((member, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={member}
                    onChange={(e) => {
                      const nextMembers = [...groupForm.members];
                      nextMembers[index] = e.target.value;
                      setGroupForm((current) => ({ ...current, members: nextMembers }));
                    }}
                    placeholder={`Member ${index + 1}`}
                  />
                  {groupForm.members.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const nextMembers = groupForm.members.filter((_, itemIndex) => itemIndex !== index);
                        setGroupForm((current) => ({ ...current, members: nextMembers }));
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setGroupForm((current) => ({ ...current, members: [...current.members, ""] }))}
              >
                Add member
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Social links</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {SOCIALS.map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-1">
                    <Label htmlFor={key} className="text-sm font-medium">
                      {label}
                    </Label>
                    <Input
                      id={key}
                      value={groupForm.socials[key] ?? ""}
                      placeholder={placeholder}
                      onChange={(e) =>
                        setGroupForm((current) => ({
                          ...current,
                          socials: { ...current.socials, [key]: e.target.value },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGroup(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                editingGroup &&
                updateGroup.mutate({
                  id: editingGroup.id,
                  values: groupForm,
                })
              }
              disabled={updateGroup.isPending}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
