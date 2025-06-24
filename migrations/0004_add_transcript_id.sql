CREATE TABLE IF NOT EXISTS "new_transcripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"language" text NOT NULL,
	"text" text NOT NULL,
	"timestamp" timestamp DEFAULT now()
);

-- Copy data from old table if it exists
INSERT INTO "new_transcripts" ("session_id", "language", "text", "timestamp")
SELECT "session_id", "language", "text", "timestamp" 
FROM "transcripts" 
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transcripts');

-- Drop old table if it exists
DROP TABLE IF EXISTS "transcripts";

-- Rename new table
ALTER TABLE "new_transcripts" RENAME TO "transcripts";
