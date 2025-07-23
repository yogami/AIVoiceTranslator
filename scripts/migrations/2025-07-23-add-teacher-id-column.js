import postgres from 'postgres';

const runTeacherIdMigration = async () => {
  const dbUrl = "postgresql://postgres:eCJZjkRuHVexSoNbftExVjPldoWIcvtB@switchyard.proxy.rlwy.net:22092/railway";
  
  console.log("🟠 Connecting to Railway database...");
  
  const sql = postgres(dbUrl, { max: 1 });
  
  try {
    // Check if teacher_id column already exists
    console.log("🔍 Checking if teacher_id column exists...");
    const columnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' 
      AND column_name = 'teacher_id'
    `;
    
    if (columnCheck.length > 0) {
      console.log("✅ teacher_id column already exists!");
      return;
    }
    
    console.log("➕ Adding teacher_id column...");
    
    // Add teacher_id column
    await sql`ALTER TABLE sessions ADD COLUMN teacher_id TEXT`;
    console.log("✅ Added teacher_id column");
    
    // Add index on teacher_id
    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_teacher_id ON sessions(teacher_id)`;
    console.log("✅ Added index on teacher_id");
    
    // Add partial index for active sessions
    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_teacher_id_active ON sessions(teacher_id) WHERE is_active = true`;
    console.log("✅ Added partial index for active sessions");
    
    console.log("🟢 teacher_id migration completed successfully!");
    
  } catch (error) {
    console.error("🔴 Error running migration:", error);
    throw error;
  } finally {
    await sql.end();
    console.log("🔵 Database connection closed");
  }
};

runTeacherIdMigration().catch(console.error);
