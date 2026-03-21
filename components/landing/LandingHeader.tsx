"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-neutral-200/60 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center h-24 lg:h-28">
          {/* Logo centered */}
          <Link
            href="/"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center"
          >
            <img
              src="/images/Artisia_full.png"
              alt="Artisia"
              className="block h-24 sm:h-28 lg:h-32 w-auto object-contain"
            />
          </Link>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-3">
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
