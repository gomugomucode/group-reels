import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Instagram, Youtube, HelpCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/integrations")({
  component: IntegrationsSettings,
});

function IntegrationsSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Platform Integrations</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage connected platforms and APIs for sync automation.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* YouTube API Connected */}
        <div className="flex flex-col justify-between border border-border bg-secondary/10 rounded-2xl p-5 hover:bg-secondary/20 transition-all">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-red-500/10 text-red-500">
                <Youtube className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold text-sm">YouTube Data Integration</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Automated video stats retrieval.</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
              Successfully linked with YouTube Data API. System retrieves view count, comment count, and like metrics automatically.
            </p>
          </div>
          <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Status</span>
            <Badge className="bg-success/15 text-success border-success/30 border" variant="outline">
              <CheckCircle2 className="mr-1 size-3.5" /> Connected
            </Badge>
          </div>
        </div>

        {/* Instagram Integration */}
        <div className="flex flex-col justify-between border border-border bg-secondary/5 rounded-2xl p-5 opacity-75 hover:opacity-100 transition-all">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-pink-500/10 text-pink-500">
                <Instagram className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold text-sm">Instagram Graph Integration</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Reels metric statistics.</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
              Synchronize views and likes metrics directly for IG Reels posts.
            </p>
          </div>
          <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Status</span>
            <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 border" variant="outline">
              Coming Soon
            </Badge>
          </div>
        </div>

        {/* TikTok Integration */}
        <div className="flex flex-col justify-between border border-border bg-secondary/5 rounded-2xl p-5 opacity-75 hover:opacity-100 transition-all">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-teal-500/10 text-teal-600">
                <HelpCircle className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold text-sm">TikTok Creator Integration</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Short video analytics sync.</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
              Read performance metrics automatically using your TikTok Creator account.
            </p>
          </div>
          <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Status</span>
            <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 border" variant="outline">
              Coming Soon
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
