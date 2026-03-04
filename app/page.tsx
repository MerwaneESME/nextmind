import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Bot,
  Handshake,
  LayoutDashboard,
  Search,
  Home,
  FileText,
  MessageCircle,
  Shield,
  Check,
  BarChart3,
  Package,
  Receipt,
  Users,
  Calendar,
  Bell,
} from "lucide-react";
import LandingHeader from "@/components/landing/LandingHeader";

const features = [
  {
    icon: Bot,
    title: "Assistant IA spécialisé",
    description:
      "Posez vos questions BTP, obtenez des estimations de coûts et des recommandations personnalisées en temps réel.",
  },
  {
    icon: Handshake,
    title: "Mise en relation",
    description:
      "Trouvez les artisans et entreprises qualifiés près de chez vous. Comparez les devis en toute transparence.",
  },
  {
    icon: LayoutDashboard,
    title: "Gestion complète",
    description:
      "Devis, factures, planning, messagerie et suivi d'avancement — tout centralisé dans un seul outil.",
  },
];

const particuliersBenefits = [
  { icon: Search, text: "Décrivez votre projet et recevez des estimations IA" },
  { icon: Home, text: "Trouvez des professionnels vérifiés près de chez vous" },
  { icon: FileText, text: "Comparez les devis en toute transparence" },
  { icon: MessageCircle, text: "Échangez facilement via la messagerie intégrée" },
  { icon: Shield, text: "Suivez l'avancement de vos travaux en temps réel" },
];

const proBenefits = [
  { icon: Package, text: "Accédez à +2200 produits BTP référencés" },
  { icon: Receipt, text: "Générez devis et factures en quelques clics" },
  { icon: Users, text: "Recevez des demandes de clients qualifiés" },
  { icon: Calendar, text: "Planifiez vos chantiers avec le planning intégré" },
  { icon: BarChart3, text: "Suivez votre activité avec des tableaux de bord" },
  { icon: Bell, text: "Alertes et notifications en temps réel" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />

      {/* ── Hero ── */}
      <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden pt-20">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(ellipse at 20% 50%, rgba(56,182,255,0.10) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(24,0,173,0.07) 0%, transparent 60%)",
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="animate-fade-in inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 border border-primary-100 mb-8">
              <Sparkles className="w-4 h-4 text-primary-600 flex-shrink-0" />
              <span className="text-sm font-medium text-primary-700">
                Plateforme BTP propulsée par l'IA
              </span>
            </div>

            {/* H1 */}
            <h1 className="animate-fade-in-up text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6 text-neutral-900">
              Tout sur le BTP pour{" "}
              <span className="gradient-text">mieux vous accompagner</span>
            </h1>

            {/* Description */}
            <p className="animate-fade-in-up-1 text-lg sm:text-xl text-neutral-500 max-w-2xl mx-auto mb-10 leading-relaxed">
              De l'estimation à la réalisation, NextMind connecte particuliers et
              professionnels du bâtiment grâce à l'intelligence artificielle.
            </p>

            {/* CTAs */}
            <div className="animate-fade-in-up-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-primary-400 to-primary-600 text-white font-semibold text-base shadow-lg hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200"
              >
                Commencer gratuitement
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/login"
                className="flex items-center gap-2 px-8 py-4 rounded-xl border-2 border-primary-200 text-primary-700 font-semibold text-base hover:border-primary-400 hover:bg-primary-50 transition-all duration-200"
              >
                Se connecter
              </Link>
            </div>

            {/* Stats */}
            <div className="animate-fade-in-up-3 mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
              {[
                { value: "2200+", label: "Produits BTP" },
                { value: "IA", label: "Assistant dédié" },
                { value: "100%", label: "Gratuit au départ" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold gradient-text">{stat.value}</div>
                  <div className="text-sm text-neutral-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 lg:py-32 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-neutral-900">
              Comment ça <span className="gradient-text">fonctionne</span>
            </h2>
            <p className="text-neutral-500 text-lg max-w-2xl mx-auto">
              Trois piliers pour simplifier vos projets de construction et rénovation.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative p-8 rounded-2xl bg-white border border-neutral-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-neutral-900">{feature.title}</h3>
                <p className="text-neutral-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Particuliers ── */}
      <section className="py-24 lg:py-32 bg-gradient-to-br from-primary-50/40 via-white to-blue-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left – text */}
            <div>
              <span className="inline-block text-sm font-semibold text-primary-600 mb-4 uppercase tracking-wider">
                Pour les particuliers
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-neutral-900">
                Vos travaux, <span className="gradient-text">simplifiés</span>
              </h2>
              <p className="text-neutral-500 text-lg mb-8 leading-relaxed">
                Que ce soit une rénovation de cuisine ou la construction d'une extension,
                NextMind vous guide à chaque étape.
              </p>
              <ul className="space-y-4">
                {particuliersBenefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center shrink-0 mt-0.5">
                      <b.icon className="w-4 h-4 text-primary-600" />
                    </div>
                    <span className="text-neutral-700">{b.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right – mock card */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-neutral-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-sm">
                  <Home className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-neutral-900">Mon projet</div>
                  <div className="text-sm text-neutral-500">Rénovation cuisine</div>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  "Estimation IA : 8 500 — 12 000 €",
                  "3 artisans disponibles",
                  "Durée estimée : 2-3 semaines",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 p-3 rounded-xl bg-primary-50/60 border border-primary-100/60"
                  >
                    <Check className="w-4 h-4 text-primary-600 shrink-0" />
                    <span className="text-sm text-neutral-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Professionnels ── */}
      <section className="py-24 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left – dashboard mock */}
            <div className="bg-neutral-50 rounded-2xl p-8 border border-neutral-100 shadow-sm order-2 lg:order-1">
              <h3 className="text-lg font-bold text-neutral-900 mb-6 text-center">
                Dashboard professionnel
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Projets en cours", value: "12", color: "text-primary-600" },
                  { label: "Devis à faire", value: "5", color: "text-amber-600" },
                  { label: "Devis validés", value: "8", color: "text-emerald-600" },
                  { label: "Alertes", value: "3", color: "text-red-500" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="p-4 bg-white rounded-xl border border-neutral-100 shadow-sm"
                  >
                    <p className="text-xs text-neutral-500 mb-1">{item.label}</p>
                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right – text */}
            <div className="order-1 lg:order-2">
              <span className="inline-block text-sm font-semibold text-primary-600 mb-4 uppercase tracking-wider">
                Pour les professionnels
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-neutral-900">
                Développez votre <span className="gradient-text">activité</span>
              </h2>
              <p className="text-neutral-500 text-lg mb-8 leading-relaxed">
                Gagnez du temps, trouvez de nouveaux clients et gérez vos chantiers
                depuis une seule plateforme.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {proBenefits.map((b, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-primary-50/50 transition-colors"
                  >
                    <b.icon className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
                    <span className="text-sm text-neutral-700">{b.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 lg:py-32 bg-neutral-50 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 50% 100%, rgba(56,182,255,0.08) 0%, transparent 70%)",
          }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-neutral-900">
              Prêt à démarrer votre <span className="gradient-text">projet ?</span>
            </h2>
            <p className="text-neutral-500 text-lg mb-10 max-w-xl mx-auto">
              Rejoignez NextMind et bénéficiez de la puissance de l'IA pour vos projets
              de construction et rénovation.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-primary-400 to-primary-600 text-white font-semibold text-base shadow-lg hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200"
              >
                Créer mon compte
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/login"
                className="flex items-center gap-2 px-8 py-4 rounded-xl border-2 border-neutral-200 text-neutral-700 font-semibold text-base hover:border-primary-300 hover:text-primary-700 transition-all duration-200"
              >
                Découvrir les fonctionnalités
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center mb-4">
                <img
                  src="/images/nextmind.png"
                  alt="NextMind"
                  className="h-8 w-auto brightness-0 invert"
                />
              </Link>
              <p className="text-sm text-slate-400 leading-relaxed">
                La plateforme intelligente pour tous vos projets BTP.
              </p>
            </div>

            {/* Links */}
            {[
              {
                title: "Produit",
                links: [
                  { label: "Fonctionnalités", href: "/fonctionnalites" },
                  { label: "FAQ", href: "/faq" },
                  { label: "Sécurité", href: "/securite" },
                ],
              },
              {
                title: "Entreprise",
                links: [
                  { label: "À propos", href: "/a-propos" },
                  { label: "Contact", href: "/contact" },
                ],
              },
              {
                title: "Support",
                links: [
                  { label: "Assistance", href: "/assistance" },
                  { label: "Mentions légales", href: "/mentions-legales" },
                ],
              },
            ].map(({ title, links }) => (
              <div key={title}>
                <h4 className="font-semibold text-white mb-4">{title}</h4>
                <ul className="space-y-3">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-slate-400 hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-800 mt-12 pt-8 text-center">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} NextMind. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
