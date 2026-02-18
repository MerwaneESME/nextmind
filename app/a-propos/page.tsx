import type { Metadata } from "next";
import { PublicLayout } from "@/components/layout/PublicLayout";

export const metadata: Metadata = {
  title: "À propos | NEXTMIND",
  description: "À propos de NEXTMIND, plateforme BTP pour particuliers et professionnels.",
};

export default function AProposPage() {
  return (
    <PublicLayout>
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">À propos de NEXTMIND</h1>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-600">
          <p className="text-lg">
            NEXTMIND a pour ambition de simplifier la relation entre les particuliers et les
            professionnels du bâtiment et des travaux publics (BTP). Nous croyons que chaque projet
            mérite un accompagnement clair, de la première idée jusqu&apos;à la réalisation.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 pt-4">Notre mission</h2>
          <p>
            Proposer une plateforme intelligente qui met en relation les bons acteurs, aide à
            structurer les projets (phases, lots, devis) et offre un point d&apos;entrée unique pour
            le suivi des interventions et du budget. Notre assistant IA est conçu pour vous guider
            à chaque étape, que vous soyez particulier ou professionnel.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 pt-4">Pour qui ?</h2>
          <p>
            <strong>Particuliers</strong> : créez votre projet, décrivez vos besoins, obtenez des
            devis et suivez les chantiers en toute sérénité.
            <br />
            <strong>Professionnels</strong> : valorisez votre profil, répondez aux demandes et
            gérez vos échanges et devis depuis un même espace.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 pt-4">Contact</h2>
          <p>
            Pour toute question sur NEXTMIND, rendez-vous sur notre page{" "}
            <a href="/contact" className="text-primary-600 hover:underline">Contact</a>.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
