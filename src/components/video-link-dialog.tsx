import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
      const parsed = videoLinkSchema.safeParse({ title, url });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const platform = detectPlatform(parsed.data.url);
      const status = deriveStatus(parsed.data.url);
      const payload = {
        group_id: groupId,
        title: parsed.data.title || null,
        url: parsed.data.url,
        platform,
        status,
      };
      if (editing) {
        const { error } = await supabase
          .from("video_links")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("video_links").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-links", groupId] });
      qc.invalidateQueries({ queryKey: ["video-links-all"] });
      toast.success(editing ? "Video link updated" : "Video link added");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit video link" : "Add video link"}</DialogTitle>
          <DialogDescription>
            Paste a link from YouTube, TikTok, Instagram, Facebook, Vimeo, or elsewhere.
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
            <Label htmlFor="v-url">Video URL</Label>
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
            <p className="text-xs text-muted-foreground">
              Links matching a known platform ({Object.values(PLATFORM_LABELS)
                .slice(0, 5)
                .join(", ")}
              ) are marked valid automatically.
            </p>
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
              {editing ? "Save changes" : "Add link"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
