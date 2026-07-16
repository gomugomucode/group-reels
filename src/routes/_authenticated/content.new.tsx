import { useEffect, useState, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deriveStatus, detectPlatform, videoLinkSchema, urlSchema } from "@/lib/video-platforms";
import { parseUrl } from "@/lib/url-parser";
import { PlatformBadge } from "@/components/platform-badge";
import { useAuth } from "@/hooks/use-auth";
import { useMyGroup } from "@/hooks/use-data";
import { Skeleton } from "@/components/ui/skeleton";
import { friendlyError, ERR_DUPLICATE_URL } from "@/lib/error-messages";

export const Route = createFileRoute("/_authenticated/content/new")({
  component: AddContentPage,
});

function AddContentPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  const { session } = useAuth();
  const { data: myGroup, isLoading: isLoadingGroup } = useMyGroup(session?.user?.id);

  // Validate URL inline as user types
  const validateUrl = useCallback((value: string) => {
    if (!value.trim()) {
      setUrlError(null);
      return;
    }
    const result = urlSchema.safeParse(value);
    if (!result.success) {
      setUrlError(result.error.issues[0].message);
    } else {
      setUrlError(null);
    }
  }, []);

  // Check for duplicate URL in current workspace (debounced)
  useEffect(() => {
    if (!url.trim() || urlError || !myGroup?.id) {
      setIsDuplicate(false);
      return;
    }

    const parsedUrl = parseUrl(url.trim());
    const canonicalUrl = parsedUrl.canonicalUrl || url.trim();

    const timer = setTimeout(async () => {
      setIsCheckingDuplicate(true);
      try {
        const { data } = await supabase
          .from("content")
          .select("id")
          .eq("group_id", myGroup.id)
          .eq("url", canonicalUrl)
          .is("deleted_at", null)
          .maybeSingle();
        setIsDuplicate(!!data);
      } catch {
        setIsDuplicate(false);
      } finally {
        setIsCheckingDuplicate(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [url, urlError, myGroup?.id]);

  const parsed = url.trim() ? parseUrl(url.trim()) : null;
  const platform = parsed ? parsed.platform : null;
  const isUnsupportedPlatform = platform === "other" && !!url.trim() && !urlError;
  const showPreview = !!url.trim() && !urlError;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error("You must be signed in to save content.");
      const schemaResult = videoLinkSchema.safeParse({ url });
      if (!schemaResult.success) throw new Error(schemaResult.error.issues[0].message);
      if (!myGroup) throw new Error("No workspace found. Please create a group first.");

      const parsedResult = parseUrl(schemaResult.data.url);
      const canonicalUrl = parsedResult.canonicalUrl || schemaResult.data.url;
      const detectedPlatform = detectPlatform(schemaResult.data.url);
      const status = deriveStatus(schemaResult.data.url);

      // Final duplicate check before insert
      const { data: existing } = await supabase
        .from("content")
        .select("id")
        .eq("group_id", myGroup.id)
        .eq("url", canonicalUrl)
        .is("deleted_at", null)
        .maybeSingle();

      if (existing) throw new Error(ERR_DUPLICATE_URL);

      const payload = {
        user_id: session.user.id,
        group_id: myGroup.id,
        title: null,
        url: canonicalUrl,
        platform_id: detectedPlatform,
        content_type: "video" as const,
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
      toast.success("Content added successfully!");
      navigate({ to: "/dashboard" });
    },
    onError: (e: unknown) => {
      console.error("[AddContent] mutation error:", e);
      toast.error(friendlyError(e));
    },
  });

  const canSubmit =
    !!url.trim() &&
    !urlError &&
    !isDuplicate &&
    !isCheckingDuplicate &&
    !mutation.isPending;

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Add Content</h1>
          <p className="mt-2 text-muted-foreground">
            Paste a URL from YouTube, Instagram, TikTok, Facebook, Vimeo, or LinkedIn.
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
                <Label htmlFor="url" className="text-lg font-semibold">
                  Content URL
                </Label>
                <Input
                  id="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    validateUrl(e.target.value);
                  }}
                  className={`h-12 text-lg ${urlError ? "border-destructive ring-destructive/20" : ""}`}
                  autoFocus
                  aria-describedby={urlError ? "url-error" : undefined}
                  aria-invalid={!!urlError}
                />

                {/* Inline validation error */}
                {urlError && (
                  <p
                    id="url-error"
                    className="flex items-center gap-1.5 text-sm text-destructive"
                    role="alert"
                  >
                    <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                    {urlError}
                  </p>
                )}

                {/* Duplicate error */}
                {isDuplicate && (
                  <p
                    className="flex items-center gap-1.5 text-sm text-destructive"
                    role="alert"
                  >
                    <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                    {ERR_DUPLICATE_URL}
                  </p>
                )}

                {/* Unsupported platform notice */}
                {isUnsupportedPlatform && !isDuplicate && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mt-1" role="status">
                    <Info className="size-3.5 shrink-0 text-amber-500" aria-hidden />
                    Platform not recognised. Analytics sync won't be available for this URL.
                  </p>
                )}
              </div>

              {/* Preview */}
              {showPreview && platform && !isDuplicate && (
                <div className="rounded-xl bg-secondary/50 p-4">
                  <div className="flex items-center gap-3">
                    <PlatformBadge platform={platform} />
                    <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                      {isCheckingDuplicate ? (
                        <><Loader2 className="size-3.5 animate-spin" aria-hidden /> Checking...</>
                      ) : (
                        <><CheckCircle2 className="size-3.5 text-success" aria-hidden /> Platform detected</>
                      )}
                    </span>
                  </div>
                  <div className="mt-4 flex aspect-video items-center justify-center rounded-lg border border-dashed border-border bg-secondary">
                    <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <PlatformBadge platform={platform} />
                      Preview will appear after saving
                    </span>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="h-12 w-full text-lg"
                disabled={!canSubmit}
                aria-label="Save content"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-5 animate-spin" aria-hidden /> Saving...
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
