import type { Metadata, Viewport } from "next";
import "./globals.css";
import { env } from "@/lib/env";
import { negocio } from "@/lib/negocio";

export const metadata: Metadata = {
  metadataBase: new URL(env.sitioUrl),
  title: { default: `${negocio.nombre} | Juguetería en Coronel Moldes`, template: `%s | ${negocio.nombre}` },
  description: negocio.descripcion,
  openGraph: { siteName: negocio.nombre, locale: "es_AR", type: "website" },
  icons: { icon: "/favicon.png" },
};

export const viewport: Viewport = { themeColor: "#FF6B6B", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
