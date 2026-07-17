import { detectPlatform } from '@/lib/video-platforms';
import { YouTubeAdapter } from '@/lib/platforms/youtube.adapter';
import { TikTokAdapter } from '@/lib/platforms/tiktok.adapter';
import { FacebookAdapter } from '@/lib/platforms/facebook.adapter';
import { InstagramAdapter } from '@/lib/platforms/instagram.adapter';
import { LinkedInAdapter } from '@/lib/platforms/linkedin.adapter';
import { VimeoAdapter } from '@/lib/platforms/vimeo.adapter';
import { OtherAdapter } from '@/lib/platforms/other.adapter';
import { AnalyticsResult } from '@/lib/analytics/types';

export class AnalyticsService {
  private youtubeAdapter: YouTubeAdapter | null = null;
  private tiktokAdapter: TikTokAdapter | null = null;
  private facebookAdapter: FacebookAdapter | null = null;
  private instagramAdapter: InstagramAdapter | null = null;
  private linkedinAdapter: LinkedInAdapter | null = null;
  private vimeoAdapter: VimeoAdapter | null = null;
  private otherAdapter: OtherAdapter | null = null;

  async fetchAnalytics(url: string): Promise<AnalyticsResult> {
    const platform = detectPlatform(url);
    let adapter: any;

    switch (platform) {
      case 'youtube':
        if (!this.youtubeAdapter) {
          const apiKey = process.env.YOUTUBE_API_KEY;
          if (!apiKey) {
            return this.makeErrorResult("youtube_api_key_missing");
          }
          this.youtubeAdapter = new YouTubeAdapter(apiKey);
        }
        adapter = this.youtubeAdapter;
        break;
      case 'tiktok':
        if (!this.tiktokAdapter) {
          // For TikTok, we need client key and secret; but we'll just instantiate without for now
          // In the future, we'll check for env vars
          const clientKey = process.env.TIKTOK_CLIENT_KEY;
          const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
          if (!clientKey || !clientSecret) {
            return this.makeErrorResult("tiktok_credentials_missing");
          }
          this.tiktokAdapter = new TikTokAdapter(clientKey, clientSecret);
        }
        adapter = this.tiktokAdapter;
        break;
      case 'facebook':
        if (!this.facebookAdapter) {
          const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
          if (!accessToken) {
            return this.makeErrorResult("facebook_access_token_missing");
          }
          this.facebookAdapter = new FacebookAdapter(accessToken);
        }
        adapter = this.facebookAdapter;
        break;
      case 'instagram':
        if (!this.instagramAdapter) {
          const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
          if (!accessToken) {
            return this.makeErrorResult("instagram_access_token_missing");
          }
          this.instagramAdapter = new InstagramAdapter(accessToken);
        }
        adapter = this.instagramAdapter;
        break;
      case 'linkedin':
        if (!this.linkedinAdapter) {
          const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
          if (!accessToken) {
            return this.makeErrorResult("linkedin_access_token_missing");
          }
          this.linkedinAdapter = new LinkedInAdapter(accessToken);
        }
        adapter = this.linkedinAdapter;
        break;
      case 'vimeo':
        if (!this.vimeoAdapter) {
          const accessToken = process.env.VIMEO_ACCESS_TOKEN;
          if (!accessToken) {
            return this.makeErrorResult("vimeo_access_token_missing");
          }
          this.vimeoAdapter = new VimeoAdapter(accessToken);
        }
        adapter = this.vimeoAdapter;
        break;
      case 'other':
        if (!this.otherAdapter) {
          this.otherAdapter = new OtherAdapter();
        }
        adapter = this.otherAdapter;
        break;
      default:
        return this.makeErrorResult("unknown_platform");
    }

    return adapter.fetchAnalytics(url);
  }

  private makeErrorResult(status: string): AnalyticsResult {
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
      status: status,
      syncedAt: now,
    };
  }
}

// Export a singleton instance for convenience
export const analyticsService = new AnalyticsService();