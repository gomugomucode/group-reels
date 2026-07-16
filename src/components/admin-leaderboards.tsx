import { useMemo } from "react";
import { Trophy, TrendingUp, Users, Video, Clock } from "lucide-react";
import { useAllProfiles, useAllVideoLinks, useAllGroups, type ProfileRow, type VideoLink, type Group } from "@/hooks/use-data";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCount } from "@/lib/youtube";

export function AdminLeaderboards() {
  const { data: profiles = [], isLoading: profilesLoading } = useAllProfiles(true);
  const { data: videos = [], isLoading: videosLoading } = useAllVideoLinks();
  const { data: groups = [], isLoading: groupsLoading } = useAllGroups();

  const isLoading = profilesLoading || videosLoading || groupsLoading;

  const leaderboards = useMemo(() => {
    if (isLoading) return null;

    // 1. Top Creators (by total views)
    const creatorViews: Record<string, { profile: ProfileRow; views: number }> = {};
    
    // 2. Top Content
    const sortedVideos = [...videos].sort((a, b) => (b.last_view_count || 0) - (a.last_view_count || 0));
    
    // 3. Most Active Users (by amount of content uploaded)
    const creatorUploads: Record<string, { profile: ProfileRow; uploads: number }> = {};

    profiles.forEach(p => {
      creatorViews[p.id] = { profile: p, views: 0 };
      creatorUploads[p.id] = { profile: p, uploads: 0 };
    });

    videos.forEach(v => {
      if (v.created_by && creatorViews[v.created_by]) {
        creatorViews[v.created_by].views += v.last_view_count || 0;
        creatorUploads[v.created_by].uploads += 1;
      }
    });

    const topCreators = Object.values(creatorViews)
      .sort((a, b) => b.views - a.views)
      .filter(c => c.views > 0)
      .slice(0, 5);

    const mostActiveUsers = Object.values(creatorUploads)
      .sort((a, b) => b.uploads - a.uploads)
      .filter(c => c.uploads > 0)
      .slice(0, 5);

    // 4. Newest Creators
    const newestCreators = [...profiles]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);

    return {
      topCreators,
      topContent: sortedVideos.slice(0, 5),
      mostActiveUsers,
      newestCreators
    };
  }, [profiles, videos, groups, isLoading]);

  if (isLoading || !leaderboards) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 rounded-2xl" />)}
      </div>
    );
  }

  const ListCard = ({ title, icon, items, renderItem }: any) => (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
        {icon} {title}
      </h3>
      <div className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No data available.</p>
        ) : (
          items.map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-3">
              <span className="font-bold text-muted-foreground w-4 text-center text-sm">{i + 1}</span>
              {renderItem(item)}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <ListCard 
        title="Top Creators" 
        icon={<Trophy className="size-5 text-amber-500" />}
        items={leaderboards.topCreators}
        renderItem={(item: any) => (
          <>
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">{item.profile.username.slice(0,2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{item.profile.username}</p>
              <p className="text-xs text-muted-foreground">{formatCount(item.views)} views</p>
            </div>
          </>
        )}
      />

      <ListCard 
        title="Top Content" 
        icon={<Video className="size-5 text-primary" />}
        items={leaderboards.topContent}
        renderItem={(v: VideoLink) => (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate" title={v.title || "Untitled"}>{v.title || "Untitled Video"}</p>
            <p className="text-xs text-muted-foreground">{formatCount(v.last_view_count || 0)} views</p>
          </div>
        )}
      />

      <ListCard 
        title="Most Active Users" 
        icon={<Users className="size-5 text-success" />}
        items={leaderboards.mostActiveUsers}
        renderItem={(item: any) => (
          <>
             <Avatar className="size-8">
              <AvatarFallback className="text-xs">{item.profile.username.slice(0,2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{item.profile.username}</p>
              <p className="text-xs text-muted-foreground">{item.uploads} items uploaded</p>
            </div>
          </>
        )}
      />

      <ListCard 
        title="Newest Creators" 
        icon={<Clock className="size-5 text-blue-500" />}
        items={leaderboards.newestCreators}
        renderItem={(p: ProfileRow) => (
          <>
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">{p.username.slice(0,2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{p.username}</p>
              <p className="text-xs text-muted-foreground">Joined {new Date(p.created_at).toLocaleDateString()}</p>
            </div>
          </>
        )}
      />
    </div>
  );
}
