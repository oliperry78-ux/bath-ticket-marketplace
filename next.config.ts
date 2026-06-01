import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse bundles pdfjs-dist which uses Node.js worker internals
  // that Turbopack cannot statically analyse. Opting it out makes
  // Next.js use native require() at runtime instead of bundling it.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
};

export default nextConfig;
