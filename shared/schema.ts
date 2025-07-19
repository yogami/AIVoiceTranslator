import { pgTable, text, serial, integer, boolean, timestamp, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const languages = pgTable('languages', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  isActive: boolean('is_active').default(true),
});

export const insertLanguageSchema = createInsertSchema(languages).pick({
  code: true,
  name: true,
  isActive: true,
});

export const translations = pgTable('translations', {
  id: serial('id').primaryKey(),
  sourceLanguage: varchar('source_language', { length: 10 }).notNull(),
  targetLanguage: varchar('target_language', { length: 10 }).notNull(),
  originalText: text('original_text').notNull(),
  translatedText: text('translated_text').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
  sessionId: varchar('session_id', { length: 255 }),
  latency: integer('latency'),
});

export const insertTranslationSchema = createInsertSchema(translations);

export const transcripts = pgTable('transcripts', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  language: text('language').notNull(),
  text: text('text').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
});

export const insertTranscriptSchema = createInsertSchema(transcripts).pick({
  sessionId: true,
  language: true,
  text: true,
});

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull().unique(),
  teacherId: text('teacher_id'), // Optional during transition, will be populated by authenticated users
  classCode: text('class_code'), // Generated at session creation, temporarily nullable during migration
  teacherLanguage: text('teacher_language'),
  studentLanguage: text('student_language'),
  startTime: timestamp('start_time').defaultNow(),
  endTime: timestamp('end_time'),
  studentsCount: integer('students_count').default(0),
  totalTranslations: integer('total_translations').default(0),
  averageLatency: integer('average_latency'),
  isActive: boolean('is_active').default(true),
  quality: text('quality', { enum: ['unknown', 'real', 'no_students', 'no_activity', 'too_short'] }).default('unknown'),
  qualityReason: text('quality_reason'),
  lastActivityAt: timestamp('last_activity_at'),
});

export const insertSessionSchema = createInsertSchema(sessions);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Language = typeof languages.$inferSelect;
export type InsertLanguage = z.infer<typeof insertLanguageSchema>;

export type Translation = typeof translations.$inferSelect;
export type InsertTranslation = typeof translations.$inferInsert;

export type Transcript = typeof transcripts.$inferSelect;
export type InsertTranscript = z.infer<typeof insertTranscriptSchema>;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;
