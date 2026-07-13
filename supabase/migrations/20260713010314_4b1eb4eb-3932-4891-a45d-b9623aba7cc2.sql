
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.platform_type AS ENUM ('youtube', 'facebook', 'instagram', 'tiktok', 'vimeo', 'other');
CREATE TYPE public.link_status AS ENUM ('valid', 'invalid', 'pending');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  team_name TEXT,
  member_names TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Groups
CREATE TABLE public.groups (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name TEXT NOT NULL,
  member_names TEXT[] NOT NULL DEFAULT '{}',
  team_leader TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instagram TEXT,
  tiktok TEXT,
  facebook TEXT,
  youtube TEXT,
  linkedin TEXT,
  website TEXT,
  disabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Video links
CREATE TABLE public.video_links (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title TEXT,
  url TEXT NOT NULL,
  platform public.platform_type NOT NULL DEFAULT 'other',
  status public.link_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_links TO authenticated;
GRANT ALL ON public.video_links TO service_role;
ALTER TABLE public.video_links ENABLE ROW LEVEL SECURITY;

-- Analytics
CREATE TABLE public.analytics (
  group_id UUID NOT NULL PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
  total_views INTEGER NOT NULL DEFAULT 0,
  platform_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics TO authenticated;
GRANT ALL ON public.analytics TO service_role;
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user the group owner?
CREATE OR REPLACE FUNCTION public.owns_group(_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = _group_id AND created_by = auth.uid()
  )
$$;

-- Profiles policies
CREATE POLICY "Profiles: view own or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Profiles: insert own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "Profiles: update own or admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Profiles: delete admin" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies (admin manages; users can read own)
CREATE POLICY "Roles: view own or admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: admin insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: admin update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: admin delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Groups policies
CREATE POLICY "Groups: view all authenticated" ON public.groups
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Groups: insert own" ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Groups: update own or admin" ON public.groups
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Groups: delete own or admin" ON public.groups
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Video links policies
CREATE POLICY "Videos: view all authenticated" ON public.video_links
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Videos: insert own group or admin" ON public.video_links
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_group(group_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Videos: update own group or admin" ON public.video_links
  FOR UPDATE TO authenticated
  USING (public.owns_group(group_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.owns_group(group_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Videos: delete own group or admin" ON public.video_links
  FOR DELETE TO authenticated
  USING (public.owns_group(group_id) OR public.has_role(auth.uid(), 'admin'));

-- Analytics policies
CREATE POLICY "Analytics: view all authenticated" ON public.analytics
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Analytics: insert own group or admin" ON public.analytics
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_group(group_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Analytics: update own group or admin" ON public.analytics
  FOR UPDATE TO authenticated
  USING (public.owns_group(group_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.owns_group(group_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Analytics: delete own group or admin" ON public.analytics
  FOR DELETE TO authenticated
  USING (public.owns_group(group_id) OR public.has_role(auth.uid(), 'admin'));

-- updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_video_links_updated_at BEFORE UPDATE ON public.video_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- New user signup: create profile + default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, team_name, member_names)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'team_name',
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'member_names')),
      '{}'::text[]
    )
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
