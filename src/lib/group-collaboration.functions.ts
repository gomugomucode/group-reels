import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Helper: Assert that the caller is the owner of the group or an admin
async function assertGroupOwnerOrAdmin(supabaseAdmin: any, groupId: string, callerUserId: string) {
  // Check if admin
  const { data: isAdmin, error: adminErr } = await supabaseAdmin.rpc("has_role", {
    _user_id: callerUserId,
    _role: "admin",
  });
  if (adminErr) throw new Error("Could not verify permissions");
  if (isAdmin) return; // Admin bypass

  // Check if group creator (owner)
  const { data: group, error: groupErr } = await supabaseAdmin
    .from("groups")
    .select("created_by")
    .eq("id", groupId)
    .maybeSingle();

  if (groupErr || !group) throw new Error("Group not found");
  if (group.created_by !== callerUserId) {
    throw new Error("Forbidden: Only the group owner can perform this action");
  }
}

/** Invite a new collaborator by email */
export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ groupId: z.string().uuid(), email: z.string().trim().email() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await assertGroupOwnerOrAdmin(supabaseAdmin, data.groupId, userId);

    const email = data.email.toLowerCase().trim();

    // Check if user is already a member or has a pending/accepted invite
    const { data: existing, error: existErr } = await supabaseAdmin
      .from("group_members")
      .select("id, invitation_status")
      .eq("group_id", data.groupId)
      .eq("email", email)
      .maybeSingle();

    if (existErr) throw existErr;
    if (existing) {
      if (existing.invitation_status === "accepted") {
        throw new Error("User is already a member of this group");
      }
      // If invitation is pending or rejected, we can allow re-inviting by deleting or updating it.
      // Let's delete the old one first to create a fresh invitation.
      await supabaseAdmin.from("group_members").delete().eq("id", existing.id);
    }

    // Lookup existing profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    const { error } = await supabaseAdmin.from("group_members").insert({
      group_id: data.groupId,
      user_id: profile?.id || null, // null if unregistered
      email,
      role: "member",
      invitation_status: "pending",
    });

    if (error) throw error;
    return { ok: true };
  });

/** Cancel a pending invitation */
export const cancelInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ memberId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch the membership record
    const { data: member, error: fetchErr } = await supabaseAdmin
      .from("group_members")
      .select("group_id, invitation_status")
      .eq("id", data.memberId)
      .maybeSingle();

    if (fetchErr || !member) throw new Error("Invitation not found");
    if (member.invitation_status !== "pending") {
      throw new Error("Only pending invitations can be cancelled");
    }

    await assertGroupOwnerOrAdmin(supabaseAdmin, member.group_id, userId);

    const { error: deleteErr } = await supabaseAdmin
      .from("group_members")
      .delete()
      .eq("id", data.memberId);

    if (deleteErr) throw deleteErr;
    return { ok: true };
  });

/** Resend a pending invitation (updates updated_at / created_at timestamp) */
export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ memberId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member, error: fetchErr } = await supabaseAdmin
      .from("group_members")
      .select("group_id, invitation_status")
      .eq("id", data.memberId)
      .maybeSingle();

    if (fetchErr || !member) throw new Error("Invitation not found");
    if (member.invitation_status !== "pending") {
      throw new Error("Only pending invitations can be resent");
    }

    await assertGroupOwnerOrAdmin(supabaseAdmin, member.group_id, userId);

    const { error: updateErr } = await supabaseAdmin
      .from("group_members")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", data.memberId);

    if (updateErr) throw updateErr;
    return { ok: true };
  });

/** Accept a pending invitation */
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ memberId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member, error: fetchErr } = await supabaseAdmin
      .from("group_members")
      .select("email, invitation_status")
      .eq("id", data.memberId)
      .maybeSingle();

    if (fetchErr || !member) throw new Error("Invitation not found");
    if (member.invitation_status !== "pending") {
      throw new Error("This invitation is no longer pending");
    }

    // Verify current user's profile email matches the invitation email
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();

    if (!profile || profile.email.toLowerCase() !== member.email.toLowerCase()) {
      throw new Error("Unauthorized: Invitation email mismatch");
    }

    const { error: updateErr } = await supabaseAdmin
      .from("group_members")
      .update({
        user_id: userId,
        invitation_status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", data.memberId);

    if (updateErr) throw updateErr;
    return { ok: true };
  });

/** Reject a pending invitation */
export const rejectInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ memberId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member, error: fetchErr } = await supabaseAdmin
      .from("group_members")
      .select("email, invitation_status")
      .eq("id", data.memberId)
      .maybeSingle();

    if (fetchErr || !member) throw new Error("Invitation not found");
    if (member.invitation_status !== "pending") {
      throw new Error("This invitation is no longer pending");
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();

    if (!profile || profile.email.toLowerCase() !== member.email.toLowerCase()) {
      throw new Error("Unauthorized: Invitation email mismatch");
    }

    const { error: updateErr } = await supabaseAdmin
      .from("group_members")
      .update({ invitation_status: "rejected" })
      .eq("id", data.memberId);

    if (updateErr) throw updateErr;
    return { ok: true };
  });

/** Remove a collaborator from the group */
export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ memberId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member, error: fetchErr } = await supabaseAdmin
      .from("group_members")
      .select("group_id, role, user_id")
      .eq("id", data.memberId)
      .maybeSingle();

    if (fetchErr || !member) throw new Error("Collaborator not found");
    if (member.role === "owner") {
      throw new Error("The group owner cannot be removed");
    }

    await assertGroupOwnerOrAdmin(supabaseAdmin, member.group_id, userId);

    const { error: deleteErr } = await supabaseAdmin
      .from("group_members")
      .delete()
      .eq("id", data.memberId);

    if (deleteErr) throw deleteErr;
    return { ok: true };
  });

/** Transfer group ownership to a joined member */
export const transferOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ memberId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch the target collaborator details
    const { data: targetMember, error: fetchErr } = await supabaseAdmin
      .from("group_members")
      .select("group_id, user_id, invitation_status, role")
      .eq("id", data.memberId)
      .maybeSingle();

    if (fetchErr || !targetMember) throw new Error("Collaborator not found");
    if (targetMember.invitation_status !== "accepted" || !targetMember.user_id) {
      throw new Error("Ownership can only be transferred to accepted members with active accounts");
    }
    if (targetMember.role === "owner") {
      throw new Error("User is already the group owner");
    }

    // Verify caller is group owner or admin
    await assertGroupOwnerOrAdmin(supabaseAdmin, targetMember.group_id, userId);

    // Fetch the group to find the current owner user ID
    const { data: group } = await supabaseAdmin
      .from("groups")
      .select("created_by")
      .eq("id", targetMember.group_id)
      .maybeSingle();

    if (!group) throw new Error("Group not found");

    // Begin updates using service role functions (bypasses RLS)
    // Demote current owner to member (if they have a membership record)
    const { error: demoteErr } = await supabaseAdmin
      .from("group_members")
      .update({ role: "member" })
      .eq("group_id", targetMember.group_id)
      .eq("user_id", group.created_by);

    if (demoteErr) throw demoteErr;

    // Promote new owner
    const { error: promoteErr } = await supabaseAdmin
      .from("group_members")
      .update({ role: "owner" })
      .eq("id", data.memberId);

    if (promoteErr) throw promoteErr;

    // Update group creator pointer
    const { error: groupUpdateErr } = await supabaseAdmin
      .from("groups")
      .update({ created_by: targetMember.user_id })
      .eq("id", targetMember.group_id);

    if (groupUpdateErr) throw groupUpdateErr;

    return { ok: true };
  });
