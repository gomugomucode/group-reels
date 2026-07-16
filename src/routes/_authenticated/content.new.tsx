import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deriveStatus, detectPlatform, videoLinkSchema } from "@/lib/video-platforms";
import { PlatformBadge } from "@/components/platform-badge";
import { useAuth } from "@/hooks/use-auth";
import { useMyGroup } from "@/hooks/use-data";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/content/new")({
  component: AddContentPage,
});

function AddContentPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  
  // For MVP, we get the current user's workspace (group)
  const { session } = useAuth();
  const { data: myGroup, isLoading: isLoadingGroup } = useMyGroup(session?.user?.id);

  const preview = url.trim() ? { platform: detectPlatform(url), status: deriveStatus(url) } : null;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error("You must be signed in to save content.");
      const parsed = videoLinkSchema.safeParse({ url });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      
      const platform = detectPlatform(parsed.data.url);
      const status = deriveStatus(parsed.data.url);
      
      if (!myGroup) throw new Error("No workspace found. Please create one first.");

      const payload = {
        user_id: session.user.id,
        group_id: myGroup.id,
        title: null,
        url: parsed.data.url,
        platform_id: platform,
        content_type: "video",
        status,
      };
      
      const { data, error } = await supabase
        .from("content")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      const { error: metricsError } = await supabase
        .from("content_metrics")
        .insert({ content_id: data.id, sync_status: "pending" });
      if (metricsError) throw metricsError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-links"] });
      qc.invalidateQueries({ queryKey: ["video-links-all"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
      qc.invalidateQueries({ queryKey: ["admin-video-links-list"] });
      qc.invalidateQueries({ queryKey: ["admin-analytics-summary"] });
      toast.success("Content added successfully");
      navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Add Content</h1>
          <p className="mt-2 text-muted-foreground">
            Paste a URL from YouTube, Instagram, TikTok, Facebook, or LinkedIn.
          </p>
        </div>

        {isLoadingGroup ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="url" className="text-lg font-semibold">Content URL</Label>
                <Input
                  id="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="h-12 text-lg"
                  autoFocus
                />
              </div>

              {preview && (
                <div className="rounded-xl bg-secondary/50 p-4">
                  <div className="flex items-center gap-3">
                    <PlatformBadge platform={preview.platform} />
                    <span className="text-sm font-medium">
                      {preview.status === "valid" ? "Platform detected" : "Checking platform..."}
                    </span>
                  </div>
                  <div className="mt-4 aspect-video rounded-lg bg-secondary flex items-center justify-center text-muted-foreground border border-dashed border-border">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <PlatformBadge platform={preview.platform} /> Preview will appear after saving
                    </span>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-lg"
                disabled={!url.trim() || mutation.isPending}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-5 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Content"
                )}
              </Button>
            </form>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
