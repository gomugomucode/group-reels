-- 1. Create group_members table
CREATE TABLE public.group_members (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invitation_status TEXT NOT NULL CHECK (invitation_status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, email)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS group_members_group_id_idx ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS group_members_user_id_idx ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS group_members_email_idx ON public.group_members(email);

-- Enable RLS
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;

-- Revoke function privileges for security-definer triggers
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 2. Add created_by to video_links
ALTER TABLE public.video_links ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill existing groups to group_members and video_links
INSERT INTO public.group_members (group_id, user_id, email, role, invitation_status, joined_at)
SELECT g.id, g.created_by, p.email, 'owner', 'accepted', g.created_at
FROM public.groups g
JOIN public.profiles p ON p.id = g.created_by
ON CONFLICT (group_id, email) DO NOTHING;

UPDATE public.video_links vl
SET created_by = g.created_by
FROM public.groups g
WHERE vl.group_id = g.id;

-- Set default value for future inserts and make it NOT NULL
ALTER TABLE public.video_links ALTER COLUMN created_by SET DEFAULT auth.uid();
-- Allow NULL transiently or force NOT NULL? Let's make it NOT NULL as backfill is done.
ALTER TABLE public.video_links ALTER COLUMN created_by SET NOT NULL;

-- 3. Triggers for group_members updated_at
CREATE TRIGGER update_group_members_updated_at BEFORE UPDATE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to automatically add owner upon new group insertion
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, email, role, invitation_status, joined_at)
  VALUES (
    NEW.id,
    NEW.created_by,
    (SELECT email FROM public.profiles WHERE id = NEW.created_by),
    'owner',
    'accepted',
    now()
  )
  ON CONFLICT (group_id, email) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_group_created
  AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_group();

-- Redefine handle_new_user to link any pending invitations matching the new user's email
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
  
  -- Link user_id to any pending invitations matching email
  UPDATE public.group_members
  SET user_id = NEW.id
  WHERE lower(email) = lower(NEW.email) AND user_id IS NULL;
  
  RETURN NEW;
END;
$$;

-- 4. RLS Policies Updates

-- group_members policies
CREATE POLICY "Members: view own or group members" ON public.group_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR 
    email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR 
    public.owns_group(group_id) OR 
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Members: insert owners/admins" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_group(group_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members: update owners/admins or self status" ON public.group_members
  FOR UPDATE TO authenticated
  USING (
    public.owns_group(group_id) OR 
    public.has_role(auth.uid(), 'admin') OR 
    user_id = auth.uid() OR 
    email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    public.owns_group(group_id) OR 
    public.has_role(auth.uid(), 'admin') OR 
    user_id = auth.uid() OR 
    email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Members: delete owners/admins" ON public.group_members
  FOR DELETE TO authenticated
  USING (public.owns_group(group_id) OR public.has_role(auth.uid(), 'admin'));

-- Tighten groups SELECT policy
DROP POLICY IF EXISTS "Groups: view all authenticated" ON public.groups;
CREATE POLICY "Groups: view own, joined, or admin" ON public.groups
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid() OR 
    public.has_role(auth.uid(), 'admin') OR 
    EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = id AND user_id = auth.uid() AND invitation_status = 'accepted'
    )
  );

-- Tighten video_links policies
DROP POLICY IF EXISTS "Videos: view all authenticated" ON public.video_links;
CREATE POLICY "Videos: view own, joined, or admin" ON public.video_links
  FOR SELECT TO authenticated
  USING (
    public.owns_group(group_id) OR 
    public.has_role(auth.uid(), 'admin') OR 
    EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = video_links.group_id AND user_id = auth.uid() AND invitation_status = 'accepted'
    )
  );

DROP POLICY IF EXISTS "Videos: insert own group or admin" ON public.video_links;
CREATE POLICY "Videos: insert group member or admin" ON public.video_links
  FOR INSERT TO authenticated
  WITH CHECK (
    public.owns_group(group_id) OR 
    public.has_role(auth.uid(), 'admin') OR 
    EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = video_links.group_id AND user_id = auth.uid() AND invitation_status = 'accepted'
    )
  );

DROP POLICY IF EXISTS "Videos: update own group or admin" ON public.video_links;
CREATE POLICY "Videos: update link creator, group owner, or admin" ON public.video_links
  FOR UPDATE TO authenticated
  USING (
    public.owns_group(group_id) OR 
    public.has_role(auth.uid(), 'admin') OR 
    (created_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = video_links.group_id AND user_id = auth.uid() AND invitation_status = 'accepted'
    ))
  );

DROP POLICY IF EXISTS "Videos: delete own group or admin" ON public.video_links;
CREATE POLICY "Videos: delete link creator, group owner, or admin" ON public.video_links
  FOR DELETE TO authenticated
  USING (
    public.owns_group(group_id) OR 
    public.has_role(auth.uid(), 'admin') OR 
    (created_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = video_links.group_id AND user_id = auth.uid() AND invitation_status = 'accepted'
    ))
  );

-- Tighten analytics policies
DROP POLICY IF EXISTS "Analytics: view all authenticated" ON public.analytics;
CREATE POLICY "Analytics: view own, joined, or admin" ON public.analytics
  FOR SELECT TO authenticated
  USING (
    public.owns_group(group_id) OR 
    public.has_role(auth.uid(), 'admin') OR 
    EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = analytics.group_id AND user_id = auth.uid() AND invitation_status = 'accepted'
    )
  );
