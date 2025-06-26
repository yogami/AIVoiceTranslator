ALTER TABLE "sessions" ADD COLUMN "quality" text DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "quality_reason" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "last_activity_at" timestamp DEFAULT now();