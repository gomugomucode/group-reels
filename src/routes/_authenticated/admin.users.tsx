import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, Trash2, KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { useAllProfiles } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { deleteUserAccount, sendPasswordReset } from "@/lib/admin.functions";
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

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: profiles = [], isLoading } = useAllProfiles(true);
  const [search, setSearch] = useState("");

  const deleteFn = useServerFn(deleteUserAccount);
  const resetFn = useServerFn(sendPasswordReset);

  const filtered = useMemo(() => {
    if (!search) return profiles;
    const q = search.toLowerCase();
    return profiles.filter(
      (p) =>
        p.username.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.team_name ?? "").toLowerCase().includes(q),
    );
  }, [profiles, search]);

  const toggleAdmin = useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) => {
      if (makeAdmin) {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });
        if (error && error.code !== "23505") throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles-all"] });
      toast.success("Role updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeUser = useMutation({
    mutationFn: async (userId: string) => {
      await deleteFn({ data: { userId } });
    },
    onSuccess: () => {
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

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">User accounts</h1>
        <p className="mt-1 text-muted-foreground">
          {profiles.length} account{profiles.length === 1 ? "" : "s"} registered.
        </p>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, email, or team..."
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
                <TableHead>User</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
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
                      {isAdminUser ? (
                        <Badge className="border-transparent bg-primary/15 text-primary">
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary">User</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
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
        )}
      </div>
    </AppLayout>
  );
}
