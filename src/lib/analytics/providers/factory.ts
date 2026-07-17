import { YouTubeAdapter } from '@/lib/platforms/youtube.adapter';
import { OtherAdapter } from '@/lib/platforms/other.adapter';
import { AnalyticsProvider } from '@/lib/analytics/types';

let youtubeAdapter: YouTubeAdapter | null = null;
let otherAdapter: OtherAdapter | null = null;

export function getAnalyticsProvider(platform: string): AnalyticsProvider | null {
  switch (platform) {
    case 'youtube':
      if (!youtubeAdapter) {
        const apiKey = process.env.YOUTUBE_API_KEY;
        if (!apiKey) {
          console.error('YouTube API key is not configured');
          return null;
        }
        youtubeAdapter = new YouTubeAdapter(apiKey);
      }
      return youtubeAdapter;
    case 'other':
      if (!otherAdapter) {
        otherAdapter = new OtherAdapter();
      }
      return otherAdapter;
    default:
      // For all other platforms, we return null indicating not implemented/configured
      console.warn(`No provider implemented for platform: ${platform}`);
      return null;
  }
}