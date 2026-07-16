import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useSyncVideoAnalytics } from "@/hooks/use-data";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { friendlyError } from "@/lib/error-messages";

interface RefreshButtonProps {
  videoLinkId: string;
  lastFetchedAt: string | null | undefined;
  syncStatus: "idle" | "pending" | "syncing" | "success" | "error" | "private" | "deleted";
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
  const syncMutation = useSyncVideoAnalytics();
  const loading = syncMutation.isPending;
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

    const toastId = toast.loading("Syncing video statistics...");
    try {
      const res = await syncMutation.mutateAsync({ videoLinkId, force: true });
      if (res.ok) {
        toast.success("Video statistics updated!", { id: toastId });
      } else {
        console.error("[RefreshButton] sync error:", res.error);
        toast.error(friendlyError(res.error || "Failed to update video metrics"), { id: toastId });
      }
    } catch (err: any) {
      console.error("[RefreshButton] unexpected sync error:", err);
      toast.error(friendlyError(err), { id: toastId });
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
    return "Force sync video statistics";
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSync}
      disabled={isBtnDisabled}
      className={size === "icon" ? "size-8" : ""}
      title={getTooltip()}
      aria-label={getTooltip()}
    >
      <RefreshCw className={`size-4 ${loading || syncStatus === "syncing" ? "animate-spin text-primary" : ""}`} />
      {size !== "icon" && <span className="ml-2">{loading || syncStatus === "syncing" ? "Syncing..." : "Refresh"}</span>}
    </Button>
  );
}
