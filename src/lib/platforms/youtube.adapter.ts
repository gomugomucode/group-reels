import { extractYouTubeVideoId, buildYouTubeApiUrl, mapYouTubeResponse } from '@/lib/youtube';
import { AnalyticsProvider, AnalyticsResult } from '@/lib/analytics/types';

export class YouTubeAdapter implements AnalyticsProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  validateUrl(url: string): boolean {
    return extractYouTubeVideoId(url) !== null;
  }

  extractId(url: string): string | null {
    return extractYouTubeVideoId(url);
  }

  async fetchAnalytics(url: string): Promise<AnalyticsResult> {
    if (!this.validateUrl(url)) {
      return this.makeErrorResult("invalid_url");
    }

    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      return this.makeErrorResult("invalid_url");
    }

    try {
      const apiUrl = buildYouTubeApiUrl(videoId, this.apiKey);
      const response = await fetch(apiUrl);
      if (!response.ok) {
        // Handle specific status codes
        if (response.status === 404) {
          return this.makeErrorResult("video_not_found");
        } else if (response.status === 403) {
          return this.makeErrorResult("requires_authorization");
        } else {
          return this.makeErrorResult("api_error");
        }
      }

      const data = await response.json();
      if (!data.items || data.items.length === 0) {
        return this.makeErrorResult("video_not_found");
      }

      const video = mapYouTubeResponse(data.items[0]);
      if (!video) {
        return this.makeErrorResult("api_error");
      }

      const now = new Date().toISOString();
      const engagementRate =
        video.viewCount > 0
          ? ((video.likeCount + video.commentCount) / video.viewCount) * 100
          : 0;

      const result: AnalyticsResult = {
        views: video.viewCount,
        likes: video.likeCount,
        comments: video.commentCount,
        shares: 0, // YouTube API does not provide shares in video statistics
        saves: 0, // YouTube API does not have saves/favorites in video statistics
        duration: video.durationSeconds,
        thumbnail: video.thumbnailUrl,
        title: video.title,
        publishedAt: video.publishedAt,
        creator: video.channelName,
        status: "success",
        syncedAt: now,
      };

      return result;
    } catch (err: any) {
      console.error('YouTube adapter error:', err);
      return this.makeErrorResult("unknown_error");
    }
  }

  private makeErrorResult(status: string): AnalyticsResult {
    const now = new Date().toISOString();
    return {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      duration: 0,
      thumbnail: null,
      title: null,
      publishedAt: null,
      creator: null,
      status: status,
      syncedAt: now,
    };
  }
}