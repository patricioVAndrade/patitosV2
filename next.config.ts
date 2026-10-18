import type { NextConfig } from "next";

// ---------------------------------------------------------------------------
// Separación por dominio:
//   www.patitosbebe.com.ar    → solo el catálogo (el panel y el login NO existen: 404)
//   admin.patitosbebe.com.ar  → solo el panel (el catálogo redirige al dominio público)
// Si NEXT_PUBLIC_ADMIN_URL no está definida (desarrollo), todo vive en el mismo dominio.
// ---------------------------------------------------------------------------
const hostDe = (url?: string) => (url ? new URL(url).hostname : undefined); // sin puerto
// Coincidencia EXACTA del dominio, con puerto opcional. (Next compara solo el nombre; en Cloudflare
// el adaptador OpenNext compara el encabezado Host completo y usa el valor como regex sin anclar.)
const exacto = (host: string) => `^${host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(:\\d+)?$`;
const sitio = process.env.NEXT_PUBLIC_SITIO_URL?.replace(/\/$/, "");
const adminHost = hostDe(process.env.NEXT_PUBLIC_ADMIN_URL);
const sitioHost = hostDe(sitio);
const apex = sitioHost?.startsWith("www.") ? sitioHost.slice(4) : undefined; // patitosbebe.com.ar → www
const RUTAS_PANEL = ["/panel", "/panel/:ruta*", "/ingresar", "/pendiente", "/auth/:ruta*"];
const RUTAS_TIENDA: [string, string][] = [
  ["/c/:ruta+", "/c/:ruta+"],
  ["/p/:ruta+", "/p/:ruta+"],
  ["/sitemap.xml", "/sitemap.xml"],
  ["/privacidad", "/privacidad"],
  ["/api/catalogo", "/api/catalogo"],
];

const config: NextConfig = {
  // "standalone" = servidor Node independiente: se puede alojar en cualquier lado
  // (Vercel, Railway, Render, un VPS con Docker…) sin cambiar código.
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // Las fotos ya llegan comprimidas desde el celular: no hace falta el optimizador de Next.
  images: { unoptimized: true },
  async rewrites() {
    if (!adminHost) return [];
    // En el dominio público, las rutas del panel responden "no existe"
    return {
      beforeFiles: RUTAS_PANEL.map((source) => ({
        source,
        missing: [{ type: "host" as const, value: exacto(adminHost) }],
        destination: "/no-existe",
      })),
    };
  },
  async redirects() {
    const enApex = apex ? [{ type: "host" as const, value: exacto(apex) }] : [];
    const sinWww = apex && sitio
      ? [
          { source: "/", has: enApex, destination: `${sitio}/`, permanent: true },
          { source: "/:ruta+", has: enApex, destination: `${sitio}/:ruta+`, permanent: true },
        ]
      : [];
    // la URL que se cargó en Google la primera vez
    const viejas = [{ source: "/politicas", destination: "/privacidad", permanent: true }];
    if (!adminHost || !sitio) return [...sinWww, ...viejas];
    const enAdmin = [{ type: "host" as const, value: exacto(adminHost) }];
    return [
      ...sinWww,
      ...viejas,
      { source: "/", has: enAdmin, destination: "/panel", permanent: false },
      ...RUTAS_TIENDA.map(([source, destino]) => ({ source, has: enAdmin, destination: `${sitio}${destino}`, permanent: false })),
    ];
  },
  async headers() {
    return [
      ...(adminHost
        ? [{ source: "/:ruta*", has: [{ type: "host" as const, value: exacto(adminHost) }], headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }]
        : []),
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
      { source: "/panel/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default config;
