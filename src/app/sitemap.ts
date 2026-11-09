import type { MetadataRoute } from "next";
import { supabasePublico } from "@/lib/supabase/servidor";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic"; // se genera con datos al día

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const s = supabasePublico();
  const urls: MetadataRoute.Sitemap = [{ url: env.sitioUrl, changeFrequency: "daily", priority: 1 }];
  const { data: cats } = await s.from("v_categorias").select("slug").gt("cantidad", 0);
  (cats ?? []).forEach((c) => urls.push({ url: `${env.sitioUrl}/c/${c.slug}`, changeFrequency: "daily", priority: 0.8 }));
  const { data: marcas } = await s.from("v_marcas").select("slug");
  (marcas ?? []).forEach((m) => urls.push({ url: `${env.sitioUrl}/m/${m.slug}`, changeFrequency: "weekly", priority: 0.7 }));
  for (let desde = 0; ; desde += 1000) {
    const { data } = await s.from("v_catalogo").select("sku,slug,actualizado").order("sku").range(desde, desde + 999);
    (data ?? []).forEach((p) => urls.push({ url: `${env.sitioUrl}/p/${p.sku}/${p.slug}`, lastModified: p.actualizado, priority: 0.6 }));
    if (!data || data.length < 1000) break;
  }
  return urls;
}
