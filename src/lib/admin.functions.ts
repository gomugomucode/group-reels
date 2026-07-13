import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error("Could not verify permissions");
  if (!data) throw new Error("Forbidden: admin access required");
}

/** Update a user's editable account details. Admin only. */
export const updateUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        username: z.string().trim().min(2, "Username must be at least 2 characters").max(80),
        email: z.string().trim().email("Enter a valid email"),
        teamName: z.string().trim().min(2, "Team name is required").max(80),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email: data.email,
    });
    if (authError) throw new Error(authError.message);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        username: data.username,
        email: data.email,
        team_name: data.teamName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);

    return { ok: true };
  });

/** Permanently delete a user account (auth + cascading data). Admin only. */
export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    if (data.userId === userId) {
      throw new Error("You cannot delete your own admin account");
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Send a password reset email to a user. Admin only. */
export const sendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().email() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
