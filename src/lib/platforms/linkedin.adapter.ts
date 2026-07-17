import { AnalyticsProvider, AnalyticsResult } from '@/lib/analytics/types';

export class LinkedInAdapter implements AnalyticsProvider {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  validateUrl(url: string): boolean {
    return /linkedin\.com/.test(url);
  }

  extractId(url: string): string | null {
    // TODO: Implement proper LinkedIn video/post ID extraction
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