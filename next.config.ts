import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lock Next.js to this repo so it doesn't walk up to C:\Users\smhus
  outputFileTracingRoot: path.join(__dirname, "."),
};

export default nextConfig;
