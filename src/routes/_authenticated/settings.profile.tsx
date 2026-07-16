import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import { friendlyError } from "@/lib/error-messages";

export const Route = createFileRoute("/_authenticated/settings/profile")({
  component: ProfileSettings,
});

function ProfileSettings() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.username) {
      setUsername(profile.username);
    }
  }, [profile]);

  const initials = username.trim()
    ? username.trim().slice(0, 2).toUpperCase()
    : "?";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!username.trim()) {
      toast.error("Display name cannot be empty");
      return;
    }

    setSaving(true);
    const toastId = toast.loading("Updating profile...");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ username: username.trim(), updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Profile updated successfully!", { id: toastId });
      qc.invalidateQueries({ queryKey: ["auth-profile"] });
      qc.invalidateQueries(); // Invalidate all query caches to sync username updates
    } catch (err: any) {
      console.error("[ProfileSettings] save error:", err);
      toast.error(friendlyError(err), { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Profile Settings</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Update your username and display name credentials.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-md">
        {/* Avatar Initials Preview */}
        <div className="flex items-center gap-4 border border-border bg-secondary/10 rounded-2xl p-4">
          <Avatar className="size-16 ring-4 ring-primary/5">
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-sm font-semibold">Avatar Preview</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Avatar initials will auto-adjust as you type.</p>
          </div>
        </div>

        {/* Email Address (Read-only) */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={profile?.email ?? user?.email ?? ""}
            disabled
            className="bg-secondary/40 border-border text-muted-foreground cursor-not-allowed"
          />
          <p className="text-[11px] text-muted-foreground">Contact support to update your registration email.</p>
        </div>

        {/* Username/Display Name */}
        <div className="space-y-2">
          <Label htmlFor="username" className="text-sm font-medium">Display Name (Username)</Label>
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            maxLength={60}
            required
          />
        </div>

        <Button type="submit" disabled={saving || !username.trim() || username.trim() === profile?.username}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save Profile
        </Button>
      </form>
    </div>
  );
}
