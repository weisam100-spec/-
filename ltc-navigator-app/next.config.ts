import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ecpay_aio_nodejs reads an XML config file at runtime via a path relative
  // to its own __dirname (fs.readFileSync(__dirname + '/../../lib/...')).
  // Letting Next.js bundle it breaks that lookup, so keep it as a real
  // node_modules require instead.
  serverExternalPackages: ["ecpay_aio_nodejs"],
};

export default nextConfig;
