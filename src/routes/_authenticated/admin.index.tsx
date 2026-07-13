import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
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
import {
  Users,
  FolderKanban,
  Video,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { StatCard } from "@/components/stat-card";
import {
  useAllGroups,
  useAllVideoLinks,
  useAllProfiles,
} from "@/hooks/use-data";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  type Platform,
} from "@/lib/video-platforms";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-muted-foreground)",
];

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-4 font-semibold">{title}</h3>
      <div className="h-64">{children}</div>
    </div>
  );
}

function AdminDashboard() {
  const { data: groups = [], isLoading: gLoading } = useAllGroups();
  const { data: videos = [], isLoading: vLoading } = useAllVideoLinks();
  const { data: profiles = [], isLoading: pLoading } = useAllProfiles(true);

  const platformData = useMemo(() => {
    return PLATFORMS.map((p) => ({
      platform: PLATFORM_LABELS[p],
      key: p as Platform,
      count: videos.filter((v) => v.platform === p).length,
    })).filter((d) => d.count > 0);
  }, [videos]);

  const groupData = useMemo(() => {
    return groups
      .map((g) => ({
        name: g.team_name.length > 14 ? g.team_name.slice(0, 13) + "…" : g.team_name,
        videos: videos.filter((v) => v.group_id === g.id).length,
      }))
      .sort((a, b) => b.videos - a.videos)
      .slice(0, 8);
  }, [groups, videos]);

  const invalidCount = videos.filter((v) => v.status === "invalid").length;
  const topPlatform =
    [...platformData].sort((a, b) => b.count - a.count)[0]?.platform ?? "—";

  const loading = gLoading || vLoading || pLoading;

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Admin dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Overview of all teams, video links, and platform activity.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Users" value={profiles.length} icon={<Users className="size-4" />} accent />
            <StatCard label="Groups" value={groups.length} icon={<FolderKanban className="size-4" />} />
            <StatCard label="Video links" value={videos.length} icon={<Video className="size-4" />} />
            <StatCard label="Invalid links" value={invalidCount} icon={<AlertTriangle className="size-4" />} />
            <StatCard label="Top platform" value={topPlatform} icon={<TrendingUp className="size-4" />} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <ChartCard title="Platform distribution">
              {platformData.length === 0 ? (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  No video links yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={platformData}
                      dataKey="count"
                      nameKey="platform"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={50}
                      paddingAngle={2}
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
                        color: "var(--color-popover-foreground)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Videos by platform">
              {platformData.length === 0 ? (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  No video links yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={platformData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="platform" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={12} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: "var(--color-secondary)" }}
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        color: "var(--color-popover-foreground)",
                      }}
                    />
                    <Bar dataKey="count" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <div className="mt-6">
            <ChartCard title="Video links per group (top 8)">
              {groupData.length === 0 ? (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  No groups yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} width={90} />
                    <Tooltip
                      cursor={{ fill: "var(--color-secondary)" }}
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        color: "var(--color-popover-foreground)",
                      }}
                    />
                    <Bar dataKey="videos" fill="var(--color-accent)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Manage</h2>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Link
              to="/admin/groups"
              className="group flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary"
            >
              <div>
                <p className="font-semibold">All groups</p>
                <p className="text-sm text-muted-foreground">
                  Search, edit, disable, or delete any team group.
                </p>
              </div>
              <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
            <Link
              to="/admin/users"
              className="group flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary"
            >
              <div>
                <p className="font-semibold">User accounts</p>
                <p className="text-sm text-muted-foreground">
                  Manage roles and remove accounts.
                </p>
              </div>
              <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
          </div>
        </>
      )}
    </AppLayout>
  );
}
