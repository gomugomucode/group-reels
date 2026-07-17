import { AnalyticsProvider, AnalyticsResult } from '@/lib/analytics/types';

export class TikTokProvider implements AnalyticsProvider {
  validateUrl(url: string): boolean {
    // Simple check for TikTok domains
    return /tiktok\.com|vt\.tiktok\.com/.test(url);
  }

  extractId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // Handle vt.tiktok.com short links
      if (urlObj.hostname === 'vt.tiktok.com') {
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length === 1) {
          return pathParts[0];
        }
      }
      // Handle www.tiktok.com/@username/video/videoid
      if (urlObj.hostname.includes('tiktok.com')) {
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        // Look for the video id in the path; it might be after 'video'
        const videoIndex = pathParts.indexOf('video');
        if (videoIndex !== -1 && videoIndex + 1 < pathParts.length) {
          return pathParts[videoIndex + 1];
        }
        // Alternatively, the last segment might be the video id
        if (pathParts.length > 0) {
          return pathParts[pathParts.length - 1];
        }
      }
    } catch (e) {
      // Invalid URL
      return null;
    }
    return null;
  }

  async fetchAnalytics(url: string): Promise<AnalyticsResult> {
    // Not implemented yet
    throw new Error('TikTok provider not yet implemented');
  }
}