'use client';

import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useRef } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/database';

// ─── Types ─────────────────────────────────────────────────────────────────
export type UserRole = 'client' | 'master' | 'owner';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  is_master: boolean;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  specialty: string | null;
  push_token: string | null;
  tos_accepted: boolean | null;
  tos_accepted_at: string | null;
  tos_version: string | null;
  onboarding_completed: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  stripe_customer_id: string | null;
  [key: string]: unknown;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  sessionError: AuthError | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role?: UserRole,
    tosAccepted?: boolean,
    tosVersion?: string
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function resolveUserRole(role: unknown): UserRole {
  return role === 'master' || role === 'owner' ? role : 'client';
}

function createFallbackProfile(authUser: User): Profile {
  const role = resolveUserRole(authUser.user_metadata?.role);
  const fullName =
    typeof authUser.user_metadata?.full_name === 'string'
      ? authUser.user_metadata.full_name
      : null;

  return {
    id: authUser.id,
    full_name: fullName,
    email: authUser.email ?? null,
    phone: authUser.phone ?? null,
    role,
    is_master: role === 'master',
    avatar_url: null,
    bio: null,
    city: null,
    specialty: null,
    push_token: null,
    tos_accepted: null,
    tos_accepted_at: null,
    tos_version: null,
    onboarding_completed: null,
    created_at: null,
    updated_at: null,
    stripe_customer_id: null,
  };
}

// ─── Provider ──────────────────────────────────────────────────────────────
// Stable module-level client — prevents lock contention from re-creation
const supabase = createClient();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<AuthError | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const userRef = useRef<User | null>(null);

  // ── Fetch profile from Supabase ──────────────────────────────────────
  const fetchProfile = useCallback(
    async (authUser: User) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (error) throw error;
        setProfile((data as unknown as Profile | null) ?? createFallbackProfile(authUser));
      } catch (err) {
        console.error('Error fetching profile:', err);
        setProfile((current) =>
          current?.id === authUser.id ? current : createFallbackProfile(authUser)
        );
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── Bootstrap: get initial session ───────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const clearAuthState = () => {
      if (!isMounted) return;
      sessionRef.current = null;
      userRef.current = null;
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);
    };

    const loadInitialSession = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (error) {
          console.error('Error getting initial session:', error);
          setSessionError(error);
        }

        if (!initialSession) {
          clearAuthState();
          return;
        }

        const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser();
        if (!isMounted) return;

        if (userError || !verifiedUser) {
          if (userError) {
            console.error('Error verifying initial user:', userError);
            setSessionError(userError);
          }
          clearAuthState();
          return;
        }

        const { data: { session: verifiedSession } } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (!verifiedSession) {
          clearAuthState();
          return;
        }

        sessionRef.current = { ...verifiedSession, user: verifiedUser };
        userRef.current = verifiedUser;
        setSession(sessionRef.current);
        setUser(verifiedUser);
        await fetchProfile(verifiedUser);
      } catch (err) {
        if (!isMounted) return;
        console.error('Error getting initial session:', err);
        clearAuthState();
      }
    };

    loadInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT' || !s?.user) {
        clearAuthState();
        setSessionError(null);
        return;
      }

      setSessionError(null);
      const isSameUser = userRef.current?.id === s.user.id;
      sessionRef.current = s;
      userRef.current = s.user;

      // Same-user token refresh / cross-tab sync: keep refs current but
      // do NOT touch React state. Setting state here would unmount the
      // dashboard subtree (loading spinner) and wipe page progress when
      // the user alt-tabs back into the site.
      if (isSameUser && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
        return;
      }

      setSession(s);
      setUser(s.user);

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        setLoading(true);
      }

      window.setTimeout(() => {
        if (isMounted) fetchProfile(s.user);
      }, 0);
    });

    // ── Visibility-based session refresh ────────────────────────────
    // When the tab is backgrounded the internal refresh timer can freeze,
    // causing the JWT to expire. Force a refresh whenever the tab comes back.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const currentSession = sessionRef.current;
        if (!currentSession) return;
        const expiresAt = currentSession.expires_at ? currentSession.expires_at * 1000 : 0;
        if (expiresAt && expiresAt - Date.now() > 60 * 1000) return;

        supabase.auth.refreshSession(currentSession).then(({ data: { session: refreshedSession }, error }) => {
          if (!isMounted) return;
          if (error) {
            console.warn('[Auth] visibility refresh error:', error.message);
            setSessionError(error);
            return;
          }

          if (!refreshedSession?.user) {
            return;
          }

          const isSameUser = userRef.current?.id === refreshedSession.user.id;
          sessionRef.current = refreshedSession;
          userRef.current = refreshedSession.user;
          setSessionError(null);
          if (isSameUser) {
            return;
          }
          setSession(refreshedSession);
          setUser(refreshedSession.user);
          window.setTimeout(() => {
            if (isMounted) fetchProfile(refreshedSession.user);
          }, 0);
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ── Periodic keep-alive (every 4 min) ──────────────────────────
    // Prevents token expiry even when the tab stays in foreground for hours.
    const keepAlive = setInterval(() => {
      supabase.auth.getSession();
    }, 4 * 60 * 1000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(keepAlive);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Realtime Profile Subscription ──────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`public:profiles:id=eq.${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          setProfile((current) => {
            if (!current || current.id !== payload.new.id) return current;
            return {
              ...current,
              ...(payload.new as Profile),
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // ── Auth actions ────────────────────────────────────────────────────
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole = 'client',
    tosAccepted = false,
    tosVersion = '1.0'
  ) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role },
        },
      });

      if (error) throw error;

      if (data.user) {
        await supabase
          .from('profiles')
          .update({
            role,
            is_master: role === 'master',
            full_name: fullName,
            tos_accepted: tosAccepted,
            tos_accepted_at: tosAccepted ? new Date().toISOString() : null,
            tos_version: tosVersion,
          })
          .eq('id', data.user.id);
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      if (user?.id) {
        await supabase.from('profiles').update({ push_token: null }).eq('id', user.id);
      }
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
    sessionRef.current = null;
    userRef.current = null;
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user logged in') };
    try {
      const { error } = await supabase.from('profiles').update(updates as Database['public']['Tables']['profiles']['Update']).eq('id', user.id);
      if (error) throw error;
      await fetchProfile(user);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        role: (profile?.role as UserRole | undefined) ?? (user ? resolveUserRole(user.user_metadata?.role) : null),
        loading,
        sessionError,
        signIn,
        signUp,
        signOut,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
