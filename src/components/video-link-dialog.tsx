import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
} from "@/lib/video-platforms";
import type { VideoLink } from "@/hooks/use-data";
import { PlatformBadge, StatusBadge } from "@/components/platform-badge";

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

  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? "");
      setUrl(editing?.url ?? "");
    }
  }, [open, editing]);

  const preview = url.trim()
    ? { platform: detectPlatform(url), status: deriveStatus(url) }
    : null;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("You must be signed in to save content.");
      const parsed = videoLinkSchema.safeParse({ title, url });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const platform = detectPlatform(parsed.data.url);
      const status = deriveStatus(parsed.data.url);
      const payload = {
        user_id: user.id,
        group_id: groupId,
        title: parsed.data.title || null,
        url: parsed.data.url,
        platform_id: platform,
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
    onError: () => toast.error("We couldn't save your content. Please try again."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Content</DialogTitle>
          <DialogDescription>
            Update the title and URL for this content.
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
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="v-url">Content URL</Label>
            <Input
              id="v-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              required
            />
            {preview && (
              <div className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
                <span>Detected:</span>
                <PlatformBadge platform={preview.platform} />
                <StatusBadge status={preview.status} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
