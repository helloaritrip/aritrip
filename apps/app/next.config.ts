import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Headers de seguridad estándar (auditoría de seguridad, 2026-08-10) —
  // mismo criterio que apps/www/src/middleware.ts. Sin CSP a propósito
  // por ahora: necesita probarse con cuidado contra el script de AdSense
  // embebido en apps/www antes de habilitarla acá también.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;

// Da acceso a request.cf (geolocalización, etc.) también en `next dev`,
// no solo cuando corre como Worker real — necesario para /api/discover.
initOpenNextCloudflareForDev();
