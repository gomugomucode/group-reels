import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function buildTikTokRedirectUri() {
  const origin = process.env.APP_URL || process.env.VITE_PUBLIC_SITE_URL || process.env.PUBLIC_APP_URL || "http://localhost:3000";
  return `${origin.replace(/\/$/, "")}/settings/integrations`;
}

function getServerTikTokConfig() {
  const { loadEnv } = require("@/lib/env.server") as typeof import("@/lib/env.server");
  loadEnv();

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI || buildTikTokRedirectUri();

  return { clientKey, clientSecret, redirectUri };
}

async function getActiveTikTokAccount(supabaseAdmin: any, userId: string) {
  const { data: account, error } = await supabaseAdmin
    .from("social_accounts")
    .select("id, user_id, platform_account_id, username, display_name, avatar_url, is_active, deleted_at")
    .eq("user_id", userId)
    .eq("platform_id", "tiktok")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!account) return null;

  const { data: credentials, error: credError } = await supabaseAdmin
    .from("api_credentials")
    .select("access_token, refresh_token, expires_at, scopes, token_type")
    .eq("social_account_id", account.id)
    .maybeSingle();

  if (credError) throw credError;

  return { account, credentials };
}

async function refreshTikTokAccessToken(supabaseAdmin: any, accountId: string, refreshToken: string) {
  const { clientKey, clientSecret } = getServerTikTokConfig();

  if (!clientKey || !clientSecret) {
    throw new Error("TikTok OAuth is not configured on the server");
  }

  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as any;

  if (!response.ok || payload.error || !payload.access_token || !payload.refresh_token) {
    const errText = payload.error_description || payload.error || `TikTok refresh failed with HTTP ${response.status}`;
    throw new Error(errText);
  }

  const expiresAt = new Date(Date.now() + Number(payload.expires_in || 86400) * 1000).toISOString();

  const db = supabaseAdmin as any;
  const { error: upsertError } = await db
    .from("api_credentials")
    .upsert(
      {
        social_account_id: accountId,
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
        expires_at: expiresAt,
        scopes: Array.isArray(payload.scope) ? payload.scope : String(payload.scope || "").split(",").filter(Boolean),
        token_type: payload.token_type || "Bearer",
      },
      { onConflict: "social_account_id" },
    );

  if (upsertError) throw upsertError;

  return { accessToken: payload.access_token, refreshToken: payload.refresh_token, expiresAt };
}

async function ensureValidTikTokAccessToken(supabaseAdmin: any, userId: string) {
  const accountDetails = await getActiveTikTokAccount(supabaseAdmin, userId);
  if (!accountDetails?.account || !accountDetails.credentials?.refresh_token) {
    return null;
  }

  const expiresAt = accountDetails.credentials.expires_at ? new Date(accountDetails.credentials.expires_at) : null;
  const needsRefresh = !expiresAt || expiresAt.getTime() <= Date.now() + 60_000;

  if (!needsRefresh) {
    return accountDetails.credentials.access_token as string;
  }

  const refreshed = await refreshTikTokAccessToken(
    supabaseAdmin,
    accountDetails.account.id,
    accountDetails.credentials.refresh_token,
  );

  return refreshed.accessToken;
}

export const startTikTokOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({}).parse(input))
  .handler(async ({ context }) => {
    const { userId } = context;
    const { clientKey, redirectUri } = getServerTikTokConfig();

    if (!clientKey) {
      throw new Error("TikTok client key is not configured on the server");
    }

    const state = crypto.randomUUID();
    const params = new URLSearchParams({
      client_key: clientKey,
      response_type: "code",
      scope: "user.info.basic,video.list,video.analytics",
      redirect_uri: redirectUri,
      state,
    });

    return {
      ok: true,
      authUrl: `https://www.tiktok.com/auth/authorize?${params.toString()}`,
      state,
      userId,
    };
  });

export const completeTikTokOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z.string().min(1),
        state: z.string().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { clientKey, clientSecret, redirectUri } = getServerTikTokConfig();

    if (!clientKey || !clientSecret) {
      throw new Error("TikTok OAuth is not configured on the server");
    }

    const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code: data.code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as any;

    if (!response.ok || payload.error || !payload.access_token || !payload.refresh_token || !payload.open_id) {
      const errText = payload.error_description || payload.error || `TikTok OAuth failed with HTTP ${response.status}`;
      throw new Error(errText);
    }

    const profileResponse = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,username,display_name,avatar_url",
      {
        headers: {
          Authorization: `Bearer ${payload.access_token}`,
          Accept: "application/json",
        },
      },
    );

    const profilePayload = (await profileResponse.json().catch(() => ({}))) as any;
    const profileData = profilePayload?.data?.user || profilePayload?.data || {};

    const connectedUserId = profileData.open_id || payload.open_id;
    const username = profileData.username || connectedUserId;
    const displayName = profileData.display_name || username;
    const avatarUrl = profileData.avatar_url || null;
    const expiresAt = new Date(Date.now() + Number(payload.expires_in || 86400) * 1000).toISOString();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const existingAccount = await db
      .from("social_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("platform_id", "tiktok")
      .is("deleted_at", null)
      .maybeSingle();

    let accountId = existingAccount?.data?.id;

    if (accountId) {
      const { error: updateError } = await db
        .from("social_accounts")
        .update({
          username,
          display_name: displayName,
          avatar_url: avatarUrl,
          platform_account_id: connectedUserId,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId);

      if (updateError) throw updateError;
    } else {
      const { data: inserted, error: insertError } = await db
        .from("social_accounts")
        .insert({
          user_id: userId,
          platform_id: "tiktok",
          username,
          display_name: displayName,
          avatar_url: avatarUrl,
          platform_account_id: connectedUserId,
          is_active: true,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      accountId = inserted.id;
    }

    const { error: credentialError } = await db
      .from("api_credentials")
      .upsert(
        {
          social_account_id: accountId,
          access_token: payload.access_token,
          refresh_token: payload.refresh_token,
          expires_at: expiresAt,
          scopes: Array.isArray(payload.scope) ? payload.scope : String(payload.scope || "").split(",").filter(Boolean),
          token_type: payload.token_type || "Bearer",
        },
        { onConflict: "social_account_id" },
      );

    if (credentialError) throw credentialError;

    return {
      ok: true,
      connected: true,
      provider: "tiktok",
      username,
    };
  });

export const disconnectTikTok = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({}).parse(input))
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: account, error: accountError } = await db
      .from("social_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("platform_id", "tiktok")
      .is("deleted_at", null)
      .maybeSingle();

    if (accountError) throw accountError;
    if (!account) return { ok: true, disconnected: false };

    const { error: removeAccountError } = await db
      .from("social_accounts")
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    if (removeAccountError) throw removeAccountError;

    await db.from("api_credentials").delete().eq("social_account_id", account.id);

    return { ok: true, disconnected: true };
  });

export async function getTikTokAccessTokenForUser(supabaseAdmin: any, userId: string) {
  return ensureValidTikTokAccessToken(supabaseAdmin, userId);
}

export { ensureValidTikTokAccessToken, getActiveTikTokAccount };
