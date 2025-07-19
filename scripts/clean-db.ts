import { db } from "../server/db";

async function cleanDatabase() {
  try {
    console.log("✅ Connected to database...");
    
    // Check what data exists
    console.log("\n=== CHECKING CURRENT DATA ===");
    
    const sessionsCount = await db.execute("SELECT COUNT(*) FROM sessions");
    const translationsCount = await db.execute("SELECT COUNT(*) FROM translations");
    const transcriptsCount = await db.execute("SELECT COUNT(*) FROM transcripts");
    
    console.log(`Sessions: ${sessionsCount.rows[0].count}`);
    console.log(`Translations: ${translationsCount.rows[0].count}`);
    console.log(`Transcripts: ${transcriptsCount.rows[0].count}`);
    
    // Show sample data if it exists
    if (parseInt(translationsCount.rows[0].count) > 0) {
      console.log("\n=== SAMPLE TRANSLATIONS (that will be deleted) ===");
      const sampleTranslations = await db.query("SELECT source_language, target_language, source_text, target_text, created_at FROM translations LIMIT 5");
      console.table(sampleTranslations.rows);
    }
    
    if (parseInt(sessionsCount.rows[0].count) > 0) {
      console.log("\n=== SAMPLE SESSIONS (that will be deleted) ===");
      const sampleSessions = await db.execute("SELECT session_id, class_code, start_time FROM sessions LIMIT 5");
      console.table(sampleSessions.rows);
    }
    
    // Clean the database
    console.log("\n=== CLEANING DATABASE ===");
    console.log("Deleting all test data...");
    
    await db.execute("DELETE FROM transcripts");
    console.log("✅ Cleaned transcripts table");
    
    await db.execute("DELETE FROM translations");
    console.log("✅ Cleaned translations table");
    
    await db.execute("DELETE FROM sessions");
    console.log("✅ Cleaned sessions table");
    
    // Verify cleanup
    console.log("\n=== VERIFICATION ===");
    const finalSessionsCount = await db.execute("SELECT COUNT(*) FROM sessions");
    const finalTranslationsCount = await db.execute("SELECT COUNT(*) FROM translations");
    const finalTranscriptsCount = await db.execute("SELECT COUNT(*) FROM transcripts");
    
    console.log(`Sessions: ${finalSessionsCount.rows[0].count}`);
    console.log(`Translations: ${finalTranslationsCount.rows[0].count}`);
    console.log(`Transcripts: ${finalTranscriptsCount.rows[0].count}`);
    
    console.log("\n🎉 Database cleaned successfully!");
    console.log("The diagnostics page should now show empty state.");
    
  } catch (error) {
    console.error("❌ Error cleaning database:", error);
  }
}

cleanDatabase();
