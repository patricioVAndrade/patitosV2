import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    env: { NEXT_PUBLIC_SUPABASE_URL: "https://ejemplo.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" },
  },
});
