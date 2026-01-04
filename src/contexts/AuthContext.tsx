'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = getSupabase();

    useEffect(() => {
        // Get initial session with timeout to prevent indefinite hanging
        const getSessionWithTimeout = async () => {
            console.log('[Auth] Starting session check...');
            try {
                const timeoutPromise = new Promise<null>((_, reject) =>
                    setTimeout(() => reject(new Error('Session timeout')), 5000)
                );
                console.log('[Auth] Calling getSession...');
                const sessionPromise = supabase.auth.getSession();

                const result = await Promise.race([sessionPromise, timeoutPromise]);
                console.log('[Auth] getSession completed:', result);
                if (result && 'data' in result) {
                    setSession(result.data.session);
                    setUser(result.data.session?.user ?? null);
                }
            } catch (error) {
                console.warn('[Auth] Session check timed out or failed:', error);
                // Assume no session on error/timeout
                setSession(null);
                setUser(null);
            } finally {
                console.log('[Auth] Setting loading to false');
                setLoading(false);
            }
        };

        getSessionWithTimeout();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, [supabase]);

    const signUp = async (email: string, password: string, displayName?: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { display_name: displayName }
            }
        });
        return { error: error as Error | null };
    };

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error as Error | null };
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
