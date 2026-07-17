import { AnalyticsProvider, AnalyticsResult } from '@/lib/analytics/types';

export class TikTokAdapter implements AnalyticsProvider {
  private clientKey: string;
  private clientSecret: string;

  constructor(clientKey: string, clientSecret: string) {
    this.clientKey = clientKey;
    this.clientSecret = clientSecret;
  }

  validateUrl(url: string): boolean {
    // Simple check for TikTok URL patterns
    return /tiktok\.com|vt\.tiktok\.com/.test(url);
  }

  extractId(url: string): string | null {
    // TODO: Implement proper TikTok video ID extraction
    return null;
  }

  async fetchAnalytics(url: string): Promise<AnalyticsResult> {
    // Not implemented yet
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
      status: "not_implemented",
      syncedAt: now,
    };
  }
}