import { extractYouTubeVideoId } from '@/lib/youtube';
import { buildYouTubeApiUrl, mapYouTubeResponse } from '@/lib/youtube';
import { AnalyticsProvider, AnalyticsResult } from '@/lib/analytics/types';

export class YouTubeProvider implements AnalyticsProvider {
  private apiKey: string;
  private cache: Map<string, { result: AnalyticsResult; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
    const videoId = this.extractId(url);
    if (!videoId) {
      throw new Error('Unable to extract YouTube video ID from URL');
    }

    // Check cache
    const cached = this.cache.get(videoId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.result;
    }

    const apiUrl = buildYouTubeApiUrl(videoId, this.apiKey);
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found or unavailable');
    }

    const video = mapYouTubeResponse(data.items[0]);
    if (!video) {
      throw new Error('Failed to parse YouTube response');
    }

    // Calculate engagement rate: (likes + comments) / views * 100, avoid division by zero
    const engagementRate =
      video.viewCount > 0
        ? ((video.likeCount + video.commentCount) / video.viewCount) * 100
        : 0;

    const result: AnalyticsResult = {
      views: video.viewCount,
      likes: video.likeCount,
      comments: video.commentCount,
      shares: 0, // YouTube API does not provide shares in video statistics
      engagementRate: Number(engagementRate.toFixed(2)),
      watchTime: null, // YouTube API does not provide watch time in video statistics
      thumbnail: video.thumbnailUrl,
      title: video.title,
      creator: video.channelName,
      syncedAt: new Date().toISOString(),
      publishedAt: video.publishedAt,
      durationSeconds: video.durationSeconds,
      platformId: video.videoId,
    };

    // Update cache
    this.cache.set(videoId, { result, timestamp: Date.now() });
    return result;
  }
}