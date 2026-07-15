import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Search,
  Trash2,
  KeyRound,
  ShieldCheck,
  ShieldOff,
  Pencil,
  Ban,
  CheckCircle2,
  Users,
  Download,
  Filter,
  ArrowUpDown,
  User,
  Eye,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteUserAccount,
  sendPasswordReset,
  setUserAccountStatus,
  setUserRole,
  updateUserAccount,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import type { ProfileRow } from "@/hooks/use-data";
import { formatCount } from "@/lib/youtube";

type ProfileWithRolesAndStats = ProfileRow & {
  roles: string[];
  totalContent: number;
  totalViews: number;
};

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();

  // Search, Filters & Sorting state
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortField, setSortField] = useState("newest");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Selected users for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Editing profile dialog state
  const [editingProfile, setEditingProfile] = useState<ProfileWithRolesAndStats | null>(null);
  const [editForm, setEditForm] = useState({ username: "", email: "", teamName: "" });

  const deleteFn = useServerFn(deleteUserAccount);
  const resetFn = useServerFn(sendPasswordReset);
  const updateFn = useServerFn(updateUserAccount);
  const roleFn = useServerFn(setUserRole);
  const statusFn = useServerFn(setUserAccountStatus);

  // Fetch all profiles, roles, and video metrics for high-fidelity client aggregation (Task 2 & 12)
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const [{ data: profilesData, error: profilesError }, { data: rolesData, error: rolesError }, { data: videoData, error: videoError }] =
        await Promise.all([
          supabase.from("profiles").select("*").order("created_at", { ascending: false }),
          supabase.from("user_roles").select("user_id, role"),
          supabase.from("video_links").select("created_by, last_view_count"),
        ]);

      if (profilesError) throw profilesError;
      if (rolesError) throw rolesError;
      if (videoError) throw videoError;

      const roleMap = new Map<string, string[]>();
      (rolesData ?? []).forEach((role) => {
        const list = roleMap.get(role.user_id) ?? [];
        list.push(role.role);
        roleMap.set(role.user_id, list);
      });

      // Video uploads map
      const contentCountMap = new Map<string, number>();
      const viewCountMap = new Map<string, number>();

      (videoData ?? []).forEach((v) => {
        if (!v.created_by) return;
        contentCountMap.set(v.created_by, (contentCountMap.get(v.created_by) ?? 0) + 1);
        viewCountMap.set(v.created_by, (viewCountMap.get(v.created_by) ?? 0) + (v.last_view_count ?? 0));
      });

      return (profilesData ?? []).map((profile) => ({
        ...(profile as ProfileRow),
        roles: roleMap.get(profile.id) ?? [],
        totalContent: contentCountMap.get(profile.id) ?? 0,
        totalViews: viewCountMap.get(profile.id) ?? 0,
      })) as ProfileWithRolesAndStats[];
    },
  });

  const allProfiles = data ?? [];

  // Client-side filtering, sorting & search computations (Task 2 & 5 & 6)
  const filteredProfiles = useMemo(() => {
    return allProfiles
      .filter((p) => {
        // Search filter
        if (search.trim()) {
          const keyword = search.toLowerCase();
          const matches =
            p.username.toLowerCase().includes(keyword) ||
            p.email.toLowerCase().includes(keyword) ||
            (p.team_name ?? "").toLowerCase().includes(keyword);
          if (!matches) return false;
        }

        // Role filter
        if (roleFilter !== "all") {
          const isAdmin = p.roles.includes("admin");
          if (roleFilter === "admin" && !isAdmin) return false;
          if (roleFilter === "user" && isAdmin) return false;
        }

        // Status filter
        if (statusFilter !== "all") {
          if (statusFilter === "disabled" && !p.disabled) return false;
          if (statusFilter === "active" && p.disabled) return false;
        }

        // Date filter
        if (dateFilter !== "all") {
          const joinedDate = new Date(p.created_at).getTime();
          const now = Date.now();
          const dayMs = 24 * 60 * 60 * 1000;

          if (dateFilter === "today" && now - joinedDate > dayMs) return false;
          if (dateFilter === "this-week" && now - joinedDate > 7 * dayMs) return false;
          if (dateFilter === "this-month" && now - joinedDate > 30 * dayMs) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sort order
        if (sortField === "newest") {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortField === "oldest") {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sortField === "views-desc") {
          return b.totalViews - a.totalViews;
        }
        if (sortField === "content-desc") {
          return b.totalContent - a.totalContent;
        }
        return 0;
      });
  }, [allProfiles, search, roleFilter, statusFilter, dateFilter, sortField]);

  // Paginated chunk
  const paginatedProfiles = useMemo(() => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    return filteredProfiles.slice(from, to);
  }, [filteredProfiles, page]);

  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / pageSize));

  // Mutations
  const toggleAdmin = useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) => {
      await roleFn({ data: { userId, makeAdmin } });
    },
    // Optimistic Updates (Task 12)
    onMutate: async ({ userId, makeAdmin }) => {
      await qc.cancelQueries({ queryKey: ["admin-users-list"] });
      const previous = qc.getQueryData(["admin-users-list"]);
      qc.setQueryData(["admin-users-list"], (old: any) =>
        (old ?? []).map((p: any) =>
          p.id === userId
            ? { ...p, roles: makeAdmin ? ["admin"] : [] }
            : p
        )
      );
      return { previous };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users-list"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
      toast.success("User role updated successfully");
    },
    onError: (e: Error, _, context) => {
      if (context?.previous) {
        qc.setQueryData(["admin-users-list"], context.previous);
      }
      toast.error(e.message);
    },
  });

  const toggleDisabled = useMutation({
    mutationFn: async ({ userId, disabled }: { userId: string; disabled: boolean }) => {
      await statusFn({ data: { userId, disabled } });
    },
    onMutate: async ({ userId, disabled }) => {
      await qc.cancelQueries({ queryKey: ["admin-users-list"] });
      const previous = qc.getQueryData(["admin-users-list"]);
      qc.setQueryData(["admin-users-list"], (old: any) =>
        (old ?? []).map((p: any) =>
          p.id === userId ? { ...p, disabled } : p
        )
      );
      return { previous };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users-list"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
      toast.success("Account status modified");
    },
    onError: (e: Error, _, context) => {
      if (context?.previous) {
        qc.setQueryData(["admin-users-list"], context.previous);
      }
      toast.error(e.message);
    },
  });

  const removeUser = useMutation({
    mutationFn: async (userId: string) => {
      await deleteFn({ data: { userId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users-list"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
      setSelectedIds((prev) => prev.filter((id) => id !== editingProfile?.id));
      toast.success("Account permanently deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetPassword = useMutation({
    mutationFn: async (email: string) => {
      await resetFn({ data: { email } });
    },
    onSuccess: () => toast.success("Password recovery link sent successfully"),
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
      qc.invalidateQueries({ queryKey: ["admin-users-list"] });
      setEditingProfile(null);
      toast.success("Account details saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Bulk Mutations (Task 7)
  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        if (id === currentUser?.id) continue;
        await deleteFn({ data: { userId: id } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users-list"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
      setSelectedIds([]);
      toast.success("Bulk delete complete");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkStatus = useMutation({
    mutationFn: async ({ ids, disabled }: { ids: string[]; disabled: boolean }) => {
      for (const id of ids) {
        if (id === currentUser?.id) continue;
        await statusFn({ data: { userId: id, disabled } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users-list"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
      setSelectedIds([]);
      toast.success("Bulk status update complete");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const ids = paginatedProfiles.map((p) => p.id);
      setSelectedIds(ids);
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
        ? allProfiles.filter((p) => selectedIds.includes(p.id))
        : filteredProfiles;

    if (listToExport.length === 0) {
      toast.error("No user metadata available to export");
      return;
    }

    const headers = ["Username", "Email", "Roles", "Team Name", "Total Content", "Total Views", "Joined", "Status"];
    const rows = listToExport.map((p) => [
      p.username,
      p.email,
      p.roles.join(";"),
      p.team_name ?? "",
      p.totalContent,
      p.totalViews,
      p.created_at,
      p.disabled ? "Suspended" : "Active",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reelhub-users-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV file downloaded successfully!");
  };

  const handleSearchChange = (value: string) => {
    setPage(1);
    setSearch(value);
  };

  const openEditor = (profile: ProfileWithRolesAndStats) => {
    setEditingProfile(profile);
    setEditForm({
      username: profile.username ?? "",
      email: profile.email ?? "",
      teamName: profile.team_name ?? "",
    });
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="size-8 text-primary" />
            User Account Workspace
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor registration counts, adjust access roles, and perform bulk suspensions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card p-1.5 px-3 shadow-sm animate-in fade-in duration-200">
              <span className="text-xs font-semibold text-muted-foreground mr-1.5">
                {selectedIds.length} selected:
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs text-amber-500 hover:text-amber-600"
                onClick={() => bulkStatus.mutate({ ids: selectedIds, disabled: true })}
                disabled={bulkStatus.isPending}
              >
                <Ban className="size-3 mr-1" />
                Suspend
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs text-emerald-500 hover:text-emerald-600"
                onClick={() => bulkStatus.mutate({ ids: selectedIds, disabled: false })}
                disabled={bulkStatus.isPending}
              >
                <CheckCircle2 className="size-3 mr-1" />
                Activate
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={bulkDelete.isPending}
                  >
                    <Trash2 className="size-3 mr-1" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {selectedIds.length} User Accounts?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes their profiles, linked collaborations, and content
                      statistics. This action cannot be undone.
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

      {/* Advanced Filters Block (Task 6) */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-xs"
            placeholder="Search username, email, team..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        {/* Role Select */}
        <div>
          <Select value={roleFilter} onValueChange={(v) => { setPage(1); setRoleFilter(v); }}>
            <SelectTrigger className="h-9 text-xs">
              <div className="flex items-center gap-1.5">
                <Filter className="size-3 text-muted-foreground" />
                <SelectValue placeholder="Role: All" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Role: All</SelectItem>
              <SelectItem value="admin">Role: Admin</SelectItem>
              <SelectItem value="user">Role: Standard User</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status Select */}
        <div>
          <Select value={statusFilter} onValueChange={(v) => { setPage(1); setStatusFilter(v); }}>
            <SelectTrigger className="h-9 text-xs">
              <div className="flex items-center gap-1.5">
                <Filter className="size-3 text-muted-foreground" />
                <SelectValue placeholder="Status: All" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status: All</SelectItem>
              <SelectItem value="active">Status: Active</SelectItem>
              <SelectItem value="disabled">Status: Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Joined Select */}
        <div>
          <Select value={dateFilter} onValueChange={(v) => { setPage(1); setDateFilter(v); }}>
            <SelectTrigger className="h-9 text-xs">
              <div className="flex items-center gap-1.5">
                <Filter className="size-3 text-muted-foreground" />
                <SelectValue placeholder="Joined: All" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Joined: All Time</SelectItem>
              <SelectItem value="today">Joined: Today</SelectItem>
              <SelectItem value="this-week">Joined: This Week</SelectItem>
              <SelectItem value="this-month">Joined: This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sort Select */}
        <div>
          <Select value={sortField} onValueChange={(v) => { setPage(1); setSortField(v); }}>
            <SelectTrigger className="h-9 text-xs">
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="size-3 text-muted-foreground" />
                <SelectValue placeholder="Sort: Newest" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Sort: Newest</SelectItem>
              <SelectItem value="oldest">Sort: Oldest</SelectItem>
              <SelectItem value="views-desc">Sort: Highest Views</SelectItem>
              <SelectItem value="content-desc">Sort: Content Count</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="space-y-2.5 p-4">
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
                        paginatedProfiles.length > 0 &&
                        paginatedProfiles.every((p) => selectedIds.includes(p.id))
                      }
                      onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                    />
                  </TableHead>
                  <TableHead>User Profile</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Content</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProfiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center text-xs text-muted-foreground">
                      No matching user accounts found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedProfiles.map((p) => {
                    const isAdminUser = p.roles.includes("admin");
                    const isSelf = p.id === currentUser?.id;
                    const isRowSelected = selectedIds.includes(p.id);
                    const initials = p.username.slice(0, 2).toUpperCase();

                    return (
                      <TableRow key={p.id} className={isRowSelected ? "bg-secondary/20" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={isRowSelected}
                            onCheckedChange={(checked) => handleSelectRow(p.id, Boolean(checked))}
                            disabled={isSelf}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8">
                              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-xs text-foreground leading-none">
                                {p.username}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-1">{p.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                          {p.team_name ?? "—"}
                        </TableCell>
                        <TableCell>
                          {isAdminUser ? (
                            <Badge className="border-transparent bg-primary/15 text-primary text-[10px] font-semibold">
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              User
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          {p.totalContent}
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold">
                          {formatCount(p.totalViews)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell>
                          {p.disabled ? (
                            <Badge className="border-transparent bg-destructive/15 text-destructive text-[10px] font-semibold">
                              Suspended
                            </Badge>
                          ) : (
                            <Badge className="border-transparent bg-success/15 text-success text-[10px] font-semibold">
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button asChild variant="ghost" size="icon" className="size-8" title="View Profile">
                              <Link to="/admin/users/$id" params={{ id: p.id }}>
                                <User className="size-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title="Edit account"
                              onClick={() => openEditor(p)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title="Send reset password link"
                              onClick={() => resetPassword.mutate(p.email)}
                            >
                              <KeyRound className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title={isAdminUser ? "Demote from Admin" : "Promote to Admin"}
                              disabled={isSelf}
                              onClick={() =>
                                toggleAdmin.mutate({ userId: p.id, makeAdmin: !isAdminUser })
                              }
                            >
                              {isAdminUser ? (
                                <ShieldOff className="size-4 text-amber-500" />
                              ) : (
                                <ShieldCheck className="size-4 text-emerald-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title={p.disabled ? "Unsuspend account" : "Suspend account"}
                              disabled={isSelf}
                              onClick={() =>
                                toggleDisabled.mutate({ userId: p.id, disabled: !p.disabled })
                              }
                            >
                              {p.disabled ? (
                                <CheckCircle2 className="size-4 text-emerald-500" />
                              ) : (
                                <Ban className="size-4 text-destructive" />
                              )}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-destructive"
                                  title="Delete account"
                                  disabled={isSelf}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete User "{p.username}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This permanently deletes the profile, their groups, and all
                                    statistics metadata. This action is irreversible.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => removeUser.mutate(p.id)}>
                                    Delete Account
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

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <span>
              {filteredProfiles.length === 0
                ? "No users match the current filters"
                : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredProfiles.length)} of ${filteredProfiles.length} users`}
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

      {/* Edit Profile Modal Dialog */}
      <Dialog
        open={Boolean(editingProfile)}
        onOpenChange={(open) => !open && setEditingProfile(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Profile Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={editForm.username}
                onChange={(e) =>
                  setEditForm((current) => ({ ...current, username: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email Address</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm((current) => ({ ...current, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-team">Team Group Name</Label>
              <Input
                id="edit-team"
                value={editForm.teamName}
                onChange={(e) =>
                  setEditForm((current) => ({ ...current, teamName: e.target.value }))
                }
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
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
