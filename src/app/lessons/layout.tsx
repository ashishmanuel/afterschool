'use client';

import Sidebar from '@/components/ui/Sidebar';
import { useAuth } from '@/contexts/AuthContext';

export default function LessonsLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-5xl flame-pulse">📚</div>
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
