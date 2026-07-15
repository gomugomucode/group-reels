import { useMemo, useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  User,
  ShieldCheck,
  ShieldOff,
  Ban,
  CheckCircle2,
  Video,
  Eye,
  ThumbsUp,
  MessageSquare,
  Sparkles,
  Calendar,
  Layers,
  Heart,
  Save,
  Trash2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { AppLayout } from "@/components/app-layout";
import { StatCard } from "@/components/stat-card";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  PLATFORMS,
  PLATFORM_LABELS,
  type Platform,
} from "@/lib/video-platforms";
import { formatCount } from "@/lib/youtube";
import {
  setUserRole,
  setUserAccountStatus,
  deleteUserAccount,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/users/$id")({
  component: UserDetailPage,
});

const CHART_COLORS = [
  "var(--color-chart-1, #3b82f6)",
  "var(--color-chart-2, #10b981)",
  "var(--color-chart-3, #f59e0b)",
  "var(--color-chart-4, #ef4444)",
  "var(--color-chart-5, #8b5cf6)",
];

function UserDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const roleFn = useServerFn(setUserRole);
  const statusFn = useServerFn(setUserAccountStatus);
  const deleteFn = useServerFn(deleteUserAccount);

  // Admin notes state
  const [adminNotes, setAdminNotes] = useState("");

  // Load admin notes from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`admin_notes_${id}`);
    if (saved) {
      setAdminNotes(saved);
    }
  }, [id]);

  // Query: User profile + roles (Task 3)
  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ["admin-user-detail", id],
    queryFn: async () => {
      const [{ data: userProfile, error }, { data: roles, error: rolesError }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", id),
      ]);

      if (error) throw error;
      if (rolesError) throw rolesError;
      if (!userProfile) throw new Error("User account was not found");

      return {
        ...userProfile,
        roles: (roles ?? []).map((r) => r.role),
      };
    },
  });

  // Query: User linked content (Task 3)
  const { data: userVideos = [], isLoading: videosLoading } = useQuery({
    queryKey: ["admin-user-videos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_links")
        .select("*, group:groups(team_name)")
        .eq("created_by", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  // Calculations for stats (Task 3)
  const stats = useMemo(() => {
    let views = 0;
    let likes = 0;
    let comments = 0;

    userVideos.forEach((v) => {
      views += v.last_view_count ?? 0;
      likes += v.last_like_count ?? 0;
      comments += v.last_comment_count ?? 0;
    });

    const total = userVideos.length;
    const averageViews = total > 0 ? Math.round(views / total) : 0;
    const averageLikes = total > 0 ? Math.round(likes / total) : 0;
    const engagement = views > 0 ? ((likes + comments) / views) * 100 : 0;

    return {
      total,
      views,
      likes,
      comments,
      averageViews,
      averageLikes,
      engagement,
    };
  }, [userVideos]);

  // Platform distribution weights (Task 3)
  const platformData = useMemo(() => {
    return PLATFORMS.map((p) => {
      const pVideos = userVideos.filter((v) => v.platform === p);
      const views = pVideos.reduce((sum, v) => sum + (v.last_view_count ?? 0), 0);
      return {
        platform: PLATFORM_LABELS[p],
        count: pVideos.length,
        views,
      };
    }).filter((d) => d.count > 0);
  }, [userVideos]);

  // Activity events timeline for this user (Task 3)
  const timelineEvents = useMemo(() => {
    const events = [];

    // Joined date
    if (profile?.created_at) {
      events.push({
        id: "joined",
        title: "Joined Workspace",
        description: "Registered creator account on ReelHub.",
        date: new Date(profile.created_at),
        color: "bg-blue-500",
      });
    }

    // Video linked events
    userVideos.forEach((v) => {
      events.push({
        id: `video-${v.id}`,
        title: "Content Uploaded",
        description: `Linked new ${PLATFORM_LABELS[v.platform]} video "${v.title || "Untitled"}" to team group.`,
        date: new Date(v.created_at),
        color: "bg-emerald-500",
      });
    });

    return events.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [profile, userVideos]);

  // Mutations
  const toggleAdmin = useMutation({
    mutationFn: async (makeAdmin: boolean) => {
      await roleFn({ data: { userId: id, makeAdmin } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user-detail", id] });
      qc.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success("User role modified successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async (disabled: boolean) => {
      await statusFn({ data: { userId: id, disabled } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user-detail", id] });
      qc.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success("Account status modified successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeUser = useMutation({
    mutationFn: async () => {
      await deleteFn({ data: { userId: id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success("User permanently deleted");
      navigate({ to: "/admin/users" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSaveNotes = () => {
    localStorage.setItem(`admin_notes_${id}`, adminNotes);
    toast.success("Admin notes saved successfully");
  };

  const deleteLink = useMutation({
    mutationFn: async (videoId: string) => {
      const { error } = await supabase.from("video_links").delete().eq("id", videoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user-videos", id] });
      toast.success("Video link deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loading = profileLoading || videosLoading;

  if (profileLoading) {
    return (
      <AppLayout>
        <div className="space-y-6 animate-pulse">
          <Skeleton className="h-10 w-40" />
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-96 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl lg:col-span-2" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (profileError || !profile) {
    return (
      <AppLayout>
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center text-sm">
          <p className="font-semibold text-destructive">Error Loading Profile</p>
          <p className="text-muted-foreground mt-1">
            {profileError ? (profileError as Error).message : "The requested user detail does not exist."}
          </p>
          <Button className="mt-4" asChild>
            <Link to="/admin/users">Back to User Accounts</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const initials = profile.username.slice(0, 2).toUpperCase();
  const isAdmin = profile.roles.includes("admin");

  return (
    <AppLayout>
      {/* Back button */}
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
          <Link to="/admin/users">
            <ArrowLeft className="size-4" />
            Back to Users
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Account Details, Actions, Notes */}
        <div className="space-y-6">
          {/* Account Details Card */}
          <Card className="shadow-sm">
            <CardContent className="pt-6 text-center">
              <Avatar className="size-20 mx-auto mb-4 border-2 border-primary/20">
                <AvatarFallback className="bg-primary/5 text-primary text-xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-lg font-bold text-foreground">{profile.username}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{profile.email}</p>

              {/* Status Badges */}
              <div className="mt-3 flex justify-center gap-1.5 flex-wrap">
                {isAdmin ? (
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]" variant="outline">
                    Admin
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    Creator
                  </Badge>
                )}
                {profile.disabled ? (
                  <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]" variant="outline">
                    Suspended
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]" variant="outline">
                    Active
                  </Badge>
                )}
              </div>

              {/* Basic metadata */}
              <div className="mt-6 border-t border-border pt-4 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Team Group:</span>
                  <span className="font-semibold text-foreground">{profile.team_name || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Joined:</span>
                  <span className="font-semibold text-foreground">
                    {new Date(profile.created_at).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Moderation Actions */}
          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold">Account Access Control</CardTitle>
              <CardDescription className="text-[10px]">Adjust moderation privileges and statuses.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2">
              <div className="flex flex-col gap-2">
                {isAdmin ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1.5 justify-start text-amber-500 hover:text-amber-600"
                    onClick={() => toggleAdmin.mutate(false)}
                    disabled={toggleAdmin.isPending}
                  >
                    <ShieldOff className="size-4" />
                    Demote to Regular User
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1.5 justify-start text-emerald-500 hover:text-emerald-600"
                    onClick={() => toggleAdmin.mutate(true)}
                    disabled={toggleAdmin.isPending}
                  >
                    <ShieldCheck className="size-4" />
                    Promote to Admin
                  </Button>
                )}

                {profile.disabled ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1.5 justify-start text-emerald-500 hover:text-emerald-600"
                    onClick={() => toggleStatus.mutate(false)}
                    disabled={toggleStatus.isPending}
                  >
                    <CheckCircle2 className="size-4" />
                    Activate User Account
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1.5 justify-start text-destructive hover:bg-destructive/5"
                    onClick={() => toggleStatus.mutate(true)}
                    disabled={toggleStatus.isPending}
                  >
                    <Ban className="size-4" />
                    Suspend User Account
                  </Button>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="w-full text-xs gap-1.5 justify-start">
                      <Trash2 className="size-4" />
                      Permanently Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Account for {profile.username}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently removes their profiles records, collaboration groups, and linked contents.
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => removeUser.mutate()}
                      >
                        Confirm Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          {/* Admin Notes Card (Task 3) */}
          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <PlusCircleIcon className="size-4 text-primary" />
                Admin Moderation Notes
              </CardTitle>
              <CardDescription className="text-[10px]">
                Add notes about this creator. Saved locally.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Type profile checks, activity notes, warnings..."
                rows={4}
                className="text-xs"
              />
              <Button size="sm" onClick={handleSaveNotes} className="w-full gap-1.5 text-xs">
                <Save className="size-3.5" />
                Save Notes
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Statistics, Platform Breakdown, Recent Content, Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Statistics Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Videos Linked"
              value={stats.total}
              icon={<Video className="size-4" />}
            />
            <StatCard
              label="Total Views"
              value={formatCount(stats.views)}
              icon={<Eye className="size-4" />}
              accent
            />
            <StatCard
              label="Total Likes"
              value={formatCount(stats.likes)}
              icon={<ThumbsUp className="size-4" />}
            />
            <StatCard
              label="Engagement"
              value={`${stats.engagement.toFixed(1)}%`}
              icon={<Heart className="size-4" />}
              accent
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-4 flex items-center justify-between text-xs border border-border bg-card">
              <div>
                <p className="text-muted-foreground">Average Views/Video</p>
                <p className="text-lg font-bold text-foreground mt-0.5">{stats.averageViews.toLocaleString()}</p>
              </div>
              <Badge variant="secondary">Views</Badge>
            </Card>
            <Card className="p-4 flex items-center justify-between text-xs border border-border bg-card">
              <div>
                <p className="text-muted-foreground">Average Likes/Video</p>
                <p className="text-lg font-bold text-foreground mt-0.5">{stats.averageLikes.toLocaleString()}</p>
              </div>
              <Badge variant="secondary">Likes</Badge>
            </Card>
          </div>

          {/* Platform distribution preview */}
          {platformData.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Layers className="size-4 text-primary" />
                  Social Platform Distribution
                </CardTitle>
                <CardDescription className="text-[10px]">
                  Views weights and upload distribution per social app.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-60 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={platformData}
                      dataKey="views"
                      nameKey="platform"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      innerRadius={45}
                      paddingAngle={3}
                    >
                      {platformData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        fontSize: "11px",
                      }}
                      formatter={(v: any) => [`${formatCount(v)} views`]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Recent Content uploaded */}
          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Video className="size-4 text-primary" />
                Recent Platform Content ({userVideos.length})
              </CardTitle>
              <CardDescription className="text-[10px]">
                List of video links added to the database by this user.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title / URL</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Likes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userVideos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                        This creator has not linked any videos.
                      </TableCell>
                    </TableRow>
                  ) : (
                    userVideos.map((v) => (
                      <TableRow key={v.id} className="text-xs">
                        <TableCell className="max-w-[180px] truncate">
                          <p className="font-semibold">{v.title || "Untitled"}</p>
                          <a
                            href={v.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-muted-foreground hover:text-primary block mt-0.5 truncate"
                          >
                            {v.url}
                          </a>
                        </TableCell>
                        <TableCell className="capitalize">{v.platform}</TableCell>
                        <TableCell className="text-right font-medium">
                          {v.last_view_count?.toLocaleString() || "—"}
                        </TableCell>
                        <TableCell className="text-right text-rose-500">
                          {v.last_like_count?.toLocaleString() || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              v.status === "valid"
                                ? "bg-success/15 text-success border-transparent text-[9px]"
                                : v.status === "invalid"
                                ? "bg-destructive/15 text-destructive border-transparent text-[9px]"
                                : "bg-muted text-muted-foreground border-transparent text-[9px]"
                            }
                          >
                            {v.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button asChild variant="ghost" size="icon" className="size-7" title="Open Video Link">
                              <a href={v.url} target="_blank" rel="noreferrer">
                                <ExternalLink className="size-3.5" />
                              </a>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-7 text-destructive" title="Delete content link">
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete this content link?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This removes the content link from the team page. Statistics logs will be deleted.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteLink.mutate(v.id)}>
                                    Delete Link
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
            </CardContent>
          </Card>

          {/* Activity Timeline (Task 3) */}
          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Calendar className="size-4 text-primary" />
                User Workspace Timeline
              </CardTitle>
              <CardDescription className="text-[10px]">Timeline records of profile additions and video linkages.</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              {timelineEvents.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-4">No logged events.</p>
              ) : (
                <div className="relative border-l border-border pl-4 space-y-4 text-xs">
                  {timelineEvents.map((event, index) => (
                    <div key={`${event.id}-${index}`} className="relative">
                      <span className={`absolute -left-[21px] top-1 flex size-2 rounded-full ${event.color}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{event.title}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {event.date.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-0.5 leading-normal">{event.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

// Icon fallbacks
function PlusCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  );
}
