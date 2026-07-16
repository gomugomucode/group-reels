import { useMemo } from "react";
import { PlusCircle, RefreshCw, Trash2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { VideoLink } from "@/hooks/use-data";
import { PLATFORM_LABELS } from "@/lib/video-platforms";

interface ActivityFeedProps {
  videos: VideoLink[];
}

interface ActivityEvent {
  id: string;
  type: "added" | "synced" | "deleted";
  title: string;
  timestamp: string;
  platform?: string;
}

export function ActivityFeed({ videos }: ActivityFeedProps) {
  const events = useMemo(() => {
    const list: ActivityEvent[] = [];

    videos.forEach((v) => {
      // 1. Content added
      list.push({
        id: `${v.id}-added`,
        type: "added",
        title: v.title || "Untitled Content",
        timestamp: v.created_at,
        platform: v.platform,
      });

      // 2. Analytics synced
      if (v.last_synced) {
        list.push({
          id: `${v.id}-synced`,
          type: "synced",
          title: v.title || "Untitled Content",
          timestamp: v.last_synced,
          platform: v.platform,
        });
      }

      // 3. Content deleted
      if (v.deleted_at) {
        list.push({
          id: `${v.id}-deleted`,
          type: "deleted",
          title: v.title || "Untitled Content",
          timestamp: v.deleted_at,
          platform: v.platform,
        });
      }
    });

    // Sort descending by timestamp (newest first)
    return list.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [videos]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-6 rounded-xl border border-dashed border-border bg-card/30">
        <Clock className="size-5 text-muted-foreground mb-2" />
        <h4 className="text-sm font-medium text-foreground">No activity yet</h4>
        <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
          Logs will update automatically as workspace content is linked.
        </p>
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul role="list" className="-mb-8">
        {events.slice(0, 10).map((event, eventIdx) => {
          const isLast = eventIdx === events.slice(0, 10).length - 1;
          const platformLabel = event.platform
            ? PLATFORM_LABELS[event.platform as keyof typeof PLATFORM_LABELS] || event.platform
            : "";

          return (
            <li key={event.id}>
              <div className="relative pb-8">
                {/* Timeline connector line */}
                {!isLast && (
                  <span
                    className="absolute left-4.5 top-4.5 -ml-px h-full w-0.5 bg-border"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex space-x-3">
                  <div>
                    {event.type === "added" && (
                      <span className="flex size-9 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
                        <PlusCircle className="size-4.5" aria-hidden />
                      </span>
                    )}
                    {event.type === "synced" && (
                      <span className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                        <RefreshCw className="size-4.5" aria-hidden />
                      </span>
                    )}
                    {event.type === "deleted" && (
                      <span className="flex size-9 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                        <Trash2 className="size-4.5" aria-hidden />
                      </span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div>
                      <p className="text-sm text-foreground">
                        {event.type === "added" && (
                          <>
                            Added <span className="font-semibold">"{event.title}"</span>
                          </>
                        )}
                        {event.type === "synced" && (
                          <>
                            Analytics synced — <span className="font-semibold">{platformLabel}</span>
                            <span className="text-xs text-muted-foreground ml-1.5">("{event.title}")</span>
                          </>
                        )}
                        {event.type === "deleted" && (
                          <>
                            Deleted <span className="font-semibold">"{event.title}"</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="whitespace-nowrap text-right text-xs text-muted-foreground">
                      <time dateTime={event.timestamp}>
                        {formatDistanceToNow(new Date(event.timestamp), {
                          addSuffix: true,
                        })}
                      </time>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
