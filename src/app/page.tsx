import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <h1 className="font-mono text-2xl font-bold gradient-text">After School</h1>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2 rounded-lg text-sm font-semibold text-[#0f0f0f]"
            style={{ background: 'linear-gradient(135deg, #FF6B6B, #FFD93D)' }}
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-8 pt-20 pb-32">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/60 mb-8">
            <span className="flame-pulse">🔥</span>
            Gamified learning for ages 5-8
          </div>
          <h2 className="font-mono text-5xl lg:text-7xl font-bold text-white leading-tight mb-6">
            Make learning
            <br />
            <span className="gradient-text">their favorite</span>
            <br />
            part of the day
          </h2>
          <p className="text-lg text-white/50 max-w-xl mb-10 leading-relaxed">
            Activity rings, streaks, and interactive lessons that turn homework
            into a game kids actually want to play. Parents get visibility,
            kids get agency.
          </p>
          <div className="flex gap-4">
            <Link
              href="/signup"
              className="px-8 py-4 rounded-xl font-bold text-[#0f0f0f] hover:-translate-y-1 hover:shadow-xl transition-all"
              style={{ background: 'linear-gradient(135deg, #FF6B6B, #FFD93D)' }}
            >
              Start Free Trial
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 rounded-xl font-bold text-white bg-white/10 hover:bg-white/15 transition-all"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-8 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: '⭕',
              title: 'Activity Rings',
              desc: 'Apple Watch-inspired rings for Math, Reading, and Chores. Kids see progress fill up in real-time.',
            },
            {
              icon: '🔥',
              title: 'Streaks & Points',
              desc: 'Daily streaks and points keep kids motivated. Badges and celebrations reward consistency.',
            },
            {
              icon: '📚',
              title: 'Interactive Lessons',
              desc: 'Story-driven lessons with practice problems, instant feedback, and confetti celebrations.',
            },
            {
              icon: '👨‍👩‍👧',
              title: 'Parent Dashboard',
              desc: "See all your children's progress at a glance. Set goals, view reports, and manage accounts.",
            },
            {
              icon: '🧒',
              title: 'Kid Dashboard',
              desc: 'Colorful, fun interface designed for ages 5-8. Large buttons, clear progress, and lots of encouragement.',
            },
            {
              icon: '🎯',
              title: 'SAT Foundations',
              desc: 'Start building SAT-ready skills from elementary school with age-appropriate reading and math prep.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:-translate-y-1 hover:border-white/20 transition-all"
            >
              <span className="text-4xl block mb-4">{f.icon}</span>
              <h3 className="font-mono text-lg font-bold text-white mb-2">{f.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-8 pb-20">
        <div
          className="rounded-3xl p-12 md:p-20 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(255, 107, 107, 0.15), rgba(255, 217, 61, 0.15))' }}
        >
          <h2 className="font-mono text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to get started?
          </h2>
          <p className="text-white/50 mb-8 max-w-md mx-auto">
            Create your family account in 30 seconds and start tracking your
            {"kids'"} learning today.
          </p>
          <Link
            href="/signup"
            className="inline-block px-10 py-4 rounded-xl font-bold text-[#0f0f0f] text-lg hover:-translate-y-1 hover:shadow-xl transition-all"
            style={{ background: 'linear-gradient(135deg, #FF6B6B, #FFD93D)' }}
          >
            Create Free Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-8 py-8 border-t border-white/10">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm font-bold gradient-text">After School</span>
          <p className="text-white/30 text-xs">
            Building great learners, one day at a time.
          </p>
        </div>
      </footer>
    </div>
  );
}
