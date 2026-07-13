import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  username: string;
  email: string;
  team_name: string | null;
  member_names: string[];
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadDetails(userId: string) {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, email, team_name, member_names")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  return { profile: profile as Profile | null, isAdmin };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const applyUser = async (nextSession: Session | null) => {
    setSession(nextSession);
    if (nextSession?.user) {
      const { profile, isAdmin } = await loadDetails(nextSession.user.id);
      setProfile(profile);
      setIsAdmin(isAdmin);
    } else {
      setProfile(null);
      setIsAdmin(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) void applyUser(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED"
      ) {
        return;
      }
      // Defer Supabase calls out of the callback to avoid deadlocks.
      setTimeout(() => {
        if (active) void applyUser(nextSession);
      }, 0);
      router.invalidate();
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    await applyUser(data.session);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        isAdmin,
        loading,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
