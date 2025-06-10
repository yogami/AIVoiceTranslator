CREATE TABLE "languages" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "languages_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"teacher_language" text,
	"start_time" timestamp DEFAULT now(),
	"end_time" timestamp,
	"students_count" integer DEFAULT 0,
	"total_translations" integer DEFAULT 0,
	"average_latency" integer,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"language" text NOT NULL,
	"text" text NOT NULL,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_language" varchar(10) NOT NULL,
	"target_language" varchar(10) NOT NULL,
	"original_text" text NOT NULL,
	"translated_text" text NOT NULL,
	"timestamp" timestamp DEFAULT now(),
	"session_id" varchar(255),
	"latency" integer
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
