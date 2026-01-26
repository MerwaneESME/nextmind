import type { Metadata } from "next";
import { Inter, Open_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-heading" });
const openSans = Open_Sans({ subsets: ["latin"], display: "swap", variable: "--font-body" });

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
      <body className={`${inter.variable} ${openSans.variable} antialiased bg-neutral-50 text-neutral-900`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
