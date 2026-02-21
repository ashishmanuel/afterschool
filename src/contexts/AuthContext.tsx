'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Profile fetch wrapped in try/catch — NEVER blocks loading
  async function fetchProfile(userId: string) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      setProfile(data);
    } catch {
      // Profile fetch failed — don't block auth flow
      setProfile(null);
    }
  }

  async function refreshProfile() {
    if (user) {
      await fetchProfile(user.id);
    }
  }

  useEffect(() => {
    let mounted = true;

    // HARD SAFETY: loading MUST become false within 5 seconds, no matter what.
    // This is the absolute last resort — if getUser() hangs, if fetchProfile()
    // hangs, if onAuthStateChange never fires — this catches it all.
    const hardTimeout = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 5000);

    const getSession = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted) return;
        setUser(user);
        if (user) {
          await fetchProfile(user.id);
        }
      } catch {
        // Auth check failed — user stays null, profile stays null
      }
      if (mounted) {
        setLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        setUser(session?.user ?? null);
        if (session?.user) {
          // fetchProfile has its own try/catch — safe to await
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        if (mounted) {
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(hardTimeout);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    // Set loading to prevent dashboard flash on back-nav
    setLoading(true);
    setUser(null);
    setProfile(null);

    // Clear kid session from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kid_session');
    }

    // Wait for Supabase to fully clear the session/cookies
    try {
      await supabase.auth.signOut();
    } catch {
      // Sign out failed — redirect anyway
    }

    // Use replace() — removes dashboard from browser history
    window.location.replace('/login');
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
