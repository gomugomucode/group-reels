import { CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, EyeOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface SyncStatusBadgeProps {
  status: "idle" | "syncing" | "success" | "error" | "private" | "deleted";
  apiError?: string | null;
  lastSynced?: string | null;
  className?: string;
}

export function SyncStatusBadge({
  status,
  apiError,
  lastSynced,
  className = "",
}: SyncStatusBadgeProps) {
  const syncTime = lastSynced
    ? `Synced ${formatDistanceToNow(new Date(lastSynced), { addSuffix: true })}`
    : "Never synced";

  switch (status) {
    case "syncing":
      return (
        <Badge
          variant="secondary"
          className={cn("animate-pulse gap-1 border-transparent bg-secondary/80 text-foreground", className)}
        >
          <RefreshCw className="size-3 animate-spin text-primary" />
          <span>Syncing</span>
        </Badge>
      );
    case "success":
      return (
        <Badge
          variant="outline"
          className={cn("gap-1 border-success/30 bg-success/15 text-success", className)}
          title={syncTime}
        >
          <CheckCircle2 className="size-3" />
          <span>Success</span>
        </Badge>
      );
    case "private":
      return (
        <Badge
          variant="outline"
          className={cn("gap-1 border-warning/30 bg-warning/15 text-warning", className)}
          title="This video is set to private or unlisted on YouTube"
        >
          <EyeOff className="size-3" />
          <span>Private</span>
        </Badge>
      );
    case "deleted":
      return (
        <Badge
          variant="outline"
          className={cn("gap-1 border-destructive/30 bg-destructive/15 text-destructive", className)}
          title="This video has been deleted or is unavailable"
        >
          <Trash2 className="size-3" />
          <span>Deleted</span>
        </Badge>
      );
    case "error":
      const isUnsupported = apiError === "Platform analytics not supported without OAuth";
      return (
        <Badge
          variant="outline"
          className={cn(
            "gap-1 border-border",
            isUnsupported ? "bg-card text-muted-foreground" : "bg-destructive/15 text-destructive border-destructive/30",
            className
          )}
          title={isUnsupported ? "Analytics not supported for this platform" : (apiError || "Failed to sync")}
        >
          {isUnsupported ? <AlertCircle className="size-3" /> : <AlertTriangle className="size-3" />}
          <span>{isUnsupported ? "Statistics unavailable" : "Sync Failed"}</span>
        </Badge>
      );
    case "idle":
    default:
      return (
        <Badge
          variant="outline"
          className={cn("gap-1 border-border bg-card text-muted-foreground", className)}
        >
          <ClockIcon className="size-3" />
          <span>Pending</span>
        </Badge>
      );
  }
}

function ClockIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
