import { AnalyticsProvider, AnalyticsResult } from '@/lib/analytics/types';

export class OtherAdapter implements AnalyticsProvider {
  validateUrl(url: string): boolean {
    // For any other URL, we return true as a fallback
    return true;
  }

  extractId(url: string): string | null {
    // We cannot extract an ID for unknown platforms
    return null;
  }

  async fetchAnalytics(url: string): Promise<AnalyticsResult> {
    // For other platforms, we return zeros/nulls as we cannot fetch real data
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
      status: "unsupported",
      syncedAt: now,
    };
  }
}