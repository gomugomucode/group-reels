import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, Trash2, KeyRound, ShieldCheck, ShieldOff, Pencil, Ban, CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { deleteUserAccount, sendPasswordReset, setUserAccountStatus, setUserRole, updateUserAccount } from "@/lib/admin.functions";
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
import type { ProfileRow } from "@/hooks/use-data";

type ProfileWithRoles = ProfileRow & { roles: string[] };

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingProfile, setEditingProfile] = useState<ProfileWithRoles | null>(null);
  const [editForm, setEditForm] = useState({ username: "", email: "", teamName: "" });
  const pageSize = 10;

  const deleteFn = useServerFn(deleteUserAccount);
  const resetFn = useServerFn(sendPasswordReset);
  const updateFn = useServerFn(updateUserAccount);
  const roleFn = useServerFn(setUserRole);
  const statusFn = useServerFn(setUserAccountStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", page, search],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let query = supabase
        .from("profiles")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (search.trim()) {
        const q = search.trim();
        query = query.or(`username.ilike.%${q}%,email.ilike.%${q}%,team_name.ilike.%${q}%`);
      }

      const [{ data: profilesData, error, count }, { data: rolesData, error: rolesError }] =
        await Promise.all([query, supabase.from("user_roles").select("user_id, role")]);
      if (error) throw error;
      if (rolesError) throw rolesError;

      const roleMap = new Map<string, string[]>();
      (rolesData ?? []).forEach((role) => {
        const list = roleMap.get(role.user_id) ?? [];
        list.push(role.role);
        roleMap.set(role.user_id, list);
      });

      return {
        profiles: (profilesData ?? []).map((profile) => ({
          ...(profile as ProfileRow),
          roles: roleMap.get(profile.id) ?? [],
        })) as ProfileWithRoles[],
        totalCount: count ?? 0,
      };
    },
  });

  const profiles = data?.profiles ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.totalCount ?? 0) / pageSize));

  const toggleAdmin = useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) => {
      await roleFn({ data: { userId, makeAdmin } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["profiles-all"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
      toast.success("Role updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleDisabled = useMutation({
    mutationFn: async ({ userId, disabled }: { userId: string; disabled: boolean }) => {
      await statusFn({ data: { userId, disabled } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["profiles-all"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
      toast.success("Account status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeUser = useMutation({
    mutationFn: async (userId: string) => {
      await deleteFn({ data: { userId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["profiles-all"] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Account deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetPassword = useMutation({
    mutationFn: async (email: string) => {
      await resetFn({ data: { email } });
    },
    onSuccess: () => toast.success("Password reset link generated"),
    onError: (e: Error) => toast.error(e.message),
  });

  const updateAccount = useMutation({
    mutationFn: async (values: { userId: string; username: string; email: string; teamName: string }) => {
      await updateFn({
        data: {
          userId: values.userId,
          username: values.username,
          email: values.email,
          teamName: values.teamName,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["profiles-all"] });
      setEditingProfile(null);
      toast.success("Account updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSearch = (value: string) => {
    setPage(1);
    setSearch(value);
  };

  const openEditor = (profile: ProfileWithRoles) => {
    setEditingProfile(profile);
    setEditForm({
      username: profile.username ?? "",
      email: profile.email ?? "",
      teamName: profile.team_name ?? "",
    });
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">User accounts</h1>
        <p className="mt-1 text-muted-foreground">
          {data?.totalCount ?? 0} account{(data?.totalCount ?? 0) === 1 ? "" : "s"} registered.
        </p>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, email, or team..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
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
                  <TableHead>User</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => {
                  const isAdminUser = p.roles.includes("admin");
                  const isSelf = p.id === user?.id;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.username}</div>
                        <div className="text-sm text-muted-foreground">{p.email}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.team_name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          {isAdminUser ? (
                            <Badge className="border-transparent bg-primary/15 text-primary">
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="secondary">User</Badge>
                          )}
                          {p.disabled ? (
                            <Badge className="border-transparent bg-destructive/15 text-destructive">
                              Disabled
                            </Badge>
                          ) : (
                            <Badge className="border-transparent bg-success/15 text-success">
                              Active
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit account"
                            onClick={() => openEditor(p)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Send password reset"
                            onClick={() => resetPassword.mutate(p.email)}
                          >
                            <KeyRound className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={isAdminUser ? "Revoke admin" : "Make admin"}
                            disabled={isSelf}
                            onClick={() =>
                              toggleAdmin.mutate({ userId: p.id, makeAdmin: !isAdminUser })
                            }
                          >
                            {isAdminUser ? (
                              <ShieldOff className="size-4" />
                            ) : (
                              <ShieldCheck className="size-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={p.disabled ? "Enable account" : "Disable account"}
                            disabled={isSelf}
                            onClick={() => toggleDisabled.mutate({ userId: p.id, disabled: !p.disabled })}
                          >
                            {p.disabled ? (
                              <CheckCircle2 className="size-4" />
                            ) : (
                              <Ban className="size-4" />
                            )}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                title="Delete account"
                                disabled={isSelf}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {p.username}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently deletes the account and all associated
                                  groups and video links. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeUser.mutate(p.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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

      <Dialog open={Boolean(editingProfile)} onOpenChange={(open) => !open && setEditingProfile(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={editForm.username}
                onChange={(e) => setEditForm((current) => ({ ...current, username: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((current) => ({ ...current, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-team">Team name</Label>
              <Input
                id="edit-team"
                value={editForm.teamName}
                onChange={(e) => setEditForm((current) => ({ ...current, teamName: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProfile(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                editingProfile &&
                updateAccount.mutate({
                  userId: editingProfile.id,
                  username: editForm.username,
                  email: editForm.email,
                  teamName: editForm.teamName,
                })
              }
              disabled={updateAccount.isPending}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
