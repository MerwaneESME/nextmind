"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-neutral-200/60 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <img src="/images/nextmind.png" alt="NextMind" className="h-8 w-auto" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors rounded-lg hover:bg-neutral-100"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="px-5 py-2 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-primary-400 to-primary-600 hover:opacity-90 transition-opacity shadow-sm"
            >
              S'inscrire
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-neutral-500 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 border-t border-neutral-100 pt-4 flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="px-4 py-2.5 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              className="px-4 py-2.5 text-sm font-semibold text-white text-center rounded-lg bg-gradient-to-r from-primary-400 to-primary-600"
            >
              S'inscrire
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
