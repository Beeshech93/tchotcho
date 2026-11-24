import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Preset de salida detectado automáticamente:
// - Vercel define process.env.VERCEL en sus builds → preset vercel
// - Otros entornos → cloudflare-module
const ON_VERCEL = Boolean(process.env["VERCEL"]);
const NITRO_PRESET = ON_VERCEL ? "vercel" : "cloudflare-module";

export default defineConfig({
  css: { transformer: "lightningcss" },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
    ignoreOutdatedRequests: true,
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
      server: { entry: "server" },
    }),
    nitro({
      preset: NITRO_PRESET,
      ...(ON_VERCEL ? {} : { cloudflare: { nodeCompat: true, deployConfig: true } }),
      routeRules: {
        "/**": {
          headers: {
            "X-Frame-Options": "DENY",
            "X-Content-Type-Options": "nosniff",
            "X-XSS-Protection": "1; mode=block",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), payment=(self)",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
            "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
            "Cross-Origin-Resource-Policy": "same-origin",
          },
        },
      },
    }),
    viteReact(),
  ],
});
