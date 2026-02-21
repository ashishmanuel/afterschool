'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/ui/Sidebar';
import { useAuth } from '@/contexts/AuthContext';

function getKidSession(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('kid_session');
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const isKidRoute = pathname.startsWith('/dashboard/kid');
  const hasKidSession = getKidSession();
  const [timedOut, setTimedOut] = useState(false);

  // Safety timeout: if loading stays true for 3 seconds, force redirect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        setTimedOut(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    // Redirect if auth finished and no user, OR if loading timed out
    if ((!loading && !user && !hasKidSession) || (timedOut && !user && !hasKidSession)) {
      window.location.replace('/login');
    }
  }, [loading, user, hasKidSession, timedOut]);

  // Kid session on a kid route — skip waiting for auth, show simplified layout immediately
  if (isKidRoute && hasKidSession) {
    return (
      <div className="min-h-screen p-6 md:p-10 max-w-[1600px] mx-auto">
        {children}
      </div>
    );
  }

  // Still loading auth (for parent routes)
  if (loading) {
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
