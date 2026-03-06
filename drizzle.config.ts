import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Drizzle-kit runs in a separate process; load .env.local so DATABASE_URL is available
config({ path: ".env.local" });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
