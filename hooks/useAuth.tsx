"use client";

import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import type { User, UserRole } from "@/types";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  siret: string | null;
  user_type: "pro" | "client";
  avatar_url: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  company_description?: string | null;
  company_website?: string | null;
  public_portfolio_enabled?: boolean | null;
  preferences?: {
    email_notifications?: boolean;
    project_alerts?: boolean;
    message_alerts?: boolean;
  } | null;
};

const PROFILE_FIELDS =
  "id,email,full_name,phone,company_name,siret,user_type,avatar_url,address,city,postal_code,company_description,company_website,public_portfolio_enabled,preferences";

const PENDING_PROFILE_KEY = "nextmind_pending_profile";

const loadPendingProfile = () => {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(PENDING_PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Partial<Profile>;
  } catch {
    return null;
  }
};

const clearPendingProfile = () => {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(PENDING_PROFILE_KEY);
};

export const savePendingProfile = (data: Partial<Profile>) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(data));
};

export const mapUserTypeToRole = (userType: Profile["user_type"]): UserRole =>
  userType === "pro" ? "professionnel" : "particulier";

export const mapRoleToUserType = (role: UserRole): Profile["user_type"] =>
  role === "professionnel" ? "pro" : "client";

const toUser = (profile: Profile, fallbackEmail?: string | null): User => {
  const email = profile.email ?? fallbackEmail ?? "";
  const name = profile.full_name || profile.company_name || email || "Utilisateur";
  return {
    id: profile.id,
    email,
    name,
    role: mapUserTypeToRole(profile.user_type),
    createdAt: new Date().toISOString(),
  };
};

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  user: User | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, email?: string | null) => {
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_FIELDS)
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      return { profile: null, error };
    }

    if (data) {
      return { profile: data as Profile, error: null };
    }

    const fallback = {
      id: userId,
      email: email ?? null,
      user_type: "client" as const,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("profiles")
      .insert(fallback)
      .select(PROFILE_FIELDS)
      .maybeSingle();

    if (insertError) {
      return { profile: null, error: insertError };
    }

    return { profile: inserted as Profile, error: null };
  };

  const applyPendingProfile = async (userId: string, email?: string | null) => {
    const pending = loadPendingProfile();
    if (!pending) return null;
    const { data, error } = await supabase
      .from("profiles")
      .upsert({ id: userId, email: email ?? null, ...pending }, { onConflict: "id" })
      .select(PROFILE_FIELDS)
      .maybeSingle();
    if (!error) clearPendingProfile();
    return { data: (data as Profile | null) ?? null, error };
  };

  useEffect(() => {
    let active = true;

    const syncSession = (newSession: Session | null) => {
      if (!active) return;
      setSession(newSession);
      if (!newSession?.user?.id) {
        setProfile(null);
        return;
      }
      const user = newSession.user;
      void (async () => {
        try {
          const pendingResult = await applyPendingProfile(user.id, user.email);
          if (!active) return;
          if (pendingResult?.data) {
            setProfile(pendingResult.data);
            return;
          }
          const result = await fetchProfile(user.id, user.email);
          if (!active) return;
          setProfile(result.profile);
        } catch (error) {
          if (active) {
            // eslint-disable-next-line no-console
            console.error("Profile sync failed", error);
            setProfile(null);
          }
        }
      })();
    };

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        syncSession(data.session ?? null);
      } catch (error) {
        if (active) {
          // eslint-disable-next-line no-console
          console.error("Auth init failed", error);
          setSession(null);
          setProfile(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      try {
        syncSession(newSession);
      } catch (error) {
        if (active) {
          // eslint-disable-next-line no-console
          console.error("Auth change failed", error);
          setSession(null);
          setProfile(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const user = useMemo(() => {
    if (profile) {
      return toUser(profile, session?.user.email);
    }
    if (session?.user?.id) {
      const email = session.user.email ?? "";
      return {
        id: session.user.id,
        email,
        name: email || "Utilisateur",
        role: "particulier" as UserRole,
        createdAt: new Date().toISOString(),
      };
    }
    return null;
  }, [profile, session]);

  const value = useMemo(
    () => ({
      session,
      profile,
      user,
      loading,
      refreshProfile: async () => {
        if (!session?.user?.id) return;
        const result = await fetchProfile(session.user.id, session.user.email);
        setProfile(result.profile);
      },
    }),
    [session, profile, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
