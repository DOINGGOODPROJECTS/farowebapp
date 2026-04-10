import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// In Docker the backend service is reachable at http://backend:5100.
// Locally it's http://localhost:5100. BACKEND_URL overrides both.
const backendUrl = process.env.BACKEND_URL || "http://localhost:5100";

const nextConfig: NextConfig = {
  turbopack: {
    root: rootDir,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
