export interface NormalizedMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  favorites: number;
  duration: number;
  thumbnail: string;
  title: string;
  publishedAt: string; // ISO 8601
  creator: string;
  platformId: string;
  rawResponse: any;
}

export interface VideoMetadata {
  title: string;
  thumbnailUrl: string;
  publishedAt: string; // ISO 8601
  durationSeconds: number;
  channelName: string;
}

export interface VideoMetrics {
  views: number;
  likes: number;
  comments: number;
  shares?: number;
  favorites?: number;
}

export interface VideoProvider {
  validateUrl(url: string): boolean;
  extractId(url: string): string | null;
  fetchDetails(videoId: string): Promise<{
    metadata: VideoMetadata;
    metrics: VideoMetrics;
    rawResponse: any;
  }>;
  normalize(metadata: VideoMetadata, metrics: VideoMetrics, rawResponse: any): NormalizedMetrics;
  supportsRealtime(): boolean;
  supportsHistory(): boolean;
}
