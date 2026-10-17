import type { NextConfig } from "next";

const config: NextConfig = {
  // "standalone" = servidor Node independiente: se puede alojar en cualquier lado
  // (Vercel, Railway, Render, un VPS con Docker…) sin cambiar código.
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // Las fotos ya llegan comprimidas desde el celular: no hace falta el optimizador de Next.
  images: { unoptimized: true },
  async headers() {
    return [
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
