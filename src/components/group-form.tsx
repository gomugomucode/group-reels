import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, X, Loader2, Instagram, Youtube, Facebook, Music2, Linkedin, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { groupSchema } from "@/lib/video-platforms";
import type { Group } from "@/hooks/use-data";

const SOCIALS = [
  { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/yourteam" },
  { key: "tiktok", label: "TikTok", icon: Music2, placeholder: "https://tiktok.com/@yourteam" },
  { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@yourteam" },
  { key: "facebook", label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/yourteam" },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "https://linkedin.com/company/yourteam" },
  { key: "website", label: "Website", icon: Globe, placeholder: "https://yourteam.com" },
] as const;

export function GroupForm({
  userId,
  existing,
}: {
  userId: string;
  existing?: Group | null;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [teamName, setTeamName] = useState(existing?.team_name ?? "");
  const [teamLeader, setTeamLeader] = useState(existing?.team_leader ?? "");
  const [members, setMembers] = useState<string[]>(
    existing?.member_names.length ? existing.member_names : [""],
  );
  const [socials, setSocials] = useState<Record<string, string>>({
    instagram: existing?.instagram ?? "",
    tiktok: existing?.tiktok ?? "",
    youtube: existing?.youtube ?? "",
    facebook: existing?.facebook ?? "",
    linkedin: existing?.linkedin ?? "",
    website: existing?.website ?? "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = groupSchema.safeParse({
        team_name: teamName,
        team_leader: teamLeader,
        member_names: members.map((m) => m.trim()).filter(Boolean),
        ...socials,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);

      const payload = {
        team_name: parsed.data.team_name,
        team_leader: parsed.data.team_leader || null,
        member_names: parsed.data.member_names,
        instagram: parsed.data.instagram || null,
        tiktok: parsed.data.tiktok || null,
        youtube: parsed.data.youtube || null,
        facebook: parsed.data.facebook || null,
        linkedin: parsed.data.linkedin || null,
        website: parsed.data.website || null,
      };

      if (existing) {
        const { error } = await supabase
          .from("groups")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
        return existing.id;
      } else {
        const { data, error } = await supabase
          .from("groups")
          .insert({ ...payload, created_by: userId })
          .select("id")
          .single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["my-group"] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      qc.invalidateQueries({ queryKey: ["group", id] });
      toast.success(existing ? "Group updated" : "Group created");
      navigate({ to: "/groups/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Team details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-leader">Team leader (optional)</Label>
            <Input
              id="team-leader"
              value={teamLeader}
              onChange={(e) => setTeamLeader(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label>Members</Label>
          {members.map((m, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder={`Member ${i + 1}`}
                value={m}
                onChange={(e) => {
                  const next = [...members];
                  next[i] = e.target.value;
                  setMembers(next);
                }}
              />
              {members.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setMembers(members.filter((_, idx) => idx !== i))}
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMembers([...members, ""])}
          >
            <Plus className="mr-1 size-4" /> Add member
          </Button>
        </div>
      </section>

      {/* <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Social media links</h2>
        <p className="text-sm text-muted-foreground">All optional.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {SOCIALS.map(({ key, label, icon: Icon, placeholder }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key} className="flex items-center gap-2">
                <Icon className="size-4 text-muted-foreground" /> {label}
              </Label>
              <Input
                id={key}
                value={socials[key]}
                placeholder={placeholder}
                onChange={(e) => setSocials({ ...socials, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </section> */}

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate({ to: "/dashboard" })}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          {existing ? "Save changes" : "Create group"}
        </Button>
      </div>
    </form>
  );
}
