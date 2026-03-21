import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center h-24">
            <Link
              href="/"
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center"
            >
              <img
                src="/images/Artisia_full.png"
                alt="Artisia"
                className="block h-24 sm:h-28 w-auto object-contain"
              />
            </Link>
            <div className="ml-auto flex items-center gap-4">
              <Link href="/login" className="text-gray-700 hover:text-gray-900 font-medium">
                Connexion
              </Link>
              <Link href="/register">
                <Button>S&apos;inscrire</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-gray-900 text-white py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <Link href="/" className="flex items-center mb-4">
                <img src="/images/artisia_cadre.png" alt="Artisia" className="h-8 w-auto" />
              </Link>
              <p className="text-gray-400 text-sm">
                Tout sur le BTP pour mieux vous accompagner.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produit</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/fonctionnalites" className="text-white hover:opacity-90">Fonctionnalités</Link>
                </li>
                <li>
                  <Link href="/faq" className="text-white hover:opacity-90">FAQ</Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Entreprise</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/a-propos" className="text-white hover:opacity-90">À propos</Link>
                </li>
                <li>
                  <Link href="/contact" className="text-white hover:opacity-90">Contact</Link>
                </li>
                <li>
                  <Link href="/mentions-legales" className="text-white hover:opacity-90">Mentions légales</Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/assistance" className="text-white hover:opacity-90">Assistance</Link>
                </li>
                <li>
                  <Link href="/securite" className="text-white hover:opacity-90">Sécurité</Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2024 ARTISIA. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
