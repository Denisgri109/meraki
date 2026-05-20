import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useRef } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { safeSupabaseFetch } from '../lib/supabaseApi';
import { Profile, UserRole } from '../types/database';
import { registerForPushNotificationsAsync } from '../services/notificationService';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    role: UserRole | null;
    loading: boolean;
    sessionError: AuthError | null;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signUp: (email: string, password: string, fullName: string, role?: UserRole, tosAccepted?: boolean, tosVersion?: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
    refreshProfile: () => Promise<void>;
    checkSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [sessionError, setSessionError] = useState<AuthError | null>(null);
    const isManualSignOut = useRef(false);

    // Function to check if session is valid and refresh if needed
    const checkSession = useCallback(async (): Promise<boolean> => {
        try {
            const { data: { session: currentSession }, error } = await supabase.auth.getSession();

            if (error) {
                console.error('Session check error:', error);
                setSessionError(error);
                return false;
            }

            if (!currentSession) {
                // No session means we're signed out
                if (session) {
                    // unexpected sign out
                    setSession(null);
                    setUser(null);
                    setProfile(null);
                }
                return false;
            }

            // Update session if it changed (e.g. refreshed)
            if (currentSession.access_token !== session?.access_token) {
                setSession(currentSession);
                setUser(currentSession.user);
            }

            return true;
        } catch (err) {
            console.error('Unexpected checkSession error:', err);
            return false;
        }
    }, [session]);

    useEffect(() => {
        // Safety timeout in case auth check hangs
        const timeout = setTimeout(() => {
            if (loading) {
                console.log('Auth check timed out, setting loading to false');
                setLoading(false);
            }
        }, 5000);

        // Get initial session
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error) {
                console.error('Error getting initial session:', error);
                setSessionError(error);
            }

            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setLoading(false);
            }
        }).catch((error) => {
            console.error('Error getting session:', error);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === 'SIGNED_OUT') {
                    setSession(null);
                    setUser(null);
                    setProfile(null);
                    setLoading(false);
                    setSessionError(null);
                } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    setLoading(true);
                    setSessionError(null);

                    if (session?.user) {
                        // Fetch profile first so we don't flash default routes
                        if (!profile || profile.id !== session.user.id) {
                            await fetchProfile(session.user.id);
                        }

                        setSession(session);
                        setUser(session.user);
                    } else {
                        setSession(session);
                        setUser(null);
                        setLoading(false);
                    }
                } else if (event === 'USER_UPDATED') {
                    setLoading(true);
                    if (session?.user) {
                        await fetchProfile(session.user.id);
                        setSession(session);
                        setUser(session.user);
                    } else {
                        setSession(session);
                        setUser(null);
                        setLoading(false);
                    }
                }
            }
        );

        return () => {
            clearTimeout(timeout);
            subscription.unsubscribe();
        };
    }, []);

    const fetchProfile = async (userId: string) => {
        try {
            const profilePromise = supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            const { data, error } = await safeSupabaseFetch(profilePromise as any, { timeout: 10000 });

            if (error) throw error;
            setProfile(data as Profile);

            // Register for push notifications
            registerForPushNotificationsAsync(userId);
        } catch (error) {
            console.error('Error fetching profile:', error);
            // Don't clear profile on error immediately to avoid flickering if it's just a network blip
        } finally {
            setLoading(false);
        }
    };

    const refreshProfile = async () => {
        if (user) {
            await fetchProfile(user.id);
        }
    };

    const signIn = async (email: string, password: string) => {
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
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
        tosAccepted: boolean = false,
        tosVersion: string = '1.0'
    ) => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        role: role,
                    },
                },
            });

            if (error) throw error;

            // Update the profile with the role if signup was successful
            if (data.user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        role,
                        is_master: role === 'master',
                        full_name: fullName,
                        tos_accepted: tosAccepted,
                        tos_accepted_at: tosAccepted ? new Date().toISOString() : null,
                        tos_version: tosVersion
                    })
                    .eq('id', data.user.id);

                if (profileError) {
                    console.error('Error updating profile role:', profileError);
                }
            }

            return { error: null };
        } catch (error) {
            return { error: error as Error };
        }
    };

    const signOut = async () => {
        try {
            if (user?.id) {
                // Remove push token so this device stops receiving this user's notifications
                await supabase
                    .from('profiles')
                    .update({ push_token: null })
                    .eq('id', user.id);
            }
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Error signing out:', error);
            // Force local cleanup even if API fails
        }
        setSession(null);
        setUser(null);
        setProfile(null);
    };

    const updateProfile = async (updates: Partial<Profile>) => {
        if (!user) return { error: new Error('No user logged in') };

        try {
            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id);

            if (error) throw error;

            // Refresh profile
            await fetchProfile(user.id);
            return { error: null };
        } catch (error) {
            return { error: error as Error };
        }
    };

    const value = {
        session,
        user,
        profile,
        role: profile?.role ?? null,
        loading,
        sessionError,
        signIn,
        signUp,
        signOut,
        updateProfile,
        refreshProfile,
        checkSession,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
