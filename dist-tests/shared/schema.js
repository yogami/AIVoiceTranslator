import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
export var users = pgTable("users", {
    id: serial("id").primaryKey(),
    username: text("username").notNull().unique(),
    password: text("password").notNull(),
});
export var insertUserSchema = createInsertSchema(users).pick({
    username: true,
    password: true,
});
export var languages = pgTable("languages", {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    isActive: boolean("is_active").default(true),
});
export var insertLanguageSchema = createInsertSchema(languages).pick({
    code: true,
    name: true,
    isActive: true,
});
export var translations = pgTable("translations", {
    id: serial("id").primaryKey(),
    sourceLanguage: text("source_language").notNull(),
    targetLanguage: text("target_language").notNull(),
    originalText: text("original_text").notNull(),
    translatedText: text("translated_text").notNull(),
    timestamp: timestamp("timestamp").defaultNow(),
    latency: integer("latency"),
});
export var insertTranslationSchema = createInsertSchema(translations).pick({
    sourceLanguage: true,
    targetLanguage: true,
    originalText: true,
    translatedText: true,
    latency: true,
});
export var transcripts = pgTable("transcripts", {
    id: serial("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    language: text("language").notNull(),
    text: text("text").notNull(),
    timestamp: timestamp("timestamp").defaultNow(),
});
export var insertTranscriptSchema = createInsertSchema(transcripts).pick({
    sessionId: true,
    language: true,
    text: true,
});
//# sourceMappingURL=schema.js.map