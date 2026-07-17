import { YouTubeProvider } from '@/lib/analytics/providers/youtube';
import { VideoProvider } from '@/lib/analytics/types';

let youtubeProvider: YouTubeProvider | null = null;

export function getAnalyticsProvider(platform: string): VideoProvider | null {
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
    default:
      console.warn(`No provider implemented for platform: ${platform}`);
      return null;
  }
}
