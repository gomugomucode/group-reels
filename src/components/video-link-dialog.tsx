import { useEffect, useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deriveStatus,
  detectPlatform,
  PLATFORM_LABELS,
  videoLinkSchema,
  urlSchema,
} from "@/lib/video-platforms";
import type { VideoLink } from "@/hooks/use-data";
import { PlatformBadge, StatusBadge } from "@/components/platform-badge";
import { parseUrl } from "@/lib/url-parser";
import { friendlyError, ERR_DUPLICATE_URL } from "@/lib/error-messages";

export function VideoLinkDialog({
  open,
  onOpenChange,
  groupId,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
  editing?: VideoLink | null;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? "");
      setUrl(editing?.url ?? "");
      setUrlError(null);
      setIsDuplicate(false);
    }
  }, [open, editing]);

  // Validate URL inline
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

  // Debounced duplicate check
  useEffect(() => {
    if (!url.trim() || urlError || !groupId) {
      setIsDuplicate(false);
      return;
    }

    const parsedUrl = parseUrl(url.trim());
    const canonicalUrl = parsedUrl.canonicalUrl || url.trim();

    // If editing and URL hasn't changed from original, skip duplicate check
    if (editing && canonicalUrl === editing.url) {
      setIsDuplicate(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingDuplicate(true);
      try {
        let query = supabase
          .from("content")
          .select("id")
          .eq("group_id", groupId)
          .eq("url", canonicalUrl)
          .is("deleted_at", null);
        
        if (editing) {
          query = query.neq("id", editing.id);
        }

        const { data } = await query.maybeSingle();
        setIsDuplicate(!!data);
      } catch {
        setIsDuplicate(false);
      } finally {
        setIsCheckingDuplicate(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [url, urlError, groupId, editing]);

  const parsed = url.trim() ? parseUrl(url.trim()) : null;
  const platform = parsed ? parsed.platform : null;
  const isUnsupportedPlatform = platform === "other" && !!url.trim() && !urlError;

  const preview = url.trim() && !urlError
    ? { platform: platform ?? "other", status: deriveStatus(url) }
    : null;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("You must be signed in to save content.");
      const schemaResult = videoLinkSchema.safeParse({ title, url });
      if (!schemaResult.success) throw new Error(schemaResult.error.issues[0].message);
      if (!groupId) throw new Error("No group specified.");

      const parsedResult = parseUrl(schemaResult.data.url);
      const canonicalUrl = parsedResult.canonicalUrl || schemaResult.data.url;
      const detectedPlatform = detectPlatform(schemaResult.data.url);
      const status = deriveStatus(schemaResult.data.url);

      // Final duplicate check before save
      let query = supabase
        .from("content")
        .select("id")
        .eq("group_id", groupId)
        .eq("url", canonicalUrl)
        .is("deleted_at", null);

      if (editing) {
        query = query.neq("id", editing.id);
      }

      const { data: existing } = await query.maybeSingle();
      if (existing) throw new Error(ERR_DUPLICATE_URL);

      const payload = {
        user_id: user.id,
        group_id: groupId,
        title: schemaResult.data.title || null,
        url: canonicalUrl,
        platform_id: detectedPlatform,
        content_type: "video",
        status,
      };

      if (editing) {
        const { error } = await supabase
          .from("content")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
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
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-links", groupId] });
      qc.invalidateQueries({ queryKey: ["video-links-all"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-data"] });
      qc.invalidateQueries({ queryKey: ["admin-video-links-list"] });
      qc.invalidateQueries({ queryKey: ["admin-analytics-summary"] });
      qc.invalidateQueries({ queryKey: ["group-analytics-summary", groupId] });
      toast.success(editing ? "Content updated successfully" : "Content added successfully");
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      console.error("[VideoLinkDialog] mutation error:", e);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Content" : "Add Content"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the title and URL for this content."
              : "Enter a URL to add new video content to the workspace."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="v-title">Title (optional)</Label>
            <Input
              id="v-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Our launch reel"
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="v-url">Content URL</Label>
            <Input
              id="v-url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                validateUrl(e.target.value);
              }}
              placeholder="https://youtube.com/watch?v=..."
              className={urlError ? "border-destructive ring-destructive/20" : ""}
              required
              aria-describedby={urlError ? "dialog-url-error" : undefined}
              aria-invalid={!!urlError}
            />

            {/* Inline validation error */}
            {urlError && (
              <p
                id="dialog-url-error"
                className="flex items-center gap-1.5 text-xs text-destructive mt-1"
                role="alert"
              >
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                {urlError}
              </p>
            )}

            {/* Duplicate warning */}
            {isDuplicate && !urlError && (
              <p
                className="flex items-center gap-1.5 text-xs text-destructive mt-1"
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

            {preview && !isDuplicate && (
              <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                <span>Detected:</span>
                <PlatformBadge platform={preview.platform} />
                <StatusBadge status={preview.status} />
                {isCheckingDuplicate && (
                  <span className="flex items-center gap-1.5 ml-auto text-[10px]">
                    <Loader2 className="size-3 animate-spin" aria-hidden /> Checking duplicates...
                  </span>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editing ? "Save changes" : "Add content"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
