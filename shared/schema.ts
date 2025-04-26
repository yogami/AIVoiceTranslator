import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const languages = pgTable("languages", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true),
});

export const insertLanguageSchema = createInsertSchema(languages).pick({
  code: true,
  name: true,
  isActive: true,
});

export const translations = pgTable("translations", {
  id: serial("id").primaryKey(),
  sourceLanguage: text("source_language").notNull(),
  targetLanguage: text("target_language").notNull(),
  originalText: text("original_text").notNull(),
  translatedText: text("translated_text").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  latency: integer("latency"),
});

export const insertTranslationSchema = createInsertSchema(translations).pick({
  sourceLanguage: true,
  targetLanguage: true,
  originalText: true,
  translatedText: true,
  latency: true,
});

export const transcripts = pgTable("transcripts", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  language: text("language").notNull(),
  text: text("text").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertTranscriptSchema = createInsertSchema(transcripts).pick({
  sessionId: true,
  language: true,
  text: true,
});

// Persistent memory for the AI assistant
export const memory = pgTable("memory", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  category: text("category").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertMemorySchema = createInsertSchema(memory).pick({
  key: true,
  value: true,
  category: true,
});

// Conversation history
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  userMessage: text("user_message").notNull(),
  assistantMessage: text("assistant_message").notNull(),
  context: jsonb("context"),
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  sessionId: true,
  userMessage: true,
  assistantMessage: true,
  context: true,
});

// Project configuration
export const configuration = pgTable("configuration", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertConfigurationSchema = createInsertSchema(configuration).pick({
  name: true,
  value: true,
});

// Project assets (PDFs, images, markdown files, etc.)
export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull().unique(),
  filetype: varchar("filetype", { length: 50 }).notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const insertAssetSchema = createInsertSchema(assets).pick({
  filename: true,
  filetype: true,
  content: true,
  metadata: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Language = typeof languages.$inferSelect;
export type InsertLanguage = z.infer<typeof insertLanguageSchema>;

export type Translation = typeof translations.$inferSelect;
export type InsertTranslation = z.infer<typeof insertTranslationSchema>;

export type Transcript = typeof transcripts.$inferSelect;
export type InsertTranscript = z.infer<typeof insertTranscriptSchema>;

export type Memory = typeof memory.$inferSelect;
export type InsertMemory = z.infer<typeof insertMemorySchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Configuration = typeof configuration.$inferSelect;
export type InsertConfiguration = z.infer<typeof insertConfigurationSchema>;

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
