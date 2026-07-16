import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PLATFORM_LABELS,
  type LinkStatus,
  type Platform,
} from "@/lib/video-platforms";

const PLATFORM_CLASSES: Record<Platform, string> = {
  youtube: "border-transparent bg-destructive/15 text-destructive",
  tiktok: "border-transparent bg-accent/15 text-accent",
  instagram: "border-transparent bg-chart-4/15 text-chart-4",
  facebook: "border-transparent bg-chart-2/15 text-chart-2",
  vimeo: "border-transparent bg-primary/15 text-primary",
  linkedin: "border-transparent bg-blue-600/15 text-blue-600",
  other: "border-transparent bg-muted text-muted-foreground",
};

export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <Badge className={cn("font-medium", PLATFORM_CLASSES[platform])}>
      {PLATFORM_LABELS[platform]}
    </Badge>
  );
}

const STATUS_CLASSES: Record<LinkStatus, string> = {
  valid: "border-transparent bg-success/15 text-success",
  invalid: "border-transparent bg-destructive/15 text-destructive",
  pending: "border-transparent bg-warning/15 text-warning",
};

export function StatusBadge({ status }: { status: LinkStatus }) {
  return (
    <Badge className={cn("font-medium capitalize", STATUS_CLASSES[status])}>
      {status}
    </Badge>
  );
}
