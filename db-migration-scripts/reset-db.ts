import "dotenv/config"; // Loads .env by default
import postgres from "postgres";
import { fileURLToPath } from "url";
import path from "path";

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tableNames = [
  "translations",
  "transcripts",
  "sessions",
  "languages",
  "users",
  "drizzle.__drizzle_migrations" // Drizzle's internal migration tracking table
];

const resetDatabase = async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL environment variable must be set.");
  }

  const urlParts = dbUrl.split("@");
  const safeLogUrl = urlParts.length > 1 ? `${urlParts[0].substring(0, urlParts[0].lastIndexOf(":") + 1)}[PASSWORD_REDACTED]@${urlParts[1]}` : dbUrl;
  console.log(`🟠 Attempting to reset database: ${safeLogUrl}`);
  console.log("   This will DROP the following tables if they exist:");
  tableNames.forEach(name => console.log(`     - ${name}`));

  let sql;
  try {
    sql = postgres(dbUrl, { max: 1 });

    console.log("🟠 Dropping tables...");
    for (const tableName of tableNames) {
      await sql.unsafe(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
      console.log(`   ✓ Table ${tableName} dropped (if existed).`);
    }

    console.log("🟢 Database reset successfully (tables dropped).");
  } catch (error) {
    console.error("🔴 Error resetting database:", error);
    process.exit(1);
  } finally {
    if (sql) {
      await sql.end();
      console.log("🔵 Database connection closed.");
    }
  }
};

resetDatabase();
