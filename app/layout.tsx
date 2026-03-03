import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "NEXTMIND - Tout sur le BTP pour mieux vous accompagner",
  description: "Plateforme BTP mettant en relation particuliers et professionnels avec un assistant IA intelligent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased bg-neutral-50 text-neutral-900 font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
