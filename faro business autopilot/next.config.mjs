import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  basePath: "/dashboard",
  output: "standalone",
  turbopack: {
    root: rootDir,
  },
};

export default nextConfig;
