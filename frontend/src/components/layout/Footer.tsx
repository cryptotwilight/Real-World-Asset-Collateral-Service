export function Footer() {
  return (
    <footer className="border-t border-surface-border mt-16">
      <div className="container mx-auto px-4 max-w-7xl py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          RWA Collateral Service — Built on{" "}
          <a href="https://www.hashfans.io/" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">
            HashKey Chain
          </a>
        </p>
        <p className="text-xs text-slate-600">
          Smart contracts are unaudited. Use at your own risk.
        </p>
      </div>
    </footer>
  );
}
