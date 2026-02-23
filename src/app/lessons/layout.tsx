'use client';

import Sidebar from '@/components/ui/Sidebar';

// Note: No auth loading gate here — individual pages handle their own auth
// checks. Blocking the layout on auth loading caused the sidebar to get stuck
// showing a spinner whenever an auth refresh happened mid-session (e.g. when
// the vocabulary lesson called supabase.auth.getUser() on completion).
export default function LessonsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-[280px] p-10 max-w-[1600px] transition-all">
        {children}
      </main>
    </div>
  );
}
