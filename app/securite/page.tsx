import type { Metadata } from "next";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Shield, Lock, Database, Eye, Server } from "lucide-react";

export const metadata: Metadata = {
  title: "Sécurité | NEXTMIND",
  description: "Sécurité des données et bonnes pratiques NEXTMIND.",
};

const points = [
  {
    icon: Lock,
    title: "Authentification",
    text: "Connexion sécurisée par mot de passe. Nous vous recommandons d'utiliser un mot de passe robuste et de ne pas le partager. La réinitialisation du mot de passe est disponible depuis la page de connexion.",
  },
  {
    icon: Database,
    title: "Données personnelles",
    text: "Les données que vous nous confiez (profil, projets, messages) sont traitées dans le respect du RGPD. Elles sont utilisées pour le fonctionnement du service et ne sont pas vendues à des tiers.",
  },
  {
    icon: Server,
    title: "Hébergement et infrastructure",
    text: "L'application et les données sont hébergées sur une infrastructure sécurisée. Les échanges avec le site sont chiffrés (HTTPS).",
  },
  {
    icon: Eye,
    title: "Accès et confidentialité",
    text: "Seuls vous et les utilisateurs avec lesquels vous échangez (par exemple un professionnel contacté) ont accès aux contenus de vos échanges. Les projets et devis sont associés à votre compte.",
  },
  {
    icon: Shield,
    title: "Bonnes pratiques",
    text: "Nous mettons en œuvre des mesures techniques et organisationnelles pour limiter les accès non autorisés, les pertes ou les fuites de données. En cas d'incident, nous nous engageons à agir conformément à la réglementation.",
  },
];

export default function SecuritePage() {
  return (
    <PublicLayout>
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Sécurité et confidentialité</h1>
        <p className="text-lg text-gray-600 mb-12">
          La protection de vos données et la sécurité de notre plateforme sont au cœur de nos
          priorités.
        </p>

        <div className="space-y-8">
          {points.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="flex gap-4 p-6 rounded-lg border border-gray-200 bg-gray-50/50"
            >
              <div className="flex-shrink-0 w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                <Icon className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
                <p className="text-gray-600">{text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 rounded-lg border border-gray-200 bg-gray-50 text-gray-600">
          <p>
            Pour toute question relative à vos données personnelles ou à un incident de sécurité,
            contactez-nous via la page{" "}
            <a href="/contact" className="text-primary-600 hover:underline">Contact</a>. Pour les
            aspects juridiques, consultez également les{" "}
            <a href="/mentions-legales" className="text-primary-600 hover:underline">Mentions légales</a>.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
