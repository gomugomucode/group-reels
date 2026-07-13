import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Group = Database["public"]["Tables"]["groups"]["Row"];
export type VideoLink = Database["public"]["Tables"]["video_links"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export function useMyGroup(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-group", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("created_by", userId!)
        .order("created_at", { ascending: true })
        .maybeSingle();
      if (error) throw error;
      return data as Group | null;
    },
  });
}

export function useGroup(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId!)
        .maybeSingle();
      if (error) throw error;
      return data as Group | null;
    },
  });
}

export function useAllGroups() {
  return useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Group[];
    },
  });
}

export function useVideoLinks(groupId: string | undefined) {
  return useQuery({
    queryKey: ["video-links", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_links")
        .select("*")
        .eq("group_id", groupId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VideoLink[];
    },
  });
}

export function useAllVideoLinks() {
  return useQuery({
    queryKey: ["video-links-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_links")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VideoLink[];
    },
  });
}

export function useAllProfiles(enabled: boolean) {
  return useQuery({
    queryKey: ["profiles-all"],
    enabled,
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) throw error;
      const roleMap = new Map<string, string[]>();
      (roles ?? []).forEach((r) => {
        const list = roleMap.get(r.user_id) ?? [];
        list.push(r.role);
        roleMap.set(r.user_id, list);
      });
      return (profiles ?? []).map((p) => ({
        ...(p as ProfileRow),
        roles: roleMap.get(p.id) ?? [],
      }));
    },
  });
}

export type GroupMember = Database["public"]["Tables"]["group_members"]["Row"];

export function useGroupMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group-members", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("*")
        .eq("group_id", groupId!)
        .order("role", { ascending: false })
        .order("invited_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as GroupMember[];
    },
  });
}

export function useMyMemberships(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-memberships", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("*, group:groups(*)")
        .eq("user_id", userId!)
        .eq("invitation_status", "accepted");
      if (error) throw error;
      return data as (GroupMember & { group: Group })[];
    },
  });
}

export function usePendingInvitations(email: string | undefined) {
  return useQuery({
    queryKey: ["pending-invitations", email],
    enabled: !!email,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("*, group:groups(*)")
        .eq("email", email!.toLowerCase())
        .eq("invitation_status", "pending");
      if (error) throw error;
      return data as (GroupMember & { group: Group })[];
    },
  });
}

