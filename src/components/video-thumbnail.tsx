import { Youtube, Music2, Instagram, Facebook, Video, Globe, Linkedin } from "lucide-react";
import type { Platform } from "@/lib/video-platforms";

interface VideoThumbnailProps {
  thumbnailUrl: string | null | undefined;
  platform: Platform;
  title?: string | null | undefined;
  className?: string;
}

const PLATFORM_ICONS = {
  youtube: Youtube,
  tiktok: Music2,
  instagram: Instagram,
  facebook: Facebook,
  vimeo: Video,
  linkedin: Linkedin,
  other: Globe,
} satisfies Record<Platform, typeof Globe>;

const PLATFORM_COLORS = {
  youtube: "text-red-500 bg-red-500/10",
  tiktok: "text-zinc-200 bg-zinc-800/80",
  instagram: "text-pink-500 bg-pink-500/10",
  facebook: "text-blue-600 bg-blue-500/10",
  vimeo: "text-sky-400 bg-sky-500/10",
  linkedin: "text-cyan-500 bg-cyan-500/10",
  other: "text-zinc-400 bg-zinc-500/10",
} satisfies Record<Platform, string>;

export function VideoThumbnail({
  thumbnailUrl,
  platform,
  title,
  className = "",
}: VideoThumbnailProps) {
  const Icon = PLATFORM_ICONS[platform] || Globe;
  const colorClass = PLATFORM_COLORS[platform] || "text-zinc-400 bg-zinc-500/10";

  return (
    <div className={`relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/30 ${className}`}>
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={title || "Video thumbnail"}
          className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-secondary/30">
          <Icon className="size-6 text-muted-foreground/60" />
        </div>
      )}
      <div className={`absolute bottom-1 right-1 rounded p-1 ${colorClass}`}>
        <Icon className="size-3" />
      </div>
    </div>
  );
}
