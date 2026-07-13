/**
 * youtube.ts
 * Pure YouTube utility functions — no I/O, no secrets, no Supabase.
 * Used by analytics.functions.ts (server-side) and client-side UI helpers.
 */

export interface YouTubeVideoStats {
  videoId: string;
  title: string;
  channelName: string;
  publishedAt: string; // ISO 8601
  thumbnailUrl: string;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

/**
 * Extract a YouTube video ID from any supported URL format:
 *  - https://www.youtube.com/watch?v=VIDEO_ID
 *  - https://youtu.be/VIDEO_ID
 *  - https://www.youtube.com/embed/VIDEO_ID
 *  - https://www.youtube.com/shorts/VIDEO_ID
 *  - https://m.youtube.com/watch?v=VIDEO_ID
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    const hostname = parsed.hostname.replace(/^(www\.|m\.)/, "");

    if (hostname === "youtu.be") {
      // https://youtu.be/VIDEO_ID[?...]
      const id = parsed.pathname.slice(1).split("/")[0];
      return isValidYouTubeId(id) ? id : null;
    }

    if (hostname === "youtube.com") {
      // /watch?v=VIDEO_ID
      const vParam = parsed.searchParams.get("v");
      if (vParam && isValidYouTubeId(vParam)) return vParam;

      // /embed/VIDEO_ID or /shorts/VIDEO_ID
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      if (
        pathParts.length >= 2 &&
        (pathParts[0] === "embed" || pathParts[0] === "shorts" || pathParts[0] === "v")
      ) {
        const id = pathParts[1];
        return isValidYouTubeId(id) ? id : null;
      }
    }
  } catch {
    // Invalid URL — fall through
  }
  return null;
}

/** YouTube video IDs are exactly 11 alphanumeric/-/_ characters */
export function isValidYouTubeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

/** Build the YouTube Data API v3 URL for video statistics */
export function buildYouTubeApiUrl(videoId: string, apiKey: string): string {
  const params = new URLSearchParams({
    part: "snippet,statistics,contentDetails",
    id: videoId,
    key: apiKey,
  });
  return `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
}

/**
 * Parse an ISO 8601 duration string (e.g., "PT1H2M3S") into total seconds.
 * Handles hours, minutes, and seconds.
 */
export function parseYouTubeDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] ?? "0", 10);
  const minutes = parseInt(match[2] ?? "0", 10);
  const seconds = parseInt(match[3] ?? "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/** Format seconds to HH:MM:SS or MM:SS display string */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Map a raw YouTube API v3 video resource to our typed struct.
 * Returns null if the API response is missing expected fields.
 */
export function mapYouTubeResponse(item: unknown): YouTubeVideoStats | null {
  if (!item || typeof item !== "object") return null;
  const v = item as Record<string, any>;
  const snippet = v.snippet ?? {};
  const stats = v.statistics ?? {};
  const contentDetails = v.contentDetails ?? {};

  const videoId = v.id as string;
  if (!videoId) return null;

  const thumbnail =
    snippet.thumbnails?.maxres?.url ??
    snippet.thumbnails?.high?.url ??
    snippet.thumbnails?.medium?.url ??
    snippet.thumbnails?.default?.url ??
    "";

  return {
    videoId,
    title: snippet.title ?? "",
    channelName: snippet.channelTitle ?? "",
    publishedAt: snippet.publishedAt ?? "",
    thumbnailUrl: thumbnail,
    durationSeconds: parseYouTubeDuration(contentDetails.duration ?? ""),
    viewCount: parseInt(stats.viewCount ?? "0", 10),
    likeCount: parseInt(stats.likeCount ?? "0", 10),
    commentCount: parseInt(stats.commentCount ?? "0", 10),
  };
}

/** Format large numbers with K/M suffixes for display */
export function formatCount(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Determine what sync_status should be set to from an HTTP error code */
export function httpStatusToSyncStatus(
  statusCode: number,
  reason?: string,
): string {
  if (statusCode === 404) return "deleted";
  if (statusCode === 403) return "private";
  return "error";
}
