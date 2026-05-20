import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: rootDir,
  },
};

export default nextConfig;
