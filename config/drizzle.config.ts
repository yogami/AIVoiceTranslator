import { defineConfig } from "drizzle-kit";
import path from "path";

// Get the project root path
const projectRoot = path.resolve(__dirname, '..');

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: path.join(projectRoot, "./migrations"),
  schema: path.join(projectRoot, "./shared/schema.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});