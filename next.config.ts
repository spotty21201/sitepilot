import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.OUTPUT_STANDALONE === "true" ? "standalone" : undefined,
  transpilePackages: [
    "@pascal-app/editor",
    "@pascal-app/core",
    "@pascal-app/viewer",
    "@pascal-app/nodes"
  ],
  allowedDevOrigins: [
    "100.97.49.76",
    "100.97.49.76:3005",
    "192.168.68.100",
    "192.168.68.100:3005",
    "localhost",
    "localhost:3005",
    "127.0.0.1",
    "127.0.0.1:3005",
    "*.local",
    "*"
  ],
};

export default nextConfig;
