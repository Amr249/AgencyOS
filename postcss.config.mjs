import path from "path";
import { fileURLToPath } from "url";

/** App root (folder that contains package.json + node_modules). */
const appRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {
      base: appRoot,
    },
  },
};

export default config;
