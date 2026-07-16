import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/settings/preferences")({
  component: PreferencesSettings,
});

function PreferencesSettings() {
  const [dashboardView, setDashboardView] = useState("list");
  const [dateFormat, setDateFormat] = useState("MMM d, yyyy");

  useEffect(() => {
    // Load preferences on mount
    const savedView = localStorage.getItem("pref-dashboard-view");
    if (savedView) setDashboardView(savedView);

    const savedFormat = localStorage.getItem("pref-date-format");
    if (savedFormat) setDateFormat(savedFormat);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("pref-dashboard-view", dashboardView);
    localStorage.setItem("pref-date-format", dateFormat);
    toast.success("Preferences saved successfully!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Workspace Preferences</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Customize your local browsing preferences.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-md">
        {/* Default Dashboard View */}
        <div className="space-y-2">
          <Label htmlFor="dashboard-view" className="text-sm font-medium">Default Dashboard View</Label>
          <Select value={dashboardView} onValueChange={setDashboardView}>
            <SelectTrigger id="dashboard-view" className="w-full">
              <SelectValue placeholder="Select view mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="list">List view (Detailed table)</SelectItem>
              <SelectItem value="grid">Grid view (Visual cards)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">Sets the default display layout mode on your dashboard library.</p>
        </div>

        {/* Date Format preference */}
        <div className="space-y-2">
          <Label htmlFor="date-format" className="text-sm font-medium">Date Display Format</Label>
          <Select value={dateFormat} onValueChange={setDateFormat}>
            <SelectTrigger id="date-format" className="w-full">
              <SelectValue placeholder="Select date format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MMM d, yyyy">Short Month (e.g. Jul 16, 2026)</SelectItem>
              <SelectItem value="yyyy-MM-dd">ISO standard (e.g. 2026-07-16)</SelectItem>
              <SelectItem value="MM/dd/yyyy">US slash (e.g. 07/16/2026)</SelectItem>
              <SelectItem value="dd/MM/yyyy">European slash (e.g. 16/07/2026)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">Preferred styling for date fields throughout the dashboard tables.</p>
        </div>

        <Button type="submit">
          Save Preferences
        </Button>
      </form>
    </div>
  );
}
