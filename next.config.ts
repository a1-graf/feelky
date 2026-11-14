import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/kabinet": ["./content/kabinet/index.html"]
  }
};

export default nextConfig;
