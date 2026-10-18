import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Configuración para alojar en Cloudflare Workers (adaptador OpenNext).
// El catálogo es dinámico (siempre fresco), así que no hace falta caché incremental.
export default defineCloudflareConfig({});
