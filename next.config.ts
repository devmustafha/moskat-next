import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // forbidden() and app/forbidden.tsx (403 for signed-in users with the wrong role).
    authInterrupts: true,
  },
};

export default nextConfig;
