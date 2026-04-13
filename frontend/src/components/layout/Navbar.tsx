"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { clsx } from "clsx";
import { BarChart2, Vault, ShieldCheck, Settings } from "lucide-react";

const navLinks = [
  { href: "/borrower",  label: "Borrow",   icon: Vault },
  { href: "/investor",  label: "Invest",   icon: BarChart2 },
  { href: "/admin",     label: "Admin",    icon: Settings },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-surface-border bg-surface/80 backdrop-blur-md">
      <div className="container mx-auto px-4 max-w-7xl flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 text-slate-100 hover:text-brand-400 transition-colors">
          <ShieldCheck className="w-6 h-6 text-brand-400" />
          <span className="font-bold text-base hidden sm:block">
            RWA <span className="text-brand-400">Collateral</span>
          </span>
          <span className="text-xs text-slate-500 hidden md:block mt-0.5">on HashKey Chain</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                pathname.startsWith(href)
                  ? "bg-brand-600/20 text-brand-400"
                  : "text-slate-400 hover:text-slate-200 hover:bg-surface-hover"
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:block">{label}</span>
            </Link>
          ))}
        </nav>

        {/* Wallet */}
        <ConnectButton
          accountStatus="avatar"
          chainStatus="icon"
          showBalance={false}
        />
      </div>
    </header>
  );
}
