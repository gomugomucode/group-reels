import { YouTubeProvider } from '@/lib/analytics/providers/youtube';
import { OtherProvider } from '@/lib/analytics/providers/other';
import { AnalyticsProvider } from '@/lib/analytics/types';

let youtubeProvider: YouTubeProvider | null = null;
let otherProvider: OtherProvider | null = null;

export function getAnalyticsProvider(platform: string): AnalyticsProvider | null {
  switch (platform) {
    case 'youtube':
      if (!youtubeProvider) {
        const apiKey = process.env.YOUTUBE_API_KEY;
        if (!apiKey) {
          console.error('YouTube API key is not configured');
          return null;
        }
        youtubeProvider = new YouTubeProvider(apiKey);
      }
      return youtubeProvider;
    case 'other':
      if (!otherProvider) {
        otherProvider = new OtherProvider();
      }
      return otherProvider;
    default:
      // For all other platforms, we return null indicating not implemented/configured
      console.warn(`No provider implemented for platform: ${platform}`);
      return null;
  }
}