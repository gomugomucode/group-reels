import type { Platform } from "./video-platforms";
import { isValidUrl } from "./video-platforms";
import { extractYouTubeVideoId } from "./youtube";

export interface ParsedUrl {
  platform: Platform;
  contentType: "video" | "reel" | "post" | "short" | "unknown";
  contentId: string | null;
  canonicalUrl: string | null;
  isValid: boolean;
  errors: string[];
}

export function parseUrl(url: string): ParsedUrl {
  const result: ParsedUrl = {
    platform: "other",
    contentType: "unknown",
    contentId: null,
    canonicalUrl: null,
    isValid: false,
    errors: [],
  };

  if (!isValidUrl(url)) {
    result.errors.push("Invalid URL format");
    return result;
  }

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    result.errors.push("URL could not be parsed");
    return result;
  }

  const hostname = parsed.hostname.replace(/^(www\.|m\.)/, "");
  const pathname = parsed.pathname;

  // YouTube
  if (hostname === "youtube.com" || hostname === "youtu.be") {
    result.platform = "youtube";
    const ytId = extractYouTubeVideoId(url);
    
    if (ytId) {
      result.contentId = ytId;
      result.isValid = true;
      if (pathname.startsWith("/shorts/")) {
        result.contentType = "short";
        result.canonicalUrl = `https://www.youtube.com/shorts/${ytId}`;
      } else {
        result.contentType = "video";
        result.canonicalUrl = `https://www.youtube.com/watch?v=${ytId}`;
      }
    } else {
      result.errors.push("Could not extract YouTube Video ID");
    }
    return result;
  }

  // Instagram
  if (hostname === "instagram.com") {
    result.platform = "instagram";
    const reelMatch = pathname.match(/\/reel\/([A-Za-z0-9_-]+)/);
    const postMatch = pathname.match(/\/p\/([A-Za-z0-9_-]+)/);

    if (reelMatch) {
      result.contentId = reelMatch[1];
      result.contentType = "reel";
      result.canonicalUrl = `https://www.instagram.com/reel/${result.contentId}/`;
      result.isValid = true;
    } else if (postMatch) {
      result.contentId = postMatch[1];
      result.contentType = "post";
      result.canonicalUrl = `https://www.instagram.com/p/${result.contentId}/`;
      result.isValid = true;
    } else {
      result.errors.push("Could not extract Instagram Content ID");
    }
    return result;
  }

  // TikTok
  if (hostname === "tiktok.com") {
    result.platform = "tiktok";
    const videoMatch = pathname.match(/\/video\/(\d+)/);

    if (videoMatch) {
      result.contentId = videoMatch[1];
      result.contentType = "video";
      // TikTok canonicals usually require the username, we might just keep the original path if username is there
      const userMatch = pathname.match(/(@[\w.-]+)/);
      const username = userMatch ? userMatch[1] : "@user";
      result.canonicalUrl = `https://www.tiktok.com/${username}/video/${result.contentId}`;
      result.isValid = true;
    } else {
      result.errors.push("Could not extract TikTok Video ID");
    }
    return result;
  }

  // Facebook
  if (hostname.includes("facebook.com") || hostname === "fb.watch" || hostname === "fb.com") {
    result.platform = "facebook";
    const watchMatch = pathname.match(/\/watch\/?\?v=(\d+)/) || parsed.searchParams.get("v");
    const videoMatch = pathname.match(/\/videos\/(\d+)/);
    const reelMatch = pathname.match(/\/reel\/(\d+)/);

    if (reelMatch) {
      result.contentId = reelMatch[1];
      result.contentType = "reel";
      result.canonicalUrl = `https://www.facebook.com/reel/${result.contentId}`;
      result.isValid = true;
    } else if (videoMatch) {
      result.contentId = videoMatch[1];
      result.contentType = "video";
      result.canonicalUrl = `https://www.facebook.com/videos/${result.contentId}`;
      result.isValid = true;
    } else if (watchMatch) {
      result.contentId = typeof watchMatch === "string" ? watchMatch : watchMatch[1];
      result.contentType = "video";
      result.canonicalUrl = `https://www.facebook.com/watch/?v=${result.contentId}`;
      result.isValid = true;
    } else {
      // fb.watch short links don't easily give ID without expanding
      result.isValid = true; // Best effort
      result.canonicalUrl = url;
    }
    return result;
  }

  // LinkedIn
  if (hostname === "linkedin.com") {
    result.platform = "other"; // LinkedIn is not explicitly in Platform enum except as "other" but we can map it if we want.
    const postMatch = pathname.match(/\/posts\/.*-([0-9]+)-/);
    const activityMatch = pathname.match(/\/feed\/update\/urn:li:activity:([0-9]+)/);
    
    if (postMatch) {
      result.contentId = postMatch[1];
      result.contentType = "post";
      result.isValid = true;
      result.canonicalUrl = url; // Hard to reconstruct without slug
    } else if (activityMatch) {
      result.contentId = activityMatch[1];
      result.contentType = "post";
      result.isValid = true;
      result.canonicalUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${result.contentId}`;
    } else {
      result.isValid = true;
      result.canonicalUrl = url;
    }
    return result;
  }

  // Vimeo
  if (hostname === "vimeo.com") {
    result.platform = "vimeo";
    const vimeoMatch = pathname.match(/^\/(\d+)$/);
    if (vimeoMatch) {
      result.contentId = vimeoMatch[1];
      result.contentType = "video";
      result.canonicalUrl = `https://vimeo.com/${result.contentId}`;
      result.isValid = true;
    } else {
      result.errors.push("Could not extract Vimeo Video ID");
    }
    return result;
  }

  // Fallback
  result.canonicalUrl = url;
  result.isValid = true;
  return result;
}
