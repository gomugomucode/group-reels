import { AnalyticsProvider, AnalyticsResult } from '@/lib/analytics/types';

export class InstagramProvider implements AnalyticsProvider {
  validateUrl(url: string): boolean {
    return /instagram\.com/.test(url);
  }

  extractId(url: string): string | null {
    // TODO: Implement proper Instagram media ID extraction
    return null;
  }

  async fetchAnalytics(url: string): Promise<AnalyticsResult> {
    throw new Error('Instagram provider not yet implemented');
  }
}