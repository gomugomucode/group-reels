-- Migration: Platforms & Social Accounts
-- Description: Sets up the core lookup for platforms, user social accounts, and authentication credentials.

-- 1. Create platforms lookup table
CREATE TABLE public.platforms (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  oauth_client_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial supported platforms
INSERT INTO public.platforms (id, name, is_active) VALUES
  ('youtube', 'YouTube', true),
  ('facebook', 'Facebook', true),
  ('instagram', 'Instagram', true),
  ('tiktok', 'TikTok', true),
  ('vimeo', 'Vimeo', true),
  ('linkedin', 'LinkedIn', true),
  ('twitter', 'Twitter/X', true),
  ('other', 'Other', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on platforms
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.platforms TO authenticated;
GRANT ALL ON public.platforms TO service_role;

-- Policies for platforms
CREATE POLICY "Platforms: select authenticated" ON public.platforms
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Platforms: admin write" ON public.platforms
  FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

-- Trigger for platforms updated_at
CREATE TRIGGER update_platforms_updated_at BEFORE UPDATE ON public.platforms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. Create social_accounts table
CREATE TABLE public.social_accounts (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_id TEXT NOT NULL REFERENCES public.platforms(id) ON DELETE RESTRICT,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  platform_account_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Indexes for social_accounts
CREATE INDEX idx_social_accounts_user ON public.social_accounts (user_id);
CREATE INDEX idx_social_accounts_platform ON public.social_accounts (platform_id);
CREATE UNIQUE INDEX idx_social_accounts_platform_external_active 
  ON public.social_accounts (platform_id, platform_account_id) 
  WHERE deleted_at IS NULL;

-- Enable RLS on social_accounts
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;

-- Policies for social_accounts
CREATE POLICY "Social Accounts: view own or admin" ON public.social_accounts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (SELECT public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Social Accounts: insert own" ON public.social_accounts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Social Accounts: update own or admin" ON public.social_accounts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR (SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK (user_id = auth.uid() OR (SELECT public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Social Accounts: delete own or admin" ON public.social_accounts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR (SELECT public.has_role(auth.uid(), 'admin')));

-- Trigger for social_accounts updated_at
CREATE TRIGGER update_social_accounts_updated_at BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3. Create api_credentials table
CREATE TABLE public.api_credentials (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  social_account_id UUID NOT NULL UNIQUE REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  token_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on api_credentials
ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_credentials TO authenticated;
GRANT ALL ON public.api_credentials TO service_role;

-- Helper to verify social account ownership
CREATE OR REPLACE FUNCTION public.owns_social_account(_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.social_accounts
    WHERE id = _account_id AND user_id = auth.uid() AND deleted_at IS NULL
  )
$$;

REVOKE ALL ON FUNCTION public.owns_social_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_social_account(uuid) TO authenticated;

-- Policies for api_credentials
CREATE POLICY "API Credentials: view own or admin" ON public.api_credentials
  FOR SELECT TO authenticated
  USING ((SELECT public.owns_social_account(social_account_id)) OR (SELECT public.has_role(auth.uid(), 'admin')));

CREATE POLICY "API Credentials: insert own" ON public.api_credentials
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.owns_social_account(social_account_id)));

CREATE POLICY "API Credentials: update own" ON public.api_credentials
  FOR UPDATE TO authenticated
  USING ((SELECT public.owns_social_account(social_account_id)))
  WITH CHECK ((SELECT public.owns_social_account(social_account_id)));

CREATE POLICY "API Credentials: delete own or admin" ON public.api_credentials
  FOR DELETE TO authenticated
  USING ((SELECT public.owns_social_account(social_account_id)) OR (SELECT public.has_role(auth.uid(), 'admin')));

-- Trigger for api_credentials updated_at
CREATE TRIGGER update_api_credentials_updated_at BEFORE UPDATE ON public.api_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
