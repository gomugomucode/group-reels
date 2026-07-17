export interface AnalyticsResult {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  duration: number; // in seconds
  thumbnail: string | null;
  title: string | null;
  publishedAt: string | null; // ISO 8601
  creator: string | null;
  status: string; // e.g., "success", "error", "requires_authorization", "invalid_url"
  syncedAt: string; // ISO 8601 timestamp of when the analytics were fetched
}

export interface AnalyticsProvider {
  validateUrl(url: string): boolean;
  extractId(url: string): string | null;
  fetchAnalytics(url: string): Promise<AnalyticsResult>;
}