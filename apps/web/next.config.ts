import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ["shared"],
  turbopack: {
    root: path.resolve(__dirname, "../../"),
  },
  allowedDevOrigins: [
    "localhost:3001",
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "*.ngrok.app",
    "*.ngrok.dev"
  ]
};

export default nextConfig;
