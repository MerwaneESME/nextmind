import type { Metadata } from "next";
import { PublicLayout } from "@/components/layout/PublicLayout";

export const metadata: Metadata = {
  title: "FAQ | NEXTMIND",
  description: "Questions fréquentes sur la plateforme NEXTMIND et les services BTP.",
};

const faqs = [
  {
    q: "Qu'est-ce que NEXTMIND ?",
    a: "NEXTMIND est une plateforme qui met en relation particuliers et professionnels du BTP. Elle propose un assistant IA pour vous accompagner dans vos projets (rénovation, construction, etc.) et faciliter la recherche de devis et le suivi des interventions.",
  },
  {
    q: "Comment créer un projet ?",
    a: "Une fois inscrit, accédez à votre tableau de bord et cliquez sur « Projets » puis « Créer un projet ». Vous pouvez décrire votre besoin et utiliser l'assistant IA pour structurer le projet en phases et lots, puis rechercher des professionnels.",
  },
  {
    q: "Comment contacter un professionnel ?",
    a: "Depuis la fiche d'un professionnel (recherche ou proposition), utilisez le bouton « Contacter » ou la messagerie intégrée dans votre espace « Messages » pour échanger directement.",
  },
  {
    q: "L'assistant IA est-il gratuit ?",
    a: "L'utilisation de l'assistant IA fait partie des fonctionnalités de la plateforme. Les conditions d'usage sont précisées dans votre espace et peuvent varier selon votre type de compte.",
  },
  {
    q: "Comment obtenir des devis ?",
    a: "Après avoir défini votre projet (phases, lots), vous pouvez demander des devis aux professionnels. Les devis sont centralisés dans l'onglet « Devis » de votre tableau de bord.",
  },
  {
    q: "Mes données sont-elles protégées ?",
    a: "Oui. Nous mettons en œuvre des mesures techniques et organisationnelles pour protéger vos données personnelles et vos projets. Consultez notre page Sécurité et notre politique de confidentialité pour plus de détails.",
  },
];

export default function FaqPage() {
  return (
    <PublicLayout>
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Questions fréquentes</h1>
        <p className="text-lg text-gray-600 mb-12">
          Retrouvez les réponses aux questions les plus posées sur NEXTMIND et nos services.
        </p>

        <dl className="space-y-8">
          {faqs.map(({ q, a }) => (
            <div key={q} className="border-b border-gray-200 pb-6">
              <dt className="text-lg font-semibold text-gray-900 mb-2">{q}</dt>
              <dd className="text-gray-600">{a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </PublicLayout>
  );
}
