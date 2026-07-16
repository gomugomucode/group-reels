import { Eye, Heart, MessageSquare } from "lucide-react";
import { formatCount } from "@/lib/youtube";
import { cn } from "@/lib/utils";

interface VideoStatsBadgeProps {
  views: number | null | undefined;
  likes?: number | null | undefined;
  comments?: number | null | undefined;
  syncStatus?: string;
  apiError?: string | null;
  className?: string;
  horizontal?: boolean;
}

export function VideoStatsBadge({
  views,
  likes,
  comments,
  syncStatus,
  apiError,
  className = "",
  horizontal = true,
}: VideoStatsBadgeProps) {
  if (syncStatus === "error" && apiError === "Platform analytics not supported without OAuth") {
    return <span className="text-xs text-muted-foreground italic">Statistics unavailable</span>;
  }

  if (views == null && likes == null && comments == null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div
      className={cn(
        "flex text-xs text-muted-foreground",
        horizontal ? "flex-row items-center gap-3" : "flex-col gap-1",
        className
      )}
    >
      {views != null && (
        <span className="flex items-center gap-1 font-medium text-foreground/95" title={`${views.toLocaleString()} views`}>
          <Eye className="size-3 text-muted-foreground" />
          <span>{formatCount(views)}</span>
        </span>
      )}
      {likes != null && (
        <span className="flex items-center gap-1" title={`${likes.toLocaleString()} likes`}>
          <Heart className="size-3 text-red-500/80" />
          <span>{formatCount(likes)}</span>
        </span>
      )}
      {comments != null && (
        <span className="flex items-center gap-1" title={`${comments.toLocaleString()} comments`}>
          <MessageSquare className="size-3 text-blue-500/80" />
          <span>{formatCount(comments)}</span>
        </span>
      )}
    </div>
  );
}
