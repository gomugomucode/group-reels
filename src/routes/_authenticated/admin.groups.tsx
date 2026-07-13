import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, ExternalLink, Trash2, Ban, CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { useAllGroups, useAllVideoLinks } from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/_authenticated/admin/groups")({
  component: AdminGroupsPage,
});

function AdminGroupsPage() {
  const qc = useQueryClient();
  const { data: groups = [], isLoading } = useAllGroups();
  const { data: videos = [] } = useAllVideoLinks();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return groups;
    const q = search.toLowerCase();
    return groups.filter(
      (g) =>
        g.team_name.toLowerCase().includes(q) ||
        g.member_names.some((m) => m.toLowerCase().includes(q)),
    );
  }, [groups, search]);

  const toggleDisabled = useMutation({
    mutationFn: async ({ id, disabled }: { id: string; disabled: boolean }) => {
      const { error } = await supabase.from("groups").update({ disabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
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
          {groups.length} team{groups.length === 1 ? "" : "s"} registered.
        </p>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by team or member name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No groups found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((g) => {
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
        )}
      </div>
    </AppLayout>
  );
}
