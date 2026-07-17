import { AnalyticsProvider, AnalyticsResult } from '@/lib/analytics/types';

export class LinkedInProvider implements AnalyticsProvider {
  validateUrl(url: string): boolean {
    return /linkedin\.com/.test(url);
  }

  extractId(url: string): string | null {
    // TODO: Implement proper LinkedIn video/post ID extraction
    return null;
  }

  async fetchAnalytics(url: string): Promise<AnalyticsResult> {
    throw new Error('LinkedIn provider not yet implemented');
  }
}