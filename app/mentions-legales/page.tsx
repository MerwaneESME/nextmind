import type { Metadata } from "next";
import { PublicLayout } from "@/components/layout/PublicLayout";

export const metadata: Metadata = {
  title: "Mentions légales | NEXTMIND",
  description: "Mentions légales et informations juridiques de NEXTMIND.",
};

export default function MentionsLegalesPage() {
  return (
    <PublicLayout>
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Mentions légales</h1>
        <p className="text-sm text-gray-500 mb-12">Dernière mise à jour : 2024</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-600">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900">Éditeur du site</h2>
            <p>
              Le site NEXTMIND est édité par NEXTMIND (ou la raison sociale de la société éditrice).
              Siège social : [adresse du siège]. Pour toute question relative aux mentions légales,
              vous pouvez nous contacter via la page{" "}
              <a href="/contact" className="text-primary-600 hover:underline">Contact</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">Hébergement</h2>
            <p>
              Le site est hébergé par [nom de l&apos;hébergeur et adresse]. Les données sont
              stockées dans un environnement sécurisé conforme aux bonnes pratiques en vigueur.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble du contenu du site (textes, visuels, logos, structure) est protégé
              par le droit d&apos;auteur et le droit des marques. Toute reproduction ou utilisation
              non autorisée peut constituer une contrefaçon.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">Données personnelles</h2>
            <p>
              Les données personnelles collectées via le site sont traitées conformément à la
              réglementation en vigueur (RGPD). Pour plus d&apos;informations sur le traitement
              de vos données et vos droits, consultez notre politique de confidentialité et la
              page <a href="/securite" className="text-primary-600 hover:underline">Sécurité</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">Cookies</h2>
            <p>
              Le site peut utiliser des cookies pour le fonctionnement de la session, la sécurité
              et l&apos;amélioration des services. Vous pouvez gérer vos préférences dans les
              paramètres de votre navigateur.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">Limitation de responsabilité</h2>
            <p>
              NEXTMIND met en relation particuliers et professionnels du BTP. La plateforme ne
              garantit pas les prestations réalisées par les professionnels. Les contrats et
              engagements sont conclus directement entre les utilisateurs.
            </p>
          </section>
        </div>
      </section>
    </PublicLayout>
  );
}
