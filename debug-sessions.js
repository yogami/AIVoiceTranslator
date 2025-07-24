// Debug script to inspect session data
import postgres from 'postgres';

async function debugSessions() {
  try {
    // Connect to database
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error('DATABASE_URL not found');
      process.exit(1);
    }
    
    const sql = postgres(connectionString);
    
    console.log('=== ALL SESSIONS ===');
    const allSessions = await sql`
      SELECT id, session_id, start_time, end_time, students_count, is_active, class_code, quality, last_activity_at
      FROM sessions 
      ORDER BY start_time DESC 
      LIMIT 10
    `;
    
    console.log(`Found ${allSessions.length} sessions:`);
    allSessions.forEach((session, i) => {
      const duration = session.end_time && session.start_time ? 
        Math.round((new Date(session.end_time) - new Date(session.start_time)) / 1000) : 0;
      console.log(`\n${i + 1}. Session ID: ${session.session_id}`);
      console.log(`   Started: ${session.start_time}`);
      console.log(`   Ended: ${session.end_time || 'Still active'}`);
      console.log(`   Duration: ${duration} seconds`);
      console.log(`   Students Count: ${session.students_count || 0}`);
      console.log(`   Active: ${session.is_active}`);
      console.log(`   Class Code: ${session.class_code}`);
      console.log(`   Quality: ${session.quality}`);
      console.log(`   Last Activity: ${session.last_activity_at}`);
    });
    
    console.log('\n=== DURATION STATS ===');
    const durationStats = await sql`
      SELECT 
        AVG(EXTRACT(EPOCH FROM (end_time - start_time))) as avg_duration,
        MAX(EXTRACT(EPOCH FROM (end_time - start_time))) as max_duration,
        MIN(EXTRACT(EPOCH FROM (end_time - start_time))) as min_duration,
        COUNT(*) as total_sessions
      FROM sessions 
      WHERE end_time IS NOT NULL AND start_time IS NOT NULL
    `;
    
    console.log('Duration statistics:', durationStats[0]);
    
    console.log('\n=== STUDENT COUNT STATS ===');
    const studentStats = await sql`
      SELECT 
        SUM(COALESCE(students_count, 0)) as total_student_slots,
        AVG(COALESCE(students_count, 0)) as avg_students_per_session,
        MAX(students_count) as max_students,
        COUNT(*) as total_sessions
      FROM sessions
    `;
    
    console.log('Student statistics:', studentStats[0]);
    
    console.log('\n=== TESTING RECENT ACTIVITY QUERY ===');
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - 24);
    
    const recentActivity = await sql`
      SELECT 
        s.session_id,
        s.start_time,
        s.end_time,
        s.students_count,
        s.is_active,
        COALESCE(tc.transcript_count, 0) as transcript_count,
        CASE 
          WHEN s.end_time IS NOT NULL THEN EXTRACT(EPOCH FROM (s.end_time - s.start_time)) * 1000
          WHEN s.is_active = true THEN EXTRACT(EPOCH FROM (NOW() - s.start_time)) * 1000
          ELSE 0
        END as duration_ms
      FROM sessions s
      LEFT JOIN (
        SELECT session_id, COUNT(*) as transcript_count
        FROM transcripts
        GROUP BY session_id
      ) tc ON s.session_id = tc.session_id
      WHERE (
        s.start_time >= ${cutoffTime} OR s.is_active = true
      ) AND (
        (s.is_active = true AND s.students_count > 0) OR
        s.total_translations > 0
      )
      ORDER BY s.start_time DESC
      LIMIT 10
    `;
    
    console.log('Recent activity data:');
    recentActivity.forEach((activity, i) => {
      console.log(`${i + 1}. Session: ${activity.session_id}`);
      console.log(`   Duration: ${activity.duration_ms} ms (${Math.round(activity.duration_ms / 1000)} seconds)`);
      console.log(`   Students: ${activity.students_count}`);
      console.log(`   Transcripts: ${activity.transcript_count}`);
      console.log(`   Active: ${activity.is_active}`);
    });
    
    const totalDuration = recentActivity.reduce((sum, activity) => sum + Number(activity.duration_ms), 0);
    const avgDuration = recentActivity.length > 0 ? totalDuration / recentActivity.length : 0;
    console.log(`\nAverage duration: ${avgDuration} ms (${Math.round(avgDuration / 1000)} seconds)`);
    
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugSessions();
