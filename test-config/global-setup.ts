// Playwright Global Setup
// This runs before all tests and sets up the environment

import dotenv from "dotenv";
import path from "path";

async function globalSetup() {
  console.log("🔧 Playwright Global Setup: Setting up test environment...");
  
  // Load .env.test and override any existing environment variables
  const envTestPath = path.resolve(process.cwd(), ".env.test");
  console.log("🔧 Global Setup: Loading environment from:", envTestPath);
  
  const result = dotenv.config({ path: envTestPath, override: true });
  
  if (result.error) {
    console.error("❌ Failed to load .env.test:", result.error);
    throw new Error("Failed to load test environment");
  }

  // Verify the correct DATABASE_URL is loaded
  const isAiven = process.env.DATABASE_URL?.includes("aivencloud.com");
  console.log("🔧 Global Setup: DATABASE_URL provider:", isAiven ? "Aiven (correct)" : "NOT AIVEN - WRONG DATABASE!");
  
  if (!isAiven) {
    console.error("❌ Wrong database detected in global setup!");
    console.error("DATABASE_URL:", process.env.DATABASE_URL);
    throw new Error("Test environment not properly configured - using wrong database");
  }
  
  // Set up database schema ONCE for all tests
  console.log("🔧 Global Setup: Setting up database schema...");
  const { ensureTestDatabaseSchema } = await import("../tests/e2e/test-setup");
  await ensureTestDatabaseSchema();
  
  console.log("✅ Global Setup: Test environment configured correctly");
}

export default globalSetup;
