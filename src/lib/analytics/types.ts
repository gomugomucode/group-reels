export interface AnalyticsResult {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  watchTime: number | null;
  thumbnail: string | null;
  title: string | null;
  creator: string | null;
  syncedAt: string;
  publishedAt: string | null;
  durationSeconds: number | null;
  platformId: string;
}

export interface AnalyticsProvider {
  validateUrl(url: string): boolean;
  extractId(url: string): string | null;
  fetchAnalytics(url: string): Promise<AnalyticsResult>;
}