import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

// Da acceso a request.cf (geolocalización, etc.) también en `next dev`,
// no solo cuando corre como Worker real — necesario para /api/discover.
initOpenNextCloudflareForDev();
