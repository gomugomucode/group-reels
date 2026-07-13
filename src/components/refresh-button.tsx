import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { syncVideoAnalytics } from "@/lib/analytics.functions";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface RefreshButtonProps {
  videoLinkId: string;
  lastFetchedAt: string | null | undefined;
  syncStatus: "idle" | "syncing" | "success" | "error" | "private" | "deleted";
  canRefresh: boolean;
  groupId: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost";
}

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export function RefreshButton({
  videoLinkId,
  lastFetchedAt,
  syncStatus,
  canRefresh,
  groupId,
  size = "icon",
  variant = "ghost",
}: RefreshButtonProps) {
  const queryClient = useQueryClient();
  const syncFn = useServerFn(syncVideoAnalytics);
  const [loading, setLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (!lastFetchedAt) return;

    const checkCooldown = () => {
      const elapsed = Date.now() - new Date(lastFetchedAt).getTime();
      const remaining = COOLDOWN_MS - elapsed;
      if (remaining > 0) {
        setCooldownSeconds(Math.ceil(remaining / 1000));
      } else {
        setCooldownSeconds(0);
      }
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, [lastFetchedAt]);

  const handleSync = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canRefresh || cooldownSeconds > 0 || loading) return;

    setLoading(true);
    const toastId = toast.loading("Syncing video statistics...");
    try {
      const res = await syncFn({ data: { videoLinkId, force: true } });
      if (res.ok) {
        toast.success("Video statistics updated!", { id: toastId });
        queryClient.invalidateQueries({ queryKey: ["video-links", groupId] });
        queryClient.invalidateQueries({ queryKey: ["video-links-all"] });
        queryClient.invalidateQueries({ queryKey: ["video-metrics-history", videoLinkId] });
        queryClient.invalidateQueries({ queryKey: ["group-analytics-summary", groupId] });
        queryClient.invalidateQueries({ queryKey: ["admin-analytics-summary"] });
      } else {
        toast.error(res.error || "Failed to update video metrics", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred during sync", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const isBtnDisabled = !canRefresh || cooldownSeconds > 0 || loading || syncStatus === "syncing";

  const getTooltip = () => {
    if (!canRefresh) return "Only owners, group collaborators, or admins can sync analytics";
    if (syncStatus === "syncing" || loading) return "Syncing in progress...";
    if (cooldownSeconds > 0) {
      const minutes = Math.floor(cooldownSeconds / 60);
      const seconds = cooldownSeconds % 60;
      return `Rate limited. Wait ${minutes}m ${seconds}s before refreshing again.`;
    }
    return "Force sync video statistics from YouTube";
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSync}
      disabled={isBtnDisabled}
      className={size === "icon" ? "size-8" : ""}
      title={getTooltip()}
    >
      <RefreshCw className={`size-4 ${loading || syncStatus === "syncing" ? "animate-spin text-primary" : ""}`} />
      {size !== "icon" && <span className="ml-2">{loading || syncStatus === "syncing" ? "Syncing..." : "Refresh"}</span>}
    </Button>
  );
}
