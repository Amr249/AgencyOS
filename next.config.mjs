import createNextIntlPlugin from "next-intl/plugin";
import path from "path";
import { fileURLToPath } from "url";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

/** ESM: package directory so Turbopack does not treat a parent folder as the app root. */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname);
const nodeModules = path.join(appRoot, "node_modules");

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: appRoot,
    // PostCSS resolves `@import "tailwindcss"` from a wrong context when a parent folder
    // (e.g. user profile) has a package.json — force packages to this app's node_modules.
    resolveAlias: {
      tailwindcss: path.join(nodeModules, "tailwindcss"),
      "tw-animate-css": path.join(nodeModules, "tw-animate-css"),
      "@tailwindcss/postcss": path.join(nodeModules, "@tailwindcss/postcss"),
    },
  },
  serverExternalPackages: ["@react-pdf/renderer", "pdf-parse"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
