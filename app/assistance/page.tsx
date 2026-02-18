import type { Metadata } from "next";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { BookOpen, Mail, MessageCircle, Search } from "lucide-react";

export const metadata: Metadata = {
  title: "Assistance | NEXTMIND",
  description: "Assistance et support utilisateur NEXTMIND.",
};

export default function AssistancePage() {
  return (
    <PublicLayout>
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Assistance</h1>
        <p className="text-lg text-gray-600 mb-12">
          Trouvez de l&apos;aide et des réponses pour utiliser NEXTMIND au quotidien.
        </p>

        <div className="space-y-8">
          <div className="p-6 rounded-lg border border-gray-200 bg-gray-50/50 flex gap-4">
            <Search className="w-10 h-10 text-primary-600 flex-shrink-0" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">FAQ</h2>
              <p className="text-gray-600 mb-4">
                Consultez les questions fréquentes : inscription, création de projet, devis,
                messagerie, assistant IA.
              </p>
              <Link href="/faq" className="text-primary-600 hover:underline font-medium inline-flex items-center gap-1">
                Voir la FAQ <BookOpen className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="p-6 rounded-lg border border-gray-200 bg-gray-50/50 flex gap-4">
            <BookOpen className="w-10 h-10 text-primary-600 flex-shrink-0" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Fonctionnalités</h2>
              <p className="text-gray-600 mb-4">
                Découvrez en détail les fonctionnalités de la plateforme : assistant IA, projets,
                devis, messagerie, tableau de bord.
              </p>
              <Link href="/fonctionnalites" className="text-primary-600 hover:underline font-medium">
                Voir les fonctionnalités
              </Link>
            </div>
          </div>

          <div className="p-6 rounded-lg border border-gray-200 bg-gray-50/50 flex gap-4">
            <MessageCircle className="w-10 h-10 text-primary-600 flex-shrink-0" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Nous contacter</h2>
              <p className="text-gray-600 mb-4">
                Pour une question non couverte par la FAQ ou un problème technique, contactez-nous
                par email. Nous nous efforçons de répondre dans les meilleurs délais.
              </p>
              <Link href="/contact" className="text-primary-600 hover:underline font-medium inline-flex items-center gap-1">
                Page contact <Mail className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="p-6 rounded-lg border border-primary-200 bg-primary-50/50">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Problème de connexion ou de compte</h2>
            <p className="text-gray-600">
              Vérifiez vos identifiants et utilisez « Mot de passe oublié » sur la page de
              connexion. Si le problème persiste, contactez-nous via la page{" "}
              <Link href="/contact" className="text-primary-600 hover:underline">Contact</Link>.
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
