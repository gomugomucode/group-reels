import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Instagram, Youtube, Music2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { startTikTokOAuth, completeTikTokOAuth, disconnectTikTok } from "@/lib/tiktok.functions";

export const Route = createFileRoute("/_authenticated/settings/integrations")({
  component: IntegrationsSettings,
});

function IntegrationsSettings() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const startFn = useServerFn(startTikTokOAuth);
  const completeFn = useServerFn(completeTikTokOAuth);
  const disconnectFn = useServerFn(disconnectTikTok);

  const { data: tiktokConnection, isLoading } = useQuery({
    queryKey: ["tiktok-connection", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_accounts")
        .select("id, username, display_name, avatar_url, platform_account_id, is_active")
        .eq("user_id", session!.user.id)
        .eq("platform_id", "tiktok")
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const result = await startFn({});
      if (!result?.authUrl) throw new Error("TikTok authorization URL could not be created.");
      sessionStorage.setItem("tiktok-oauth-state", result.state ?? "");
      window.location.assign(result.authUrl);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "TikTok connection failed.");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await disconnectFn({});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tiktok-connection"] });
      toast.success("TikTok has been disconnected.");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "TikTok disconnect failed.");
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const expectedState = sessionStorage.getItem("tiktok-oauth-state");

    if (!code) return;
    if (state && expectedState && state !== expectedState) {
      toast.error("TikTok OAuth was rejected because the state token did not match.");
      return;
    }

    completeFn({ code, state })
      .then(() => {
        sessionStorage.removeItem("tiktok-oauth-state");
        qc.invalidateQueries({ queryKey: ["tiktok-connection"] });
        toast.success("TikTok has been connected.");
        window.history.replaceState({}, "", "/settings/integrations");
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "TikTok OAuth failed.");
      });
  }, [completeFn, qc]);

  const isConnected = !!tiktokConnection?.is_active;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Platform Integrations</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage connected platforms and APIs for sync automation.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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

        <div className="flex flex-col justify-between border border-border bg-secondary/5 rounded-2xl p-5 hover:bg-secondary/10 transition-all">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-teal-500/10 text-teal-600">
                <Music2 className="size-5" />
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
          <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs gap-3">
            <span className="text-muted-foreground">Status</span>
            <div className="flex items-center gap-2">
              {isLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : isConnected ? (
                <Badge className="bg-success/15 text-success border-success/30 border" variant="outline">
                  <CheckCircle2 className="mr-1 size-3.5" /> Connected
                </Badge>
              ) : (
                <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 border" variant="outline">
                  Not connected
                </Badge>
              )}
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant={isConnected ? "outline" : "default"}
              size="sm"
              disabled={!session?.user?.id || connectMutation.isPending || disconnectMutation.isPending}
              onClick={() => {
                if (isConnected) {
                  disconnectMutation.mutate();
                } else {
                  connectMutation.mutate();
                }
              }}
            >
              {connectMutation.isPending ? "Connecting..." : disconnectMutation.isPending ? "Disconnecting..." : isConnected ? "Disconnect TikTok" : "Connect TikTok"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
