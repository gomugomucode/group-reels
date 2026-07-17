import { extractYouTubeVideoId } from '@/lib/youtube';
import { buildYouTubeApiUrl, mapYouTubeResponse } from '@/lib/youtube';
import { VideoProvider, NormalizedMetrics, VideoMetadata, VideoMetrics } from '@/lib/analytics/types';

export class YouTubeProvider implements VideoProvider {
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

  async fetchDetails(videoId: string): Promise<{
    metadata: VideoMetadata;
    metrics: VideoMetrics;
    rawResponse: any;
  }> {
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

    const metadata: VideoMetadata = {
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      publishedAt: video.publishedAt,
      durationSeconds: video.durationSeconds,
      channelName: video.channelName,
    };

    const metrics: VideoMetrics = {
      views: video.viewCount,
      likes: video.likeCount,
      comments: video.commentCount,
    };

    return {
      metadata,
      metrics,
      rawResponse: data,
    };
  }

  normalize(metadata: VideoMetadata, metrics: VideoMetrics, rawResponse: any): NormalizedMetrics {
    return {
      views: metrics.views,
      likes: metrics.likes,
      comments: metrics.comments,
      shares: 0, // YouTube API does not provide shares in the video statistics
      favorites: 0, // YouTube API does not provide favorites in the video statistics
      duration: metadata.durationSeconds,
      thumbnail: metadata.thumbnailUrl,
      title: metadata.title,
      publishedAt: metadata.publishedAt,
      creator: metadata.channelName,
      platformId: rawResponse.items?.[0]?.id || '',
      rawResponse,
    };
  }

  supportsRealtime(): boolean {
    // YouTube Data API does not provide real-time metrics
    return false;
  }

  supportsHistory(): boolean {
    // We can get historical data by storing snapshots ourselves
    return true;
  }
}
