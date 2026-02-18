import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ArrowRight, CheckCircle, Users, FileText, Bot, Shield } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <img
                src="/images/nextmind.png"
                alt="NextMind"
                className="h-8 w-auto"
              />
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-gray-700 hover:text-gray-900 font-medium">
                Connexion
              </Link>
              <Link href="/register">
                <Button>S'inscrire</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Tout sur le BTP pour mieux vous accompagner
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Plateforme intelligente mettant en relation particuliers et professionnels du BTP,
            avec un assistant IA pour vous guider à chaque étape de votre projet.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg">
                Commencer maintenant
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg">
                Se connecter
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Comment ça fonctionne
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Une solution complète pour simplifier vos projets BTP
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <Bot className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Assistant IA intelligent
              </h3>
              <p className="text-gray-600">
                Créez vos projets, générez des devis et obtenez des conseils personnalisés
                grâce à notre assistant IA spécialisé dans le BTP.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Mise en relation facilitée
              </h3>
              <p className="text-gray-600">
                Trouvez rapidement les professionnels adaptés à votre projet et comparez
                les devis en toute transparence.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Gestion complète
              </h3>
              <p className="text-gray-600">
                Suivez l'avancement de vos projets, gérez vos devis et factures,
                tout au même endroit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* For Particuliers */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Pour les particuliers
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                Simplifiez la réalisation de vos projets BTP avec un assistant dédié
                qui vous guide de A à Z.
              </p>
              <ul className="space-y-4">
                {[
                  "Création de projets via l'assistant IA",
                  "Recherche de professionnels adaptés",
                  "Comparaison de devis en temps réel",
                  "Suivi de l'avancement de vos projets",
                  "Messagerie intégrée avec les professionnels",
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-primary-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gray-50 rounded-lg p-8 border border-gray-200">
              <div className="text-center">
                <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Bot className="w-12 h-12 text-primary-600" />
                </div>
                <p className="text-xl font-medium text-gray-900 mb-4">
                  Commencez à créer votre projet
                </p>
                <p className="text-gray-600">
                  Décrivez votre projet à notre assistant IA et obtenez des recommandations
                  personnalisées en quelques minutes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For Professionnels */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="bg-white rounded-lg p-8 border border-gray-200 order-2 lg:order-1">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Dashboard professionnel
                </h3>
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Projets en cours</p>
                    <p className="text-2xl font-bold text-gray-900">12</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Devis à faire</p>
                    <p className="text-2xl font-bold text-gray-900">5</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Devis validés</p>
                    <p className="text-2xl font-bold text-gray-900">8</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Alertes</p>
                    <p className="text-2xl font-bold text-red-600">3</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Pour les professionnels
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                Optimisez votre activité avec des outils professionnels et un accès
                à une base de données complète de produits BTP.
              </p>
              <ul className="space-y-4">
                {[
                  "Base de données de +2200 produits BTP",
                  "Génération automatique de devis et factures",
                  "Gestion complète des projets et chantiers",
                  "Suivi des délais et alertes automatiques",
                  "Réception et traitement des demandes clients",
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-primary-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Prêt à démarrer votre projet ?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Rejoignez NEXTMIND et bénéficiez d'un accompagnement professionnel
            pour tous vos projets BTP.
          </p>
          <Link href="/register">
            <Button size="lg">
              Créer mon compte gratuitement
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <Link href="/" className="flex items-center mb-4">
                <img src="/images/nextmind.png" alt="NextMind" className="h-8 w-auto" />
              </Link>
              <p className="text-gray-400 text-sm">
                Tout sur le BTP pour mieux vous accompagner.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produit</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/fonctionnalites" className="text-white hover:opacity-90">Fonctionnalités</Link></li>
                <li><Link href="/faq" className="text-white hover:opacity-90">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Entreprise</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/a-propos" className="text-white hover:opacity-90">À propos</Link></li>
                <li><Link href="/contact" className="text-white hover:opacity-90">Contact</Link></li>
                <li><Link href="/mentions-legales" className="text-white hover:opacity-90">Mentions légales</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/assistance" className="text-white hover:opacity-90">Assistance</Link></li>
                <li><Link href="/securite" className="text-white hover:opacity-90">Sécurité</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2024 NEXTMIND. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
