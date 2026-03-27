export default function HomePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
          Cohold – Collaborative fractional real estate investing
        </h1>
        <p className="text-slate-600">
          Invest in vetted properties, track your portfolio in real-time, and
          manage multi-currency wallets with institutional-grade security.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <a
            href="/signup"
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Create account
          </a>
          <a
            href="/login"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Login
          </a>
        </div>
      </div>
    </main>
  );
}
