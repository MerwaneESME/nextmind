import type { Metadata } from "next";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Mail, MessageSquare, HelpCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact | NEXTMIND",
  description: "Contactez l'équipe NEXTMIND pour toute question ou demande.",
};

export default function ContactPage() {
  return (
    <PublicLayout>
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Contact</h1>
        <p className="text-lg text-gray-600 mb-12">
          Une question, une demande ou un retour ? Nous sommes à votre écoute.
        </p>

        <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-6 rounded-lg border border-gray-200 bg-gray-50/50">
            <Mail className="w-10 h-10 text-primary-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Email</h2>
            <p className="text-gray-600 mb-2">
              Pour toute demande générale ou partenariat :
            </p>
            <a
              href="mailto:contact@nextmind.fr"
              className="text-primary-600 hover:underline font-medium"
            >
              contact@nextmind.fr
            </a>
          </div>

          <div className="p-6 rounded-lg border border-gray-200 bg-gray-50/50">
            <MessageSquare className="w-10 h-10 text-primary-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Support utilisateur</h2>
            <p className="text-gray-600 mb-4">
              Pour un problème technique ou une question sur votre compte, consultez d&apos;abord
              notre page Assistance et la FAQ.
            </p>
            <Link href="/assistance" className="text-primary-600 hover:underline font-medium">
              Accéder à l&apos;assistance
            </Link>
          </div>
        </div>

        <div className="mt-12 p-6 rounded-lg border border-gray-200 bg-primary-50/50">
          <HelpCircle className="w-10 h-10 text-primary-600 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Avant de nous écrire</h2>
          <p className="text-gray-600">
            Consultez la <Link href="/faq" className="text-primary-600 hover:underline">FAQ</Link>{" "}
            et la page <Link href="/assistance" className="text-primary-600 hover:underline">Assistance</Link>{" "}
            pour trouver rapidement des réponses. Si votre demande concerne la confidentialité ou
            la sécurité des données, voir aussi la page{" "}
            <Link href="/securite" className="text-primary-600 hover:underline">Sécurité</Link>.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
