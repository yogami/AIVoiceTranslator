import { db } from "../server/db";

async function checkTestDatabaseSchema() {
  try {
    console.log("🔧 Checking test database schema...");
    
    // Check if the new columns exist
    const columnsResult = await db.execute(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' 
      ORDER BY column_name
    `);
    
    console.log("Columns in sessions table:");
    console.table(columnsResult.rows);
    
    // Specifically check for our new columns
    const hasClassCode = columnsResult.rows.some(row => row.column_name === "class_code");
    const hasStudentLanguage = columnsResult.rows.some(row => row.column_name === "student_language");
    
    console.log("\n=== COLUMN CHECK ===");
    console.log(`class_code exists: ${hasClassCode}`);
    console.log(`student_language exists: ${hasStudentLanguage}`);
    
    if (hasClassCode && hasStudentLanguage) {
      console.log("✅ Both new columns exist in test database!");
    } else {
      console.log("❌ Missing columns in test database!");
    }
    
  } catch (error) {
    console.error("❌ Error checking database schema:", error);
  }
}

checkTestDatabaseSchema();
