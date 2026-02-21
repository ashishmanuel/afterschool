'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/ui/Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

function getKidSession(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('kid_session');
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const isKidRoute = pathname.startsWith('/dashboard/kid');
  const [hasKidSession, setHasKidSession] = useState(false);
  const [checkedAuth, setCheckedAuth] = useState(false);

  // Check kid session reactively (not just once at render)
  useEffect(() => {
    setHasKidSession(getKidSession());
  }, []);

  // Redirect helper
  const redirectToLogin = useCallback(() => {
    window.location.replace('/login');
  }, []);

  // Main auth check: once loading completes, decide what to do
  useEffect(() => {
    if (!loading) {
      setCheckedAuth(true);
      if (!user && !getKidSession()) {
        redirectToLogin();
      }
    }
  }, [loading, user, redirectToLogin]);

  // Safety timeout: if loading stays true for 3 seconds, do a fresh auth check
  // This catches bfcache restorations where React state is stale
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading && !checkedAuth) {
        // Loading stuck — do a direct Supabase check
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user: freshUser } }) => {
          if (!freshUser && !getKidSession()) {
            redirectToLogin();
          }
          // If user exists, AuthContext will eventually catch up
        }).catch(() => {
          // Network error or Supabase down — redirect to be safe
          if (!getKidSession()) {
            redirectToLogin();
          }
        });
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [loading, checkedAuth, redirectToLogin]);

  // Handle bfcache restoration (browser back/forward button)
  // When a page is restored from bfcache, React state is frozen from the last visit.
  // The "pageshow" event with persisted=true tells us this happened.
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        // Page restored from bfcache — re-check auth immediately
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user: freshUser } }) => {
          if (!freshUser && !getKidSession()) {
            redirectToLogin();
          }
        }).catch(() => {
          if (!getKidSession()) {
            redirectToLogin();
          }
        });
      }
    }

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [redirectToLogin]);

  // Kid session on a kid route — skip waiting for auth, show simplified layout immediately
  if (isKidRoute && hasKidSession) {
    return (
      <div className="min-h-screen p-6 md:p-10 max-w-[1600px] mx-auto">
        {children}
      </div>
    );
  }

  // Still loading auth (for parent routes)
  if (loading && !checkedAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 flame-pulse">🔥</div>
          <p className="text-[var(--muted)] text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // No user and no kid session — redirecting
  if (!user && !hasKidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔑</div>
          <p className="text-[var(--muted)] text-sm">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-[280px] p-10 max-w-[1600px] transition-all">
        {children}
      </main>
    </div>
  );
}
