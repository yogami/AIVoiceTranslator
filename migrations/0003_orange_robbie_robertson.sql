ALTER TABLE "sessions" ALTER COLUMN "last_activity_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "teacher_id" text;