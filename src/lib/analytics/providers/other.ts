import { AnalyticsProvider, AnalyticsResult } from '@/lib/analytics/types';

export class OtherProvider implements AnalyticsProvider {
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
    return {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      engagementRate: 0,
      watchTime: null,
      thumbnail: null,
      title: null,
      creator: null,
      syncedAt: new Date().toISOString(),
      publishedAt: null,
      durationSeconds: null,
      platformId: '',
    };
  }
}