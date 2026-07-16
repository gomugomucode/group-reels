import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  component: NotificationsSettings,
});

function NotificationsSettings() {
  const [toastPosition, setToastPosition] = useState("bottom-right");

  useEffect(() => {
    const savedPos = localStorage.getItem("pref-toast-position");
    if (savedPos) setToastPosition(savedPos);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("pref-toast-position", toastPosition);
    toast.success(`Position saved! Test notification.`, {
      position: toastPosition as any,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Notification Preferences</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Configure when and where alert popups are rendered.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-md">
        {/* Toast Position */}
        <div className="space-y-2">
          <Label htmlFor="toast-position" className="text-sm font-medium">Toast Popups Location</Label>
          <Select value={toastPosition} onValueChange={setToastPosition}>
            <SelectTrigger id="toast-position" className="w-full">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top-right">Top Right</SelectItem>
              <SelectItem value="top-left">Top Left</SelectItem>
              <SelectItem value="top-center">Top Center</SelectItem>
              <SelectItem value="bottom-right">Bottom Right</SelectItem>
              <SelectItem value="bottom-left">Bottom Left</SelectItem>
              <SelectItem value="bottom-center">Bottom Center</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">Selects the default position for alert/toast feedback windows.</p>
        </div>

        <Button type="submit">
          Save Configuration
        </Button>
      </form>
    </div>
  );
}
