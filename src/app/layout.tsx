import type { Metadata, Viewport } from "next";
// Fuentes servidas desde el propio sitio (sin pedir nada a Google). Solo se descargan si se usan.
import "@fontsource/fredoka/latin-400.css";
import "@fontsource/fredoka/latin-500.css";
import "@fontsource/fredoka/latin-600.css";
import "@fontsource/lexend/latin-400.css";
import "@fontsource/lexend/latin-600.css";
import "@fontsource/bagel-fat-one/latin-400.css";
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

export const viewport: Viewport = { themeColor: "#FFE500", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
