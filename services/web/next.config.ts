import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  env: {
  },

  // Enable standalone output for optimized Docker builds
  // This creates a minimal production build with only necessary files
  output: "standalone",
};

export default nextConfig;
