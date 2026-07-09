import Link from "next/link";
import SessionRedirect from "./SessionRedirect";

// Server-rendered landing page: all content ships as ready HTML so it shows
// instantly even on slow connections where the JS bundle is delayed. Buttons
// are plain links (no JS needed). SessionRedirect is a tiny client child that
// only redirects already-logged-in visitors once JS loads.
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <SessionRedirect />

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <div className="text-2xl font-bold tracking-tight">
          duel<span className="text-red-500">.</span>dev
        </div>
        <Link
          href="/auth"
          className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
        >
          Log in
        </Link>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
        <div className="inline-block bg-red-600/10 border border-red-600/20 text-red-400 text-xs font-medium px-3 py-1 rounded-full mb-6">
          Free · 5,000 DLC to start
        </div>

        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6 max-w-2xl leading-tight">
          Challenge a<br />
          <span className="text-red-500">developer</span>
        </h1>

        <p className="text-gray-400 text-lg sm:text-xl max-w-xl mb-10 leading-relaxed">
          Solve one problem against the clock. Whoever&apos;s faster takes the stake. Compete with friends or strangers.
        </p>

        <Link
          href="/auth"
          className="bg-red-600 hover:bg-red-700 text-white text-lg font-semibold px-10 py-4 rounded-2xl transition-colors shadow-lg shadow-red-600/20 mb-4"
        >
          Start for free
        </Link>
        <p className="text-gray-600 text-sm">Sign up in 30 seconds</p>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 max-w-3xl w-full">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left">
            <div className="text-2xl mb-3">⚡</div>
            <div className="font-semibold mb-1">Timed duels</div>
            <div className="text-gray-400 text-sm">Solve problems faster than your opponent. Speed and clean code win.</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left">
            <div className="text-2xl mb-3">🏆</div>
            <div className="font-semibold mb-1">Stake to win</div>
            <div className="text-gray-400 text-sm">Wager DLC or a real-world item. The winner takes it all.</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left">
            <div className="text-2xl mb-3">🎯</div>
            <div className="font-semibold mb-1">Any language</div>
            <div className="text-gray-400 text-sm">Python, JavaScript, C++, Java — pick your language and compete.</div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-gray-700 text-xs px-6">
        DLC is an in-game virtual currency with no real monetary value. Duels are for entertainment and are not gambling for money.
      </footer>
    </div>
  );
}
