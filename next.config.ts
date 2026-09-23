import os from "os";
import type { NextConfig } from "next";

const lanHosts = Object.values(os.networkInterfaces())
  .flatMap((entries) => entries ?? [])
  .filter((entry) => entry.family === "IPv4" && !entry.internal)
  .map((entry) => entry.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanHosts,
  experimental: {
    serverActions: {
      allowedOrigins: lanHosts.flatMap((host) => [host, `${host}:3000`, `${host}:5000`]),
    },
  },
};

export default nextConfig;
