import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/panel", "/ingresar", "/auth", "/api"] }],
    sitemap: `${env.sitioUrl}/sitemap.xml`,
  };
}
