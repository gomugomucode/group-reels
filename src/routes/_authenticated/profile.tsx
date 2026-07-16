import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useAllVideoLinks, useMyMemberships } from "@/hooks/use-data";
import { AppLayout } from "@/components/app-layout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatCard } from "@/components/stat-card";
import { Video, Heart, Eye, Users, Activity } from "lucide-react";
import { formatCount } from "@/lib/youtube";
import { PieChart, Pie, Cell, Tooltip as ChartTooltip, ResponsiveContainer } from "recharts";
import { PLATFORM_LABELS } from "@/lib/video-platforms";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

const COLORS = ['#ef4444', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#6366f1'];

function ProfilePage() {
  const { user, profile, isAdmin } = useAuth();
  const { data: videos = [] } = useAllVideoLinks();
  const { data: memberships = [] } = useMyMemberships(user?.id);

  const myVideos = useMemo(() => videos.filter(v => v.created_by === user?.id), [videos, user]);

  const stats = useMemo(() => {
    let views = 0;
    let likes = 0;
    const platformCounts: Record<string, number> = {};

    myVideos.forEach(v => {
      views += v.last_view_count || 0;
      likes += v.last_like_count || 0;
      platformCounts[v.platform] = (platformCounts[v.platform] || 0) + 1;
    });

    return { views, likes, platformCounts };
  }, [myVideos]);

  const platformData = useMemo(() => {
    return Object.entries(stats.platformCounts).map(([name, value]) => ({
      name: PLATFORM_LABELS[name as keyof typeof PLATFORM_LABELS] || name,
      value
    }));
  }, [stats.platformCounts]);

  const initials = (profile?.username ?? "?").slice(0, 2).toUpperCase();

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="mt-1 text-muted-foreground">Manage your personal details and view your platform-wide activity.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center text-center">
          <Avatar className="size-24 mb-4">
            <AvatarFallback className="bg-secondary text-2xl font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-bold">{profile?.username}</h2>
          <p className="text-muted-foreground">{profile?.email}</p>
          {isAdmin && (
             <span className="mt-2 inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Administrator
            </span>
          )}
          
          <div className="mt-6 w-full pt-6 border-t border-border flex justify-between text-sm">
            <span className="text-muted-foreground">Joined Date</span>
            <span className="font-medium">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "Unknown"}</span>
          </div>
        </div>

        {/* Global Statistics */}
        <div className="md:col-span-2 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="My Content" value={myVideos.length.toString()} icon={<Video className="size-4" />} accent />
            <StatCard label="Total Views" value={formatCount(stats.views)} icon={<Eye className="size-4" />} />
            <StatCard label="Total Likes" value={formatCount(stats.likes)} icon={<Heart className="size-4" />} />
            <StatCard label="Teams" value={memberships.length.toString()} icon={<Users className="size-4" />} />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-4">Content by Platform</h3>
              <div className="h-48">
                {platformData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={platformData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {platformData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip 
                        contentStyle={{
                            background: "var(--color-popover)",
                            border: "1px solid var(--color-border)",
                            borderRadius: 8,
                            color: "var(--color-popover-foreground)",
                          }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    No content uploaded yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Activity className="size-4 text-primary" /> Recent Activity
              </h3>
              <div className="space-y-4">
                {myVideos.slice(0, 4).map(v => (
                  <div key={v.id} className="flex items-start gap-3">
                    <div className="mt-1 size-2 rounded-full bg-primary shrink-0" />
                    <div>
                      <p className="text-sm font-medium line-clamp-1">Added {v.title || "video"}</p>
                      <p className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
                {myVideos.length === 0 && (
                   <p className="text-sm text-muted-foreground">No recent activity.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
