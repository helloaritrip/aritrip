import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Footer } from "@/components/Footer";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AriTrips",
  description: "Find the best trip you can take on your budget.",
  // app.aritrips.com es la herramienta interactiva, no el dominio de
  // contenido/SEO (ese es aritrips.com) — noindex es lo que realmente
  // saca páginas del índice de Google. El robots.txt de este dominio
  // solo bloqueaba el rastreo, lo cual en realidad "atrapa" páginas ya
  // indexadas (Google no puede volver a visitarlas para sacarlas) en
  // vez de sacarlas (auditoría SEO, 2026-08-09).
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AuthProvider>
          <div className="flex flex-1 flex-col">{children}</div>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
