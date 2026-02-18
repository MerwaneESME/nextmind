import type { Metadata } from "next";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Bot, Users, FileText, BarChart3, MessageSquare, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Fonctionnalités | NEXTMIND",
  description: "Découvrez les fonctionnalités de la plateforme NEXTMIND pour le BTP.",
};

export default function FonctionnalitesPage() {
  const features = [
    {
      icon: Bot,
      title: "Assistant IA",
      description: "Un assistant intelligent pour vous guider dans la création de projets, la rédaction de cahiers des charges et l'obtention de conseils personnalisés.",
    },
    {
      icon: Users,
      title: "Mise en relation",
      description: "Trouvez des professionnels du BTP (artisans, entreprises) adaptés à votre projet et comparez les profils en toute transparence.",
    },
    {
      icon: FileText,
      title: "Projets et devis",
      description: "Gérez vos projets par phases et lots, générez des devis, suivez les interventions et le budget en un seul endroit.",
    },
    {
      icon: BarChart3,
      title: "Tableau de bord",
      description: "Vue d'ensemble de vos projets, devis, messages et statistiques selon votre profil (particulier ou professionnel).",
    },
    {
      icon: MessageSquare,
      title: "Messagerie",
      description: "Échangez directement avec les professionnels ou particuliers via la messagerie intégrée.",
    },
    {
      icon: Shield,
      title: "Sécurité et confidentialité",
      description: "Vos données sont protégées. Authentification sécurisée et bonnes pratiques pour la confidentialité.",
    },
  ];

  return (
    <PublicLayout>
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Fonctionnalités</h1>
        <p className="text-lg text-gray-600 mb-12">
          NEXTMIND met à votre disposition un ensemble d&apos;outils pour simplifier vos projets BTP,
          de la conception à la réalisation.
        </p>

        <div className="space-y-10">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex gap-4 p-6 rounded-lg border border-gray-200 bg-gray-50/50"
            >
              <div className="flex-shrink-0 w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                <Icon className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
                <p className="text-gray-600">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
