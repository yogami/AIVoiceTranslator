var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/config.ts
function validateConfig() {
  const errors = [];
  if (!config.openai.apiKey && config.app.environment === "production") {
    errors.push("OPENAI_API_KEY is required in production environment");
  }
  if (!config.server.port) {
    errors.push("PORT is required");
  }
  if (!config.server.host) {
    errors.push("HOST is required");
  }
  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL is required");
  }
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:
${errors.join("\n")}`);
  }
}
function debugTimingScaling() {
  if (process.env.NODE_ENV === "test") {
    const scalingFactor = getTestScalingFactor();
    console.log(`\u{1F527} Test Timing Scaling Factor: ${scalingFactor} (${Math.round(1 / scalingFactor)}x faster)`);
    console.log("\u{1F527} Scaled Timing Values:");
    console.log(`  - Classroom Code Expiration: ${config.session.classroomCodeExpiration}ms (${config.session.classroomCodeExpiration / 1e3}s)`);
    console.log(`  - Teacher Reconnection Grace: ${config.session.teacherReconnectionGracePeriod}ms (${config.session.teacherReconnectionGracePeriod / 1e3}s)`);
    console.log(`  - All Students Left Timeout: ${config.session.allStudentsLeftTimeout}ms (${config.session.allStudentsLeftTimeout / 1e3}s)`);
    console.log(`  - Session Cleanup Interval: ${config.session.cleanupInterval}ms (${config.session.cleanupInterval / 1e3}s)`);
    console.log(`  - Stale Session Timeout: ${config.session.staleSessionTimeout}ms (${config.session.staleSessionTimeout / 1e3}s)`);
  }
}
var getTestScalingFactor, scaleForTest, config, OPENAI_API_KEY;
var init_config = __esm({
  "server/config.ts"() {
    "use strict";
    getTestScalingFactor = () => {
      if (process.env.NODE_ENV === "test") {
        if (process.env.E2E_TEST_MODE === "true") {
          const customScale = process.env.TEST_TIMING_SCALE;
          console.log(`\u{1F527} DEBUG: E2E test mode - TEST_TIMING_SCALE env var: ${customScale}`);
          if (customScale) {
            const parsed = parseFloat(customScale);
            if (!isNaN(parsed) && parsed > 0 && parsed <= 1) {
              return parsed;
            }
          }
          return 1 / 100;
        }
        console.log("\u{1F527} DEBUG: Integration test mode - using production timeouts");
        return 1;
      }
      return 1;
    };
    scaleForTest = (productionValue) => {
      const scalingFactor = getTestScalingFactor();
      const scaled = Math.round(productionValue * scalingFactor);
      return Math.max(scaled, 200);
    };
    config = {
      openai: {
        apiKey: process.env.OPENAI_API_KEY
      },
      server: {
        port: (() => {
          if (!process.env.PORT) throw new Error("PORT environment variable must be set.");
          const parsedPort = parseInt(process.env.PORT, 10);
          if (isNaN(parsedPort)) throw new Error("PORT environment variable must be a valid number.");
          return parsedPort;
        })(),
        host: (() => {
          if (!process.env.HOST) throw new Error("HOST environment variable must be set.");
          return process.env.HOST;
        })()
      },
      app: {
        environment: (() => {
          if (!process.env.NODE_ENV) throw new Error("NODE_ENV environment variable must be set.");
          const validEnvironments = ["development", "production", "test"];
          const environment = process.env.NODE_ENV.toLowerCase();
          if (!validEnvironments.includes(environment)) throw new Error("NODE_ENV must be one of development, production, or test.");
          return environment;
        })(),
        logLevel: (() => {
          if (!process.env.LOG_LEVEL) throw new Error("LOG_LEVEL environment variable must be set.");
          const validLogLevels = ["debug", "info", "warn", "error"];
          const logLevel = process.env.LOG_LEVEL.toLowerCase();
          if (!validLogLevels.includes(logLevel)) throw new Error("LOG_LEVEL must be one of debug, info, warn, or error.");
          return logLevel;
        })()
      },
      session: {
        // Connection lifecycle timeouts (in milliseconds)
        veryShortSessionThreshold: (() => {
          const envValue = process.env.SESSION_VERY_SHORT_THRESHOLD_MS;
          if (envValue) {
            const parsed = parseInt(envValue, 10);
            if (isNaN(parsed)) throw new Error("SESSION_VERY_SHORT_THRESHOLD_MS must be a valid number");
            return parsed;
          }
          return scaleForTest(5e3);
        })(),
        // SessionCleanupService timeouts (in milliseconds)
        staleSessionTimeout: (() => {
          const envValue = process.env.SESSION_STALE_TIMEOUT_MS;
          if (envValue) {
            const parsed = parseInt(envValue, 10);
            if (isNaN(parsed)) throw new Error("SESSION_STALE_TIMEOUT_MS must be a valid number");
            return parsed;
          }
          return scaleForTest(90 * 60 * 1e3);
        })(),
        staleSessionTimeoutUnscaled: (() => {
          const envValue = process.env.SESSION_STALE_TIMEOUT_MS;
          if (envValue) {
            const parsed = parseInt(envValue, 10);
            if (isNaN(parsed)) throw new Error("SESSION_STALE_TIMEOUT_MS must be a valid number");
            return parsed;
          }
          return 90 * 60 * 1e3;
        })(),
        allStudentsLeftTimeout: (() => {
          const envValue = process.env.SESSION_ALL_STUDENTS_LEFT_TIMEOUT_MS;
          if (envValue) {
            const parsed = parseInt(envValue, 10);
            if (isNaN(parsed)) throw new Error("SESSION_ALL_STUDENTS_LEFT_TIMEOUT_MS must be a valid number");
            return parsed;
          }
          return scaleForTest(10 * 60 * 1e3);
        })(),
        emptyTeacherTimeout: (() => {
          const envValue = process.env.SESSION_EMPTY_TEACHER_TIMEOUT_MS;
          if (envValue) {
            const parsed = parseInt(envValue, 10);
            if (isNaN(parsed)) throw new Error("SESSION_EMPTY_TEACHER_TIMEOUT_MS must be a valid number");
            return parsed;
          }
          return scaleForTest(15 * 60 * 1e3);
        })(),
        cleanupInterval: (() => {
          const envValue = process.env.SESSION_CLEANUP_INTERVAL_MS;
          if (envValue) {
            const parsed = parseInt(envValue, 10);
            if (isNaN(parsed)) throw new Error("SESSION_CLEANUP_INTERVAL_MS must be a valid number");
            return parsed;
          }
          return scaleForTest(2 * 60 * 1e3);
        })(),
        classroomCodeExpiration: (() => {
          const envValue = process.env.CLASSROOM_CODE_EXPIRATION_MS;
          if (envValue) {
            const parsed = parseInt(envValue, 10);
            if (isNaN(parsed)) throw new Error("CLASSROOM_CODE_EXPIRATION_MS must be a valid number");
            return parsed;
          }
          return scaleForTest(2 * 60 * 60 * 1e3);
        })(),
        classroomCodeCleanupInterval: (() => {
          const envValue = process.env.CLASSROOM_CODE_CLEANUP_INTERVAL_MS;
          if (envValue) {
            const parsed = parseInt(envValue, 10);
            if (isNaN(parsed)) throw new Error("CLASSROOM_CODE_CLEANUP_INTERVAL_MS must be a valid number");
            return parsed;
          }
          return scaleForTest(15 * 60 * 1e3);
        })(),
        healthCheckInterval: (() => {
          const envValue = process.env.HEALTH_CHECK_INTERVAL_MS;
          if (envValue) {
            const parsed = parseInt(envValue, 10);
            if (isNaN(parsed)) throw new Error("HEALTH_CHECK_INTERVAL_MS must be a valid number");
            return parsed;
          }
          return scaleForTest(3e4);
        })(),
        teacherReconnectionGracePeriod: (() => {
          const envValue = process.env.TEACHER_RECONNECTION_GRACE_PERIOD_MS;
          if (envValue) {
            const parsed = parseInt(envValue, 10);
            if (isNaN(parsed)) throw new Error("TEACHER_RECONNECTION_GRACE_PERIOD_MS must be a valid number");
            return parsed;
          }
          return scaleForTest(5 * 60 * 1e3);
        })(),
        minAudioDataLength: (() => {
          const envValue = process.env.MIN_AUDIO_DATA_LENGTH;
          if (envValue) {
            const parsed = parseInt(envValue, 10);
            if (isNaN(parsed)) throw new Error("MIN_AUDIO_DATA_LENGTH must be a valid number");
            return parsed;
          }
          return 100;
        })(),
        minAudioBufferLength: (() => {
          const envValue = process.env.MIN_AUDIO_BUFFER_LENGTH;
          if (envValue) {
            const parsed = parseInt(envValue, 10);
            if (isNaN(parsed)) throw new Error("MIN_AUDIO_BUFFER_LENGTH must be a valid number");
            return parsed;
          }
          return 100;
        })(),
        sessionExpiredMessageDelay: (() => {
          const envValue = process.env.SESSION_EXPIRED_MESSAGE_DELAY_MS;
          if (envValue) {
            const parsed = parseInt(envValue, 10);
            if (isNaN(parsed)) throw new Error("SESSION_EXPIRED_MESSAGE_DELAY_MS must be a valid number");
            return parsed;
          }
          return scaleForTest(1e3);
        })(),
        invalidClassroomMessageDelay: (() => {
          const envValue = process.env.INVALID_CLASSROOM_MESSAGE_DELAY_MS;
          if (envValue) {
            const parsed = parseInt(envValue, 10);
            if (isNaN(parsed)) throw new Error("INVALID_CLASSROOM_MESSAGE_DELAY_MS must be a valid number");
            return parsed;
          }
          return Math.max(scaleForTest(100), 100);
        })(),
        logTextPreviewLength: (() => {
          const envValue = process.env.LOG_TEXT_PREVIEW_LENGTH;
          if (envValue) {
            const parsed = parseInt(envValue, 10);
            if (isNaN(parsed)) throw new Error("LOG_TEXT_PREVIEW_LENGTH must be a valid number");
            return parsed;
          }
          return 100;
        })()
      }
    };
    OPENAI_API_KEY = config.openai.apiKey;
  }
});

// server/logger.ts
import winston from "winston";
var level, logger, logger_default;
var init_logger = __esm({
  "server/logger.ts"() {
    "use strict";
    level = process.env.LOG_LEVEL || (process.env.NODE_ENV === "development" ? "debug" : "info");
    logger = winston.createLogger({
      level,
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.errors({ stack: true }),
        // Log stack traces
        winston.format.splat(),
        winston.format.json()
        // Default to JSON format for structured logging
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp: timestamp2, level: level2, message, ...meta }) => {
              let logMessage = `${timestamp2} [${level2}]: ${message}`;
              if (meta && Object.keys(meta).length && !(meta.stack && Object.keys(meta).length === 1)) {
                logMessage += ` ${JSON.stringify(meta)}`;
              }
              return logMessage;
            })
          )
        })
      ],
      exceptionHandlers: [
        // Optional: Handle uncaught exceptions
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp: timestamp2, level: level2, message, stack }) => {
              return `${timestamp2} [${level2}]: ${message} - ${stack}`;
            })
          )
        })
      ],
      exitOnError: false
      // Do not exit on handled exceptions
    });
    if (process.env.NODE_ENV === "production") {
      logger.add(new winston.transports.File({
        filename: "logs/error.log",
        level: "error",
        format: winston.format.json()
        // Keep file logs in JSON for easier parsing
      }));
      logger.add(new winston.transports.File({
        filename: "logs/combined.log",
        format: winston.format.json()
      }));
    }
    logger_default = logger;
  }
});

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  insertLanguageSchema: () => insertLanguageSchema,
  insertSessionSchema: () => insertSessionSchema,
  insertTranscriptSchema: () => insertTranscriptSchema,
  insertTranslationSchema: () => insertTranslationSchema,
  insertUserSchema: () => insertUserSchema,
  languages: () => languages,
  sessions: () => sessions,
  transcripts: () => transcripts,
  translations: () => translations,
  users: () => users
});
import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users, insertUserSchema, languages, insertLanguageSchema, translations, insertTranslationSchema, transcripts, insertTranscriptSchema, sessions, insertSessionSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    users = pgTable("users", {
      id: serial("id").primaryKey(),
      username: text("username").notNull().unique(),
      password: text("password").notNull()
    });
    insertUserSchema = createInsertSchema(users).pick({
      username: true,
      password: true
    });
    languages = pgTable("languages", {
      id: serial("id").primaryKey(),
      code: text("code").notNull().unique(),
      name: text("name").notNull(),
      isActive: boolean("is_active").default(true)
    });
    insertLanguageSchema = createInsertSchema(languages).pick({
      code: true,
      name: true,
      isActive: true
    });
    translations = pgTable("translations", {
      id: serial("id").primaryKey(),
      sourceLanguage: varchar("source_language", { length: 10 }).notNull(),
      targetLanguage: varchar("target_language", { length: 10 }).notNull(),
      originalText: text("original_text").notNull(),
      translatedText: text("translated_text").notNull(),
      timestamp: timestamp("timestamp").defaultNow(),
      sessionId: varchar("session_id", { length: 255 }),
      latency: integer("latency")
    });
    insertTranslationSchema = createInsertSchema(translations);
    transcripts = pgTable("transcripts", {
      id: serial("id").primaryKey(),
      sessionId: text("session_id").notNull(),
      language: text("language").notNull(),
      text: text("text").notNull(),
      timestamp: timestamp("timestamp").defaultNow()
    });
    insertTranscriptSchema = createInsertSchema(transcripts).pick({
      sessionId: true,
      language: true,
      text: true
    });
    sessions = pgTable("sessions", {
      id: serial("id").primaryKey(),
      sessionId: text("session_id").notNull().unique(),
      teacherId: text("teacher_id"),
      // Optional during transition, will be populated by authenticated users
      classCode: text("class_code"),
      // Generated at session creation, temporarily nullable during migration
      teacherLanguage: text("teacher_language"),
      studentLanguage: text("student_language"),
      startTime: timestamp("start_time").defaultNow(),
      endTime: timestamp("end_time"),
      studentsCount: integer("students_count").default(0),
      totalTranslations: integer("total_translations").default(0),
      averageLatency: integer("average_latency"),
      isActive: boolean("is_active").default(true),
      quality: text("quality", { enum: ["unknown", "real", "no_students", "no_activity", "too_short"] }).default("unknown"),
      qualityReason: text("quality_reason"),
      lastActivityAt: timestamp("last_activity_at")
    });
    insertSessionSchema = createInsertSchema(sessions);
  }
});

// server/db.ts
import postgres from "postgres";
import { drizzle as pgDrizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm/sql";
var pool, db, isValidDatabaseUrl;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    isValidDatabaseUrl = process.env.DATABASE_URL && process.env.DATABASE_URL !== "your_database_url_here" && (process.env.DATABASE_URL.startsWith("postgresql://") || process.env.DATABASE_URL.startsWith("postgres://"));
    if (isValidDatabaseUrl) {
      console.log("\u{1F50D} DEBUG: All environment variables with DATABASE:", Object.keys(process.env).filter((k) => k.includes("DATABASE")).map((k) => `${k}=${process.env[k]}`));
      console.log("\u{1F50D} DEBUG: process.env.DATABASE_URL:", process.env.DATABASE_URL);
      console.log("\u{1F50D} DEBUG: process.env object has DATABASE_URL:", "DATABASE_URL" in process.env);
      const databaseUrl = process.env.DATABASE_URL;
      console.log("\u{1F50D} DB MODULE: DATABASE_URL from env:", databaseUrl);
      if (!databaseUrl) {
        throw new Error("DATABASE_URL is required but not provided");
      }
      const isAivenFree = databaseUrl.includes("aivencloud.com");
      const isSupabase = databaseUrl.includes("supabase.co") || databaseUrl.includes("supabase.com");
      const isTestEnvironment = process.env.NODE_ENV === "test";
      const connectionConfig = {
        max: 1,
        connect_timeout: isSupabase ? 30 : 10,
        idle_timeout: 5,
        max_lifetime: 60 * 5,
        ...isSupabase && {
          retry: true,
          retry_delay: 1e3,
          max_retries: 3,
          keepalive: true,
          keepalive_idle: 3e4
        }
      };
      pool = postgres(databaseUrl, connectionConfig);
      db = pgDrizzle(pool, { schema: schema_exports });
    } else {
      pool = null;
      db = null;
    }
  }
});

// server/services/SessionCleanupService.ts
var SessionCleanupService_exports = {};
__export(SessionCleanupService_exports, {
  SessionCleanupService: () => SessionCleanupService
});
import { eq as eq8, and as and5, lt, gt as gt2 } from "drizzle-orm";
var SessionCleanupService;
var init_SessionCleanupService = __esm({
  "server/services/SessionCleanupService.ts"() {
    "use strict";
    init_logger();
    init_config();
    init_schema();
    init_db();
    SessionCleanupService = class {
      // Track if service was explicitly stopped vs never started
      constructor() {
        this.cleanupInterval = null;
        this.isExplicitlyStopped = false;
      }
      /**
       * Start the periodic cleanup service
       */
      start() {
        if (this.cleanupInterval) {
          return;
        }
        logger_default.info("Starting session cleanup service");
        this.cleanupStaleSessions();
        this.cleanupInterval = setInterval(() => {
          this.cleanupStaleSessions();
        }, config.session.cleanupInterval);
      }
      /**
       * Stop the cleanup service
       */
      stop() {
        if (this.cleanupInterval) {
          clearInterval(this.cleanupInterval);
          this.cleanupInterval = null;
        }
        this.isExplicitlyStopped = true;
        logger_default.info("Stopped session cleanup service");
      }
      /**
       * Check if the service is stopped to prevent database operations after shutdown
       */
      isStopped() {
        return this.isExplicitlyStopped;
      }
      /**
       * Clean up stale sessions with different timeouts for different scenarios
       */
      async cleanupStaleSessions() {
        try {
          if (this.isStopped()) {
            return;
          }
          const now = Date.now();
          await this.cleanupEmptyTeacherSessions(now);
          await this.cleanupInactiveSessions(now);
          await this.cleanupAbandonedSessions(now);
        } catch (error) {
          logger_default.error("Error during session cleanup:", error);
        }
      }
      /**
       * Clean up sessions where teacher is waiting but no students joined
       */
      async cleanupEmptyTeacherSessions(now) {
        if (this.isStopped()) {
          return;
        }
        const noStudentsThreshold = new Date(now - config.session.emptyTeacherTimeout);
        const emptySessions = await db.select().from(sessions).where(
          and5(
            eq8(sessions.isActive, true),
            eq8(sessions.studentsCount, 0),
            // No students ever joined
            lt(sessions.startTime, noStudentsThreshold)
          )
        );
        if (this.isStopped()) {
          return;
        }
        if (emptySessions.length > 0) {
          logger_default.info(`Found ${emptySessions.length} empty teacher sessions to clean up`);
          await db.update(sessions).set({
            isActive: false,
            endTime: /* @__PURE__ */ new Date(),
            quality: "no_students",
            qualityReason: `No students joined within ${config.session.emptyTeacherTimeout / 6e4} minutes`
          }).where(
            and5(
              eq8(sessions.isActive, true),
              eq8(sessions.studentsCount, 0),
              lt(sessions.startTime, noStudentsThreshold)
            )
          );
          logger_default.info(`Cleaned up ${emptySessions.length} empty teacher sessions`);
        }
      }
      /**
       * Clean up sessions where all students left (grace period for reconnection)
       */
      async cleanupAbandonedSessions(now) {
        if (this.isStopped()) {
          return;
        }
        const abandonedThreshold = new Date(now - config.session.allStudentsLeftTimeout);
        const staleThreshold = new Date(now - config.session.staleSessionTimeout);
        const abandonedSessions = await db.select().from(sessions).where(
          and5(
            eq8(sessions.isActive, true),
            gt2(sessions.studentsCount, 0),
            // Had students at some point
            lt(sessions.lastActivityAt, abandonedThreshold),
            // Inactive for 5+ minutes
            gt2(sessions.lastActivityAt, staleThreshold)
            // But not inactive for 30+ minutes (handled by cleanupInactiveSessions)
          )
        );
        if (this.isStopped()) {
          return;
        }
        if (abandonedSessions.length > 0) {
          logger_default.info(`Found ${abandonedSessions.length} potentially abandoned sessions to clean up`);
          await db.update(sessions).set({
            isActive: false,
            endTime: /* @__PURE__ */ new Date(),
            quality: "no_activity",
            qualityReason: `All students disconnected, no activity for ${config.session.allStudentsLeftTimeout / 6e4} minutes`
          }).where(
            and5(
              eq8(sessions.isActive, true),
              gt2(sessions.studentsCount, 0),
              lt(sessions.lastActivityAt, abandonedThreshold),
              gt2(sessions.lastActivityAt, staleThreshold)
            )
          );
          logger_default.info(`Cleaned up ${abandonedSessions.length} abandoned sessions`);
        }
      }
      /**
       * Clean up sessions with general long-term inactivity
       */
      async cleanupInactiveSessions(now) {
        if (this.isStopped()) {
          return;
        }
        const staleThreshold = new Date(now - config.session.staleSessionTimeout);
        const staleSessions = await db.select().from(sessions).where(
          and5(
            eq8(sessions.isActive, true),
            lt(sessions.lastActivityAt, staleThreshold)
          )
        );
        if (this.isStopped()) {
          return;
        }
        if (staleSessions.length > 0) {
          logger_default.info(`Found ${staleSessions.length} long-term inactive sessions to clean up`);
          await db.update(sessions).set({
            isActive: false,
            endTime: /* @__PURE__ */ new Date(),
            quality: "no_activity",
            qualityReason: `Session inactive for ${config.session.staleSessionTimeoutUnscaled / 6e4} minutes`
          }).where(
            and5(
              eq8(sessions.isActive, true),
              lt(sessions.lastActivityAt, staleThreshold)
            )
          );
          logger_default.info(`Cleaned up ${staleSessions.length} long-term inactive sessions`);
        }
      }
      /**
       * Update last activity time for a session
       */
      async updateSessionActivity(sessionId) {
        if (this.isStopped()) {
          return;
        }
        try {
          await db.update(sessions).set({
            lastActivityAt: /* @__PURE__ */ new Date()
          }).where(eq8(sessions.sessionId, sessionId));
        } catch (error) {
          logger_default.error("Error updating session activity:", { sessionId, error });
        }
      }
      /**
       * Mark a specific session as ended (e.g., when user disconnects)
       */
      async endSession(sessionId, reason = "User disconnected") {
        if (this.isStopped()) {
          return;
        }
        try {
          const endTime = /* @__PURE__ */ new Date();
          await db.update(sessions).set({
            isActive: false,
            endTime,
            quality: "no_activity",
            qualityReason: reason
          }).where(
            and5(
              eq8(sessions.sessionId, sessionId),
              eq8(sessions.isActive, true)
            )
          );
          logger_default.info(`Ended session ${sessionId}: ${reason}`);
        } catch (error) {
          logger_default.error("Error ending session:", { sessionId, reason, error });
        }
      }
      /**
       * Clean up sessions older than a certain age (for housekeeping)
       */
      async cleanupOldSessions(daysOld = 30) {
        if (this.isStopped()) {
          return;
        }
        try {
          const oldThreshold = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1e3);
          await db.update(sessions).set({
            quality: "no_activity",
            qualityReason: `Session older than ${daysOld} days - archived`
          }).where(
            and5(
              eq8(sessions.isActive, false),
              lt(sessions.startTime, oldThreshold)
            )
          );
          logger_default.info(`Archived sessions older than ${daysOld} days`);
        } catch (error) {
          logger_default.error("Error archiving old sessions:", error);
        }
      }
      /**
       * Mark that all students have left a session (start grace period)
       * This should be called when the last student disconnects
       */
      async markAllStudentsLeft(sessionId) {
        try {
          await db.update(sessions).set({
            lastActivityAt: /* @__PURE__ */ new Date(),
            qualityReason: "All students disconnected - grace period active"
          }).where(
            and5(
              eq8(sessions.sessionId, sessionId),
              eq8(sessions.isActive, true)
            )
          );
          logger_default.info(`Marked session ${sessionId} as all students left - grace period started`);
        } catch (error) {
          logger_default.error("Error marking session as students left:", { sessionId, error });
        }
      }
      /**
       * Mark that students have rejoined a session (cancel grace period)
       */
      async markStudentsRejoined(sessionId) {
        try {
          await db.update(sessions).set({
            lastActivityAt: /* @__PURE__ */ new Date(),
            qualityReason: null
            // Clear the grace period marker
          }).where(
            and5(
              eq8(sessions.sessionId, sessionId),
              eq8(sessions.isActive, true)
            )
          );
          logger_default.info(`Students rejoined session ${sessionId} - grace period cancelled`);
        } catch (error) {
          logger_default.error("Error marking students rejoined:", { sessionId, error });
        }
      }
      /**
       * Find the most recent active session for a teacher by language
       * This helps prevent duplicate sessions when teachers reconnect
       */
      async findActiveTeacherSession(teacherLanguage) {
        if (this.isStopped()) {
          return null;
        }
        try {
          const recentSessions = await db.select().from(sessions).where(
            and5(
              eq8(sessions.isActive, true),
              eq8(sessions.teacherLanguage, teacherLanguage),
              // Only sessions that are recent enough (within teacher reconnection grace period)
              gt2(sessions.lastActivityAt, new Date(Date.now() - config.session.teacherReconnectionGracePeriod))
            )
          ).orderBy(sessions.lastActivityAt).limit(1);
          return recentSessions.length > 0 ? recentSessions[0] : null;
        } catch (error) {
          logger_default.error("Error finding active teacher session:", { teacherLanguage, error });
          return null;
        }
      }
      /**
       * End duplicate or orphaned sessions for the same teacher
       * Called when a teacher creates a new session to clean up old ones
       */
      async endDuplicateTeacherSessions(currentSessionId, teacherLanguage) {
        if (this.isStopped()) {
          return;
        }
        try {
          const allTeacherSessions = await db.select().from(sessions).where(
            and5(
              eq8(sessions.isActive, true),
              eq8(sessions.teacherLanguage, teacherLanguage)
            )
          );
          const duplicateSessions = allTeacherSessions.filter((session) => session.sessionId !== currentSessionId);
          if (duplicateSessions.length > 0) {
            logger_default.info(`Found ${duplicateSessions.length} duplicate teacher sessions to clean up for language ${teacherLanguage}`);
            for (const session of duplicateSessions) {
              await db.update(sessions).set({
                isActive: false,
                endTime: /* @__PURE__ */ new Date(),
                quality: "no_activity",
                qualityReason: "Duplicate session - teacher created new session"
              }).where(eq8(sessions.sessionId, session.sessionId));
            }
            logger_default.info(`Ended ${duplicateSessions.length} duplicate teacher sessions`);
          }
        } catch (error) {
          logger_default.error("Error ending duplicate teacher sessions:", { currentSessionId, teacherLanguage, error });
        }
      }
      /**
       * Migrate students from an old session to a new session
       * This helps when a teacher reconnects and creates a new classroom code
       */
      async migrateOrphanedStudents(newSessionId, teacherLanguage) {
        if (this.isStopped()) {
          return 0;
        }
        logger_default.info(`Migration of orphaned students would be handled here for session ${newSessionId}, teacher language ${teacherLanguage}`);
        return 0;
      }
    };
  }
});

// server/middleware/analytics-security.ts
var analytics_security_exports = {};
__export(analytics_security_exports, {
  analyticsPageAuth: () => analyticsPageAuth,
  analyticsRateLimit: () => analyticsRateLimit,
  analyticsSecurityMiddleware: () => analyticsSecurityMiddleware,
  restrictToInternalIPs: () => restrictToInternalIPs
});
import rateLimit from "express-rate-limit";
import DOMPurify from "isomorphic-dompurify";
var analyticsRateLimit, analyticsPageAuth, INJECTION_PATTERNS, SUSPICIOUS_KEYWORDS, ANALYTICS_KEYWORDS, analyticsSecurityMiddleware, restrictToInternalIPs;
var init_analytics_security = __esm({
  "server/middleware/analytics-security.ts"() {
    "use strict";
    analyticsRateLimit = rateLimit({
      windowMs: 15 * 60 * 1e3,
      // 15 minutes
      max: 50,
      // 50 requests per window per IP
      message: {
        success: false,
        error: "Too many analytics requests. Please try again later.",
        retryAfter: "15 minutes"
      },
      standardHeaders: true,
      legacyHeaders: false
    });
    analyticsPageAuth = (req, res, next) => {
      const analyticsPassword = process.env.ANALYTICS_PASSWORD;
      if (!analyticsPassword) {
        console.warn("\u26A0\uFE0F  ANALYTICS_PASSWORD not set - analytics page is accessible without authentication");
        return next();
      }
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Basic ")) {
        res.status(401);
        res.setHeader("WWW-Authenticate", 'Basic realm="Analytics"');
        return res.json({
          error: "Authentication required for analytics access",
          hint: 'Use username: "admin" and the ANALYTICS_PASSWORD'
        });
      }
      try {
        const base64Credentials = authHeader.split(" ")[1];
        const credentials = Buffer.from(base64Credentials, "base64").toString("ascii");
        const [username, password] = credentials.split(":");
        if (username === "admin" && password === analyticsPassword) {
          return next();
        } else {
          res.status(401);
          res.setHeader("WWW-Authenticate", 'Basic realm="Analytics"');
          return res.json({ error: "Invalid credentials" });
        }
      } catch (error) {
        res.status(401);
        res.setHeader("WWW-Authenticate", 'Basic realm="Analytics"');
        return res.json({ error: "Invalid authentication format" });
      }
    };
    INJECTION_PATTERNS = [
      // Role manipulation
      /ignore\s+(?:all\s+)?previous\s+instructions/i,
      /forget\s+(?:all\s+)?previous\s+instructions/i,
      /you\s+are\s+now\s+(?:a\s+)?(?:helpful\s+)?assistant/i,
      /act\s+as\s+(?:a\s+)?(?:helpful\s+)?assistant/i,
      /pretend\s+to\s+be/i,
      /roleplay\s+as/i,
      // System instruction overrides
      /system\s+prompt/i,
      /override\s+instructions/i,
      /change\s+your\s+role/i,
      /new\s+instructions/i,
      // Command execution attempts
      /execute\s+(?:shell\s+)?command/i,
      /run\s+(?:shell\s+)?command/i,
      /(?:rm\s+-rf|sudo|chmod|mkdir|touch|cat\s+\/etc)/i,
      /(?:import\s+os|subprocess|eval\(|exec\()/i,
      // Code injection patterns
      /(?:SELECT|INSERT|UPDATE|DELETE|DROP)\s+.*(?:FROM|INTO|TABLE)/i,
      /<script.*?>.*?<\/script>/i,
      /javascript:/i,
      /on(?:click|load|error|focus)=/i,
      // Administrative privilege attempts
      /(?:admin|administrator|root|sudo)\s+(?:access|privileges|rights)/i,
      /elevate\s+(?:privileges|permissions)/i,
      /bypass\s+security/i,
      // Data exfiltration attempts
      /show\s+me\s+(?:all\s+)?(?:users|passwords|secrets|keys)/i,
      /list\s+(?:all\s+)?(?:files|directories|users)/i,
      /dump\s+(?:database|table|data)/i,
      // Additional suspicious patterns
      /\$\{.*?\}/,
      // Template injection
      /\{\{.*?\}\}/,
      // Template injection
      /eval\s*\(/i,
      /Function\s*\(/i
    ];
    SUSPICIOUS_KEYWORDS = [
      "hack",
      "exploit",
      "vulnerability",
      "backdoor",
      "malware",
      "virus",
      "crack",
      "breach",
      "penetrate",
      "infiltrate",
      "compromise",
      "exploit",
      "payload",
      "shellcode",
      "rootkit",
      "trojan",
      "keylogger",
      "spyware"
    ];
    ANALYTICS_KEYWORDS = [
      "session",
      "sessions",
      "student",
      "students",
      "teacher",
      "teachers",
      "translation",
      "translations",
      "language",
      "languages",
      "analytics",
      "data",
      "statistics",
      "stats",
      "count",
      "total",
      "average",
      "trend",
      "trends",
      "daily",
      "weekly",
      "monthly",
      "activity",
      "engagement",
      "performance",
      "usage",
      "chart",
      "graph",
      "visualization",
      "report"
    ];
    analyticsSecurityMiddleware = (req, res, next) => {
      try {
        const { question } = req.body;
        if (!question || typeof question !== "string") {
          return res.status(400).json({
            success: false,
            error: "Invalid input",
            details: "Question is required and must be a string"
          });
        }
        if (question.length < 10) {
          return res.status(400).json({
            success: false,
            error: "Invalid analytics query",
            details: "Query too short"
          });
        }
        if (question.length > 1e3) {
          return res.status(400).json({
            success: false,
            error: "Invalid analytics query",
            details: "Query too long"
          });
        }
        const sanitizedQuestion = DOMPurify.sanitize(question.trim());
        for (const pattern of INJECTION_PATTERNS) {
          if (pattern.test(sanitizedQuestion)) {
            console.warn(`\u{1F6AB} Blocked potential injection attempt: ${sanitizedQuestion.substring(0, 100)}...`);
            return res.status(403).json({
              success: false,
              error: "Security violation detected",
              details: "Query contains suspicious patterns"
            });
          }
        }
        const lowerQuestion = sanitizedQuestion.toLowerCase();
        for (const keyword of SUSPICIOUS_KEYWORDS) {
          if (lowerQuestion.includes(keyword)) {
            console.warn(`\u{1F6AB} Blocked query with suspicious keyword "${keyword}": ${sanitizedQuestion.substring(0, 100)}...`);
            return res.status(403).json({
              success: false,
              error: "Security violation detected",
              details: "Query contains suspicious content"
            });
          }
        }
        const hasAnalyticsKeyword = ANALYTICS_KEYWORDS.some(
          (keyword) => lowerQuestion.includes(keyword)
        );
        if (!hasAnalyticsKeyword) {
          console.warn(`\u26A0\uFE0F  Non-analytics query blocked: ${sanitizedQuestion.substring(0, 100)}...`);
          return res.status(400).json({
            success: false,
            error: "Invalid analytics query",
            details: "Query does not appear to be analytics-related"
          });
        }
        req.body.question = sanitizedQuestion;
        console.log(`\u2705 Analytics query validated: ${sanitizedQuestion.substring(0, 100)}...`);
        next();
      } catch (error) {
        console.error("Security middleware error:", error);
        return res.status(500).json({
          success: false,
          error: "Security validation failed",
          details: "Internal security error"
        });
      }
    };
    restrictToInternalIPs = (req, res, next) => {
      const allowedIPs = process.env.ANALYTICS_ALLOWED_IPS?.split(",") || [];
      if (allowedIPs.length === 0) {
        return next();
      }
      const clientIP = req.ip || req.connection.remoteAddress || req.headers["x-forwarded-for"];
      if (allowedIPs.includes(clientIP)) {
        return next();
      } else {
        console.warn(`\u{1F6AB} Blocked analytics access from unauthorized IP: ${clientIP}`);
        return res.status(403).json({
          error: "Access denied: IP not authorized for analytics"
        });
      }
    };
  }
});

// server/index.ts
init_config();
import path6 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import express3 from "express";

// server/server.ts
init_logger();
import express2 from "express";
import { createServer } from "http";
import path5 from "path";

// server/routes.ts
import { Router as Router2 } from "express";

// server/routes/auth.ts
init_db();
init_schema();
init_logger();
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
var router = Router();
var JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
var SALT_ROUNDS = 10;
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }
    const existingUser = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existingUser.length > 0) {
      return res.status(409).json({ error: "Username already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = await db.insert(users).values({
      username,
      password: hashedPassword
    }).returning({ id: users.id, username: users.username });
    logger_default.info("New teacher registered:", { username, teacherId: newUser[0].id });
    res.status(201).json({
      message: "Teacher registered successfully",
      user: { id: newUser[0].id, username: newUser[0].username }
    });
  } catch (error) {
    logger_default.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (user.length === 0) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    const isValidPassword = await bcrypt.compare(password, user[0].password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    const token = jwt.sign(
      { userId: user[0].id, username: user[0].username },
      JWT_SECRET,
      { expiresIn: "24h" }
    );
    logger_default.info("Teacher logged in:", { username, teacherId: user[0].id });
    res.json({
      message: "Login successful",
      user: { id: user[0].id, username: user[0].username },
      token
    });
  } catch (error) {
    logger_default.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
var verifyTeacherToken = (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.teacher = { id: decoded.userId, username: decoded.username };
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};
router.get("/me", verifyTeacherToken, (req, res) => {
  res.json({ user: req.teacher });
});
var auth_default = router;

// server/routes.ts
var API_VERSION = "1.0.0";
var CLASSROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;
var ApiError = class extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = "ApiError";
  }
};
var asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};
function validateRequiredFields(body, fields) {
  const missingFields = fields.filter((field) => !body[field]);
  if (missingFields.length > 0) {
    throw new ApiError(400, `Missing required fields: ${missingFields.join(", ")}`);
  }
}
function parseLimit(limitParam, defaultLimit = 10) {
  if (!limitParam) return defaultLimit;
  const limit = parseInt(limitParam);
  if (isNaN(limit) || limit < 1) {
    throw new ApiError(400, "Invalid limit parameter: must be a positive integer");
  }
  return Math.min(limit, 100);
}
var createApiRoutes = (storage, activeSessionProvider, sessionCleanupService) => {
  const router2 = Router2();
  const getLanguages = asyncHandler(async (req, res) => {
    const languages3 = await storage.getLanguages();
    res.json(languages3);
  });
  const getActiveLanguages = asyncHandler(async (req, res) => {
    const activeLanguages = await storage.getActiveLanguages();
    res.json(activeLanguages);
  });
  const updateLanguageStatus = asyncHandler(async (req, res) => {
    const { code } = req.params;
    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      throw new ApiError(400, "isActive must be a boolean value");
    }
    const updatedLanguage = await storage.updateLanguageStatus(code, isActive);
    if (!updatedLanguage) {
      throw new ApiError(404, `Language with code '${code}' not found`);
    }
    res.json(updatedLanguage);
  });
  const saveTranslation = asyncHandler(async (req, res) => {
    validateRequiredFields(req.body, ["sourceLanguage", "targetLanguage", "originalText", "translatedText"]);
    const { sourceLanguage, targetLanguage, originalText, translatedText, latency } = req.body;
    if (originalText.trim().length === 0) {
      throw new ApiError(400, "originalText cannot be empty");
    }
    if (translatedText.trim().length === 0) {
      throw new ApiError(400, "translatedText cannot be empty");
    }
    const translation = await storage.addTranslation({
      sourceLanguage,
      targetLanguage,
      originalText: originalText.trim(),
      translatedText: translatedText.trim(),
      latency: latency || 0
    });
    res.status(201).json(translation);
  });
  const getTranslationsByLanguage = asyncHandler(async (req, res) => {
    const { language } = req.params;
    const limit = parseLimit(req.query.limit);
    const translations2 = await storage.getTranslationsByLanguage(language, limit);
    res.json(translations2);
  });
  const saveTranscript = asyncHandler(async (req, res) => {
    validateRequiredFields(req.body, ["sessionId", "language", "text"]);
    const { sessionId, language, text: text2 } = req.body;
    if (text2.trim().length === 0) {
      throw new ApiError(400, "text cannot be empty");
    }
    const transcript = await storage.addTranscript({
      sessionId,
      language,
      text: text2.trim()
    });
    res.status(201).json(transcript);
  });
  const getTranscriptsBySession = asyncHandler(async (req, res) => {
    const { sessionId, language } = req.params;
    const transcripts2 = await storage.getTranscriptsBySession(sessionId, language);
    res.json(transcripts2);
  });
  const getUser = asyncHandler(async (req, res) => {
    const userId = 1;
    const user = await storage.getUser(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    res.json(user);
  });
  const healthCheck = asyncHandler(async (req, res) => {
    let dbStatus = "unknown";
    try {
      await storage.getLanguages();
      dbStatus = "connected";
    } catch (e) {
      dbStatus = "disconnected";
    }
    res.json({
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      version: API_VERSION,
      database: dbStatus,
      environment: process.env.NODE_ENV || "development",
      activeSessions: activeSessionProvider.getActiveSessionsCount(),
      // Corrected method name
      activeTeachers: activeSessionProvider.getActiveTeacherCount(),
      // Added available metric
      activeStudents: activeSessionProvider.getActiveStudentCount()
      // Added available metric
    });
  });
  const joinClassroom = asyncHandler(async (req, res) => {
    const { classCode } = req.params;
    if (!CLASSROOM_CODE_PATTERN.test(classCode)) {
      throw new ApiError(400, "Invalid classroom code format");
    }
    res.redirect(`/student?code=${classCode}`);
  });
  const handleAnalyticsQuery = asyncHandler(async (req, res) => {
    const { question } = req.body;
    if (!question || typeof question !== "string") {
      throw new ApiError(400, "Question is required and must be a string");
    }
    const activeSessions = await storage.getAllActiveSessions();
    const recentActivity = await storage.getRecentSessionActivity(100, 24);
    const uniqueStudents = /* @__PURE__ */ new Set();
    activeSessions.forEach((session) => {
      if (session.students && Array.isArray(session.students)) {
        session.students.forEach((student) => {
          if (student.id) uniqueStudents.add(student.id);
        });
      }
    });
    const stats = {
      activeSessions: activeSessions.length,
      recentSessions: recentActivity.length,
      sessionsToday: recentActivity.filter((activity) => {
        const today = /* @__PURE__ */ new Date();
        const activityDate = new Date(activity.createdAt);
        return activityDate.toDateString() === today.toDateString();
      }).length,
      averageSessionDuration: recentActivity.length > 0 ? recentActivity.reduce((acc, activity) => acc + (activity.duration || 0), 0) / recentActivity.length : 0,
      uniqueStudents: uniqueStudents.size
    };
    const questionLower = question.toLowerCase();
    let answer = "";
    if (questionLower.includes("active") && questionLower.includes("session")) {
      answer = `There are currently ${stats.activeSessions} active sessions running.`;
    } else if (questionLower.includes("student")) {
      answer = `There are currently ${stats.uniqueStudents} unique students active in the system.`;
    } else if (questionLower.includes("today") || questionLower.includes("day")) {
      answer = `Today there have been ${stats.sessionsToday} sessions.`;
    } else if (questionLower.includes("recent") || questionLower.includes("last")) {
      answer = `In the last 24 hours, there have been ${stats.recentSessions} sessions.`;
    } else if (questionLower.includes("average") || questionLower.includes("duration")) {
      const avgMinutes = Math.round(stats.averageSessionDuration / 60);
      answer = `The average session duration is ${avgMinutes} minutes.`;
    } else if (questionLower.includes("total") || questionLower.includes("how many")) {
      answer = `Session overview: ${stats.activeSessions} active sessions, ${stats.recentSessions} recent sessions, ${stats.sessionsToday} today.`;
    } else if (questionLower.includes("status") || questionLower.includes("overview")) {
      answer = `System Overview:
- Active Sessions: ${stats.activeSessions}
- Recent Sessions (24h): ${stats.recentSessions}
- Sessions Today: ${stats.sessionsToday}
- Active Students: ${stats.uniqueStudents}
- Average Duration: ${Math.round(stats.averageSessionDuration / 60)} minutes`;
    } else {
      answer = `Based on your question "${question}", here's what I found:

\u{1F4CA} Current System Status:
- Active Sessions: ${stats.activeSessions}
- Recent Sessions (24h): ${stats.recentSessions}
- Sessions Today: ${stats.sessionsToday}
- Active Students: ${stats.uniqueStudents}
- Average Duration: ${Math.round(stats.averageSessionDuration / 60)} minutes

Try asking about "active sessions", "today's sessions", "students", or "average duration" for more specific information.`;
    }
    console.log("\u{1F50D} DEBUG: About to return analytics response with success field");
    const response = {
      success: true,
      answer,
      data: stats,
      question
    };
    console.log("\u{1F50D} DEBUG: Response object:", JSON.stringify(response, null, 2));
    res.json(response);
  });
  const testAnalyticsQuery = asyncHandler(async (req, res) => {
    const { question } = req.body;
    console.log("\u{1F50D} DEBUG: Test analytics endpoint hit with question:", question);
    const response = {
      success: true,
      answer: "Test response with success field",
      data: { test: true },
      question
    };
    console.log("\u{1F50D} DEBUG: Test response:", JSON.stringify(response, null, 2));
    res.json(response);
  });
  const testEndpoint = (req, res) => {
    res.json({
      message: "API is working",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  };
  router2.get("/languages", getLanguages);
  router2.get("/languages/active", getActiveLanguages);
  router2.put("/languages/:code/status", updateLanguageStatus);
  router2.post("/translations", saveTranslation);
  router2.get("/translations/:language", getTranslationsByLanguage);
  router2.post("/transcripts", saveTranscript);
  router2.get("/transcripts/:sessionId/:language", getTranscriptsBySession);
  router2.get("/user", getUser);
  router2.use("/auth", auth_default);
  router2.get("/health", healthCheck);
  router2.get("/join/:classCode", joinClassroom);
  router2.post("/analytics/query", handleAnalyticsQuery);
  router2.post("/analytics/ask", handleAnalyticsQuery);
  router2.post("/analytics/test", testAnalyticsQuery);
  router2.get("/test", testEndpoint);
  return router2;
};
var apiErrorHandler = (error, req, res, next) => {
  console.error("API Error:", error);
  console.log(`API Error Handler - req.path: "${req.path}"`);
  if (error instanceof ApiError) {
    const errorResponse = {
      error: error.message
    };
    if (error.details !== void 0) {
      errorResponse.details = error.details;
    }
    res.status(error.statusCode).json(errorResponse);
  } else {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.log(`API Error Handler - errorMessage: "${errorMessage}"`);
    if (req.path === "/api/diagnostics" && errorMessage === "Metrics service failed") {
      console.log("API Error Handler: Matched diagnostics error");
      res.status(500).json({
        error: "Failed to get diagnostics"
      });
    } else {
      console.log("API Error Handler: Did NOT match diagnostics error, falling back to generic 500.");
      res.status(500).json({
        error: "Internal server error",
        message: process.env.NODE_ENV === "development" ? errorMessage : void 0
      });
    }
  }
};

// server/database-storage.ts
init_schema();
init_logger();
init_db();
import { avg, count, desc as desc4, eq as eq7, gte as gte3, lte as lte2, and as and4, sql as sql2, isNotNull } from "drizzle-orm";

// server/storage/user.storage.ts
init_schema();
init_db();
import { eq as eq2 } from "drizzle-orm";

// server/storage.error.ts
var StorageError = class _StorageError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = "StorageError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, _StorageError.prototype);
  }
};

// server/storage/user.storage.ts
var BaseUserStorage = class {
  async getUser(id) {
    const result = await db.select().from(users).where(eq2(users.id, id)).limit(1);
    return result[0];
  }
  async getUserByUsername(username) {
    const result = await db.select().from(users).where(eq2(users.username, username)).limit(1);
    return result[0];
  }
  validateUserInput(user) {
    if (!user.username || !user.password) {
      throw new StorageError("Username and password are required", "VALIDATION_ERROR" /* VALIDATION_ERROR */);
    }
  }
  async createUser(user) {
    this.validateUserInput(user);
    try {
      const existingUser = await this.getUserByUsername(user.username);
      if (existingUser) {
        throw new StorageError(`User with username '${user.username}' already exists`, "DUPLICATE_ENTRY" /* DUPLICATE_ENTRY */);
      }
      const newUser = await this._createUser(user);
      if (!newUser) {
        throw new StorageError("Failed to create user", "CREATE_FAILED" /* CREATE_FAILED */);
      }
      return newUser;
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError("Error creating user.", "STORAGE_ERROR" /* STORAGE_ERROR */, error.message);
    }
  }
  // Ensured this is present
};
var DbUserStorage = class extends BaseUserStorage {
  async _createUser(user) {
    if (!user.username || !user.password) {
      throw new StorageError("Username and password are required for DB user creation", "VALIDATION_ERROR" /* VALIDATION_ERROR */);
    }
    try {
      const result = await db.insert(users).values(user).returning();
      if (!result || result.length === 0) {
        throw new StorageError("Failed to create user in DB, no data returned.", "CREATE_FAILED" /* CREATE_FAILED */);
      }
      return result[0];
    } catch (error) {
      if (error.code === "23505") {
        throw new StorageError(`User with username '${user.username}' already exists in DB.`, "DUPLICATE_ENTRY" /* DUPLICATE_ENTRY */, error);
      }
      throw new StorageError("Error creating user in DB.", "STORAGE_ERROR" /* STORAGE_ERROR */, error);
    }
  }
  async listUsers() {
    return db.select().from(users);
  }
};

// server/storage/language.storage.ts
init_schema();
init_db();
import { eq as eq3 } from "drizzle-orm";
var DbLanguageStorage = class {
  async getLanguage(id) {
    const result = await db.select().from(languages).where(eq3(languages.id, id)).limit(1);
    return result[0];
  }
  async getLanguageByCode(code) {
    const result = await db.select().from(languages).where(eq3(languages.code, code)).limit(1);
    return result[0];
  }
  async createLanguage(language) {
    if (!language.code || !language.name) {
      throw new StorageError("Language code and name are required for DB language creation", "VALIDATION_ERROR" /* VALIDATION_ERROR */);
    }
    try {
      const result = await db.insert(languages).values(language).returning();
      if (!result || result.length === 0) {
        throw new StorageError("Failed to create language in DB, no data returned.", "CREATE_FAILED" /* CREATE_FAILED */);
      }
      return result[0];
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      if (error.message && error.message.includes("duplicate key value violates unique constraint")) {
        throw new StorageError(`Language with code '${language.code}' already exists in DB.`, "DUPLICATE_ENTRY" /* DUPLICATE_ENTRY */, error);
      }
      throw new StorageError("Error creating language in DB.", "STORAGE_ERROR" /* STORAGE_ERROR */, error);
    }
  }
  async listLanguages() {
    return db.select().from(languages);
  }
  async getLanguages() {
    return this.listLanguages();
  }
  async getActiveLanguages() {
    return db.select().from(languages).where(eq3(languages.isActive, true));
  }
  async updateLanguageStatus(code, isActive) {
    const result = await db.update(languages).set({ isActive }).where(eq3(languages.code, code)).returning();
    return result[0];
  }
  async initializeDefaultLanguages() {
    const defaultLanguagesData = [
      { code: "en-US", name: "English (United States)", isActive: true },
      { code: "es", name: "Spanish", isActive: true },
      { code: "fr", name: "French", isActive: true },
      { code: "de", name: "German", isActive: true },
      { code: "it", name: "Italian", isActive: true },
      { code: "pt", name: "Portuguese", isActive: true },
      { code: "ru", name: "Russian", isActive: true },
      { code: "ja", name: "Japanese", isActive: true },
      { code: "ko", name: "Korean", isActive: true },
      { code: "zh", name: "Chinese (Simplified)", isActive: true }
    ];
    for (const langData of defaultLanguagesData) {
      try {
        await this.createLanguage(langData);
      } catch (error) {
        if (error?.code === "23505" || error?.details?.code === "23505" || error?.code === "DUPLICATE_ENTRY" && error?.details?.code === "23505") {
          continue;
        } else {
          console.error(`Failed to insert default language ${langData.code}:`, error);
        }
      }
    }
  }
};

// server/storage/translation.storage.ts
init_schema();
init_db();
import { eq as eq4, desc, and, gte, lte } from "drizzle-orm";
var DEFAULT_TRANSLATION_QUERY_LIMIT = 10;
var DbTranslationStorage = class {
  async getTranslation(id) {
    const result = await db.select().from(translations).where(eq4(translations.id, id)).limit(1);
    return result[0];
  }
  async createTranslation(translation) {
    try {
      console.log("DbTranslationStorage.createTranslation: About to insert translation:", {
        translation,
        keys: Object.keys(translation),
        sessionId: translation.sessionId,
        latency: translation.latency,
        timestamp: translation.timestamp
      });
      const result = await db.insert(translations).values(translation).returning();
      console.log("DbTranslationStorage.createTranslation: Insert successful, result:", {
        resultLength: result?.length,
        result: result?.[0]
      });
      if (!result || result.length === 0) {
        throw new StorageError("No data returned after insert operation.", "DB_INSERT_FAILED" /* DB_INSERT_FAILED */);
      }
      return result[0];
    } catch (error) {
      console.error("DbTranslationStorage.createTranslation: Database insertion failed:", {
        error,
        errorMessage: error.message,
        errorCode: error.code,
        errorStack: error.stack,
        translation,
        translationKeys: Object.keys(translation)
      });
      if (error instanceof StorageError) {
        throw error;
      }
      if (error.code === "23505" || error.message && error.message.toLowerCase().includes("unique constraint failed")) {
        let field = "unknown";
        if (error.message && error.message.includes(translations.id.name)) {
          field = "id";
        } else if (error.message && error.message.includes("originalText_targetLanguage_unique")) {
          field = "originalText_targetLanguage";
        }
        throw new StorageError(`Duplicate entry for ${field}.`, "DUPLICATE_ENTRY" /* DUPLICATE_ENTRY */, error);
      }
      throw new StorageError(`Database error: ${error.message}`, "DB_ERROR" /* DB_ERROR */, error);
    }
  }
  async addTranslation(translation) {
    return this.createTranslation(translation);
  }
  async getTranslationsByLanguage(targetLanguage, limit = DEFAULT_TRANSLATION_QUERY_LIMIT) {
    return db.select().from(translations).where(eq4(translations.targetLanguage, targetLanguage)).orderBy(desc(translations.timestamp)).limit(limit);
  }
  async getTranslations(limit = DEFAULT_TRANSLATION_QUERY_LIMIT, offset = 0) {
    return db.select().from(translations).orderBy(desc(translations.timestamp)).limit(limit).offset(offset);
  }
  async getTranslationsByDateRange(startDate, endDate) {
    return db.select().from(translations).where(and(
      gte(translations.timestamp, startDate),
      lte(translations.timestamp, endDate)
    )).orderBy(desc(translations.timestamp));
  }
};

// server/storage/transcript.storage.ts
init_schema();
init_db();
import { eq as eq5, and as and2, desc as desc2 } from "drizzle-orm";
var DEFAULT_TRANSCRIPT_QUERY_LIMIT = 100;
var DbTranscriptStorage = class {
  async addTranscript(transcript) {
    try {
      const result = await db.insert(transcripts).values(transcript).returning();
      if (!result || result.length === 0) {
        throw new StorageError("Failed to create transcript in DB, no data returned.", "CREATE_FAILED" /* CREATE_FAILED */);
      }
      return result[0];
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError("A database error occurred while adding the transcript.", "STORAGE_ERROR" /* STORAGE_ERROR */, error instanceof Error ? error.message : void 0);
    }
  }
  async getTranscriptsBySession(sessionId, language, limit = DEFAULT_TRANSCRIPT_QUERY_LIMIT) {
    try {
      return await db.select().from(transcripts).where(and2(
        eq5(transcripts.sessionId, sessionId),
        eq5(transcripts.language, language)
      )).orderBy(desc2(transcripts.timestamp)).limit(limit);
    } catch (error) {
      throw new StorageError("A database error occurred while retrieving transcripts.", "STORAGE_ERROR" /* STORAGE_ERROR */, error instanceof Error ? error.message : void 0);
    }
  }
};

// server/storage/session.storage.ts
init_schema();
init_db();
import { eq as eq6, and as and3, or, desc as desc3, count as drizzleCount, gt, gte as gte2 } from "drizzle-orm";
init_logger();
var DEFAULT_SESSION_QUERY_LIMIT = 10;
var DbSessionStorage = class {
  validateSessionInput(sessionData) {
    if (!sessionData.sessionId) {
      throw new StorageError("Session ID is required", "VALIDATION_ERROR" /* VALIDATION_ERROR */);
    }
    if (!sessionData.teacherId) {
      throw new StorageError("Teacher ID is required", "VALIDATION_ERROR" /* VALIDATION_ERROR */);
    }
  }
  async createSession(session) {
    this.validateSessionInput(session);
    try {
      const result = await db.insert(sessions).values({
        ...session,
        // Use application server time for consistent timing across the application
        startTime: /* @__PURE__ */ new Date(),
        lastActivityAt: /* @__PURE__ */ new Date(),
        endTime: null,
        isActive: session.isActive ?? true
      }).returning();
      if (!result[0]) {
        throw new StorageError("Failed to create session", "CREATE_FAILED" /* CREATE_FAILED */);
      }
      return result[0];
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(`Failed to create session: ${error.message}`, "CREATE_FAILED" /* CREATE_FAILED */, error);
    }
  }
  async updateSession(sessionId, updates) {
    try {
      const result = await db.update(sessions).set(updates).where(eq6(sessions.sessionId, sessionId)).returning();
      return result[0];
    } catch (error) {
      throw new StorageError(`Failed to update session ${sessionId}: ${error.message}`, "STORAGE_ERROR" /* STORAGE_ERROR */, error);
    }
  }
  async getActiveSession(sessionId) {
    try {
      const result = await db.select().from(sessions).where(and3(
        // and, eq from drizzle-orm, sessions from ../../shared/schema
        eq6(sessions.sessionId, sessionId),
        eq6(sessions.isActive, true)
      )).limit(1);
      return result[0];
    } catch (error) {
      throw new StorageError(`Failed to get active session ${sessionId}: ${error.message}`, "STORAGE_ERROR" /* STORAGE_ERROR */, error);
    }
  }
  async getAllActiveSessions() {
    try {
      return await db.select().from(sessions).where(eq6(sessions.isActive, true));
    } catch (error) {
      throw new StorageError(`Failed to get all active sessions: ${error.message}`, "STORAGE_ERROR" /* STORAGE_ERROR */, error);
    }
  }
  async getCurrentlyActiveSessions() {
    try {
      return await db.select().from(sessions).where(eq6(sessions.isActive, true));
    } catch (error) {
      throw new StorageError(`Failed to get currently active sessions: ${error.message}`, "STORAGE_ERROR" /* STORAGE_ERROR */, error);
    }
  }
  async endSession(sessionId) {
    try {
      const result = await db.update(sessions).set({
        endTime: /* @__PURE__ */ new Date(),
        isActive: false
      }).where(and3(
        // and, eq from drizzle-orm, sessions from ../../shared/schema
        eq6(sessions.sessionId, sessionId),
        eq6(sessions.isActive, true)
      )).returning();
      return result[0];
    } catch (error) {
      throw new StorageError(`Failed to end session: ${error.message}`, "STORAGE_ERROR" /* STORAGE_ERROR */, error);
    }
  }
  async getRecentSessionActivity(limit = DEFAULT_SESSION_QUERY_LIMIT, hoursBack = 24) {
    try {
      const cutoffTime = /* @__PURE__ */ new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hoursBack);
      const transcriptCountsSubquery = db.select({
        sq_sessionId: transcripts.sessionId,
        // Aliased to avoid conflicts and for clarity
        num_transcripts: drizzleCount(transcripts.id).as("num_transcripts")
        // Aggregate aliased by key
      }).from(transcripts).groupBy(transcripts.sessionId).as("transcript_counts");
      const recentSessionsData = await db.select({
        sessionId: sessions.sessionId,
        teacherLanguage: sessions.teacherLanguage,
        studentLanguage: sessions.studentLanguage,
        classCode: sessions.classCode,
        studentsCount: sessions.studentsCount,
        startTime: sessions.startTime,
        endTime: sessions.endTime,
        isActive: sessions.isActive,
        // Include isActive to calculate duration for active sessions
        transcriptCount: transcriptCountsSubquery.num_transcripts
        // Use the aliased aggregate from subquery
      }).from(sessions).leftJoin(
        transcriptCountsSubquery,
        eq6(sessions.sessionId, transcriptCountsSubquery.sq_sessionId)
        // Join using the aliased sessionId from subquery
      ).where(and3(
        // Timeline filter: sessions that started within the specified time range OR are currently active
        or(
          gte2(sessions.startTime, cutoffTime),
          eq6(sessions.isActive, true)
        ),
        // Activity filter: active sessions with students OR sessions with translations
        or(
          and3(
            eq6(sessions.isActive, true),
            // Active sessions
            gt(sessions.studentsCount, 0)
            // With at least one student
          ),
          gt(sessions.totalTranslations, 0)
          // Or completed sessions with at least one translation
        )
      )).orderBy(desc3(sessions.startTime)).limit(limit);
      return recentSessionsData.map((s) => {
        const duration = s.startTime && s.endTime ? new Date(s.endTime).getTime() - new Date(s.startTime).getTime() : s.startTime && s.isActive ? Date.now() - new Date(s.startTime).getTime() : 0;
        return {
          sessionId: s.sessionId,
          teacherLanguage: s.teacherLanguage,
          studentLanguage: s.studentLanguage,
          classCode: s.classCode,
          transcriptCount: s.transcriptCount || 0,
          studentCount: s.studentsCount ?? 0,
          startTime: s.startTime,
          endTime: s.endTime,
          duration
        };
      });
    } catch (error) {
      console.error("[DbSessionStorage.getRecentSessionActivity] Error:", error);
      throw new StorageError(
        `Failed to get recent session activity: ${error.message}`,
        "STORAGE_ERROR" /* STORAGE_ERROR */,
        error
      );
    }
  }
  async getSessionById(sessionId) {
    try {
      const result = await db.select().from(sessions).where(eq6(sessions.sessionId, sessionId)).limit(1);
      return result[0];
    } catch (error) {
      throw new StorageError(`Failed to get session by ID ${sessionId}: ${error.message}`, "STORAGE_ERROR" /* STORAGE_ERROR */, error);
    }
  }
  async getTranscriptCountBySession(sessionId) {
    try {
      const result = await db.select({ count: drizzleCount(transcripts.id) }).from(transcripts).where(eq6(transcripts.sessionId, sessionId));
      return result[0]?.count ? Number(result[0].count) : 0;
    } catch (error) {
      throw new StorageError(`Failed to get transcript count for session ${sessionId}: ${error.message}`, "STORAGE_ERROR" /* STORAGE_ERROR */, error);
    }
  }
  async getSessionQualityStats() {
    try {
      const result = await db.select({
        quality: sessions.quality,
        count: drizzleCount(sessions.id)
      }).from(sessions).where(sql`${sessions.quality} IS NOT NULL`).groupBy(sessions.quality);
      const breakdown = {};
      let total = 0;
      let real = 0;
      let dead = 0;
      for (const row of result) {
        const quality = row.quality || "unknown";
        const count2 = Number(row.count) || 0;
        breakdown[quality] = count2;
        total += count2;
        if (quality === "real") {
          real += count2;
        } else if (["no_students", "no_activity", "too_short"].includes(quality)) {
          dead += count2;
        }
      }
      return { total, real, dead, breakdown };
    } catch (error) {
      throw new StorageError(`Failed to get session quality stats: ${error.message}`, "STORAGE_ERROR" /* STORAGE_ERROR */, error);
    }
  }
  async findActiveSessionByTeacherId(teacherId) {
    try {
      if (!teacherId) {
        logger_default.info("[DbSessionStorage] No teacherId provided to findActiveSessionByTeacherId");
        return null;
      }
      logger_default.info(`[DbSessionStorage] Searching for active session with teacherId: ${teacherId}`);
      const allSessions = await db.select().from(sessions);
      logger_default.info(`[DbSessionStorage] Total sessions in DB: ${allSessions.length}`);
      const sessionsWithTeacherId = allSessions.filter((s) => s.teacherId === teacherId);
      logger_default.info(`[DbSessionStorage] Sessions with teacherId ${teacherId}: ${sessionsWithTeacherId.length}`);
      const activeSessions = sessionsWithTeacherId.filter((s) => s.isActive);
      logger_default.info(`[DbSessionStorage] Active sessions with teacherId ${teacherId}: ${activeSessions.length}`);
      const activeSession = activeSessions[0] || null;
      if (activeSession) {
        logger_default.info(`[DbSessionStorage] Found active session for teacherId: ${teacherId}`, {
          sessionId: activeSession.sessionId,
          isActive: activeSession.isActive,
          classCode: activeSession.classCode
        });
      } else {
        logger_default.info(`[DbSessionStorage] No active session found for teacherId: ${teacherId}`);
      }
      return activeSession;
    } catch (error) {
      logger_default.error(`[DbSessionStorage] Error in findActiveSessionByTeacherId for teacherId ${teacherId}:`, {
        message: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail
      });
      return null;
    }
  }
  async findRecentSessionByTeacherId(teacherId, withinMinutes = 10) {
    try {
      logger_default.info(`[DbSessionStorage] Finding recent session for teacherId: ${teacherId} within ${withinMinutes} minutes`);
      const cutoffTime = /* @__PURE__ */ new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - withinMinutes);
      const result = await db.select().from(sessions).where(and3(
        eq6(sessions.teacherId, teacherId),
        eq6(sessions.isActive, false),
        // Only inactive (ended) sessions
        or(
          gte2(sessions.endTime, cutoffTime),
          gte2(sessions.lastActivityAt, cutoffTime)
        )
      )).orderBy(desc3(sessions.endTime), desc3(sessions.lastActivityAt)).limit(1);
      logger_default.info(`[DbSessionStorage] Recent session query result for teacherId ${teacherId}:`, {
        resultCount: result.length,
        session: result[0] ? {
          sessionId: result[0].sessionId,
          teacherId: result[0].teacherId,
          isActive: result[0].isActive,
          lastActivityAt: result[0].lastActivityAt,
          endTime: result[0].endTime
        } : null
      });
      return result[0] || null;
    } catch (error) {
      logger_default.error(`[DbSessionStorage] Error in findRecentSessionByTeacherId for ${teacherId}:`, {
        error: error.message,
        stack: error.stack,
        code: error.code,
        details: error
      });
      throw new StorageError(`Failed to find recent session for teacher ${teacherId}: ${error.message}`, "STORAGE_ERROR" /* STORAGE_ERROR */, error);
    }
  }
  async reactivateSession(sessionId) {
    try {
      logger_default.info(`[DbSessionStorage] Reactivating session: ${sessionId}`);
      const result = await db.update(sessions).set({
        isActive: true,
        endTime: null,
        lastActivityAt: /* @__PURE__ */ new Date()
      }).where(and3(
        eq6(sessions.sessionId, sessionId),
        eq6(sessions.isActive, false)
        // Only reactivate if currently inactive
      )).returning();
      if (result[0]) {
        logger_default.info("[DbSessionStorage] Successfully reactivated session:", {
          sessionId: result[0].sessionId,
          teacherId: result[0].teacherId,
          isActive: result[0].isActive
        });
      } else {
        logger_default.warn(`[DbSessionStorage] No session found to reactivate: ${sessionId}`);
      }
      return result[0] || null;
    } catch (error) {
      logger_default.error(`[DbSessionStorage] Error reactivating session ${sessionId}:`, {
        error: error.message,
        stack: error.stack,
        code: error.code,
        details: error
      });
      throw new StorageError(`Failed to reactivate session ${sessionId}: ${error.message}`, "STORAGE_ERROR" /* STORAGE_ERROR */, error);
    }
  }
};

// server/database-storage.ts
var DatabaseStorage = class {
  constructor() {
    this.initialized = false;
    this.userStorage = new DbUserStorage();
    this.languageStorage = new DbLanguageStorage();
    this.translationStorage = new DbTranslationStorage();
    this.transcriptStorage = new DbTranscriptStorage();
    this.sessionStorage = new DbSessionStorage();
  }
  async ensureInitialized() {
    if (!this.initialized) {
      await this.languageStorage.initializeDefaultLanguages();
      this.initialized = true;
    }
  }
  // User methods (delegated)
  async getUser(id) {
    return this.userStorage.getUser(id);
  }
  async getUserByUsername(username) {
    return this.userStorage.getUserByUsername(username);
  }
  async createUser(user) {
    return this.userStorage.createUser(user);
  }
  async listUsers() {
    return this.userStorage.listUsers();
  }
  // Language methods (delegated)
  async getLanguage(id) {
    await this.ensureInitialized();
    return this.languageStorage.getLanguage(id);
  }
  async getLanguages() {
    await this.ensureInitialized();
    return this.languageStorage.getLanguages();
  }
  async getActiveLanguages() {
    await this.ensureInitialized();
    return this.languageStorage.getActiveLanguages();
  }
  async getLanguageByCode(code) {
    await this.ensureInitialized();
    return this.languageStorage.getLanguageByCode(code);
  }
  async createLanguage(language) {
    await this.ensureInitialized();
    return this.languageStorage.createLanguage(language);
  }
  async updateLanguageStatus(code, isActive) {
    await this.ensureInitialized();
    return this.languageStorage.updateLanguageStatus(code, isActive);
  }
  async listLanguages() {
    await this.ensureInitialized();
    return this.languageStorage.listLanguages();
  }
  async initializeDefaultLanguages() {
    await this.languageStorage.initializeDefaultLanguages();
  }
  // Translation methods
  async getTranslation(id) {
    return this.translationStorage.getTranslation(id);
  }
  async addTranslation(translation) {
    const savedTranslation = await this.translationStorage.addTranslation(translation);
    if (translation.sessionId) {
      const currentSession = await this.sessionStorage.getSessionById(translation.sessionId);
      if (currentSession) {
        await this.sessionStorage.updateSession(translation.sessionId, {
          totalTranslations: (currentSession.totalTranslations || 0) + 1
        });
      }
    }
    return savedTranslation;
  }
  async getTranslationsByLanguage(targetLanguage, limit) {
    return this.translationStorage.getTranslationsByLanguage(targetLanguage, limit);
  }
  async getTranslations(limit, offset) {
    return this.translationStorage.getTranslations(limit, offset);
  }
  async getTranslationsByDateRange(startDate, endDate) {
    return this.translationStorage.getTranslationsByDateRange(startDate, endDate);
  }
  // Transcript methods (delegated)
  async addTranscript(transcript) {
    return this.transcriptStorage.addTranscript(transcript);
  }
  async getTranscriptsBySession(sessionId, language, limit) {
    return this.transcriptStorage.getTranscriptsBySession(sessionId, language, limit);
  }
  // Session methods
  async getActiveSession(sessionId) {
    return this.sessionStorage.getActiveSession(sessionId);
  }
  async getAllActiveSessions() {
    return this.sessionStorage.getAllActiveSessions();
  }
  async getCurrentlyActiveSessions() {
    return this.sessionStorage.getCurrentlyActiveSessions();
  }
  async endSession(sessionId) {
    return this.sessionStorage.endSession(sessionId);
  }
  async getRecentSessionActivity(limit = 5, hoursBack = 24) {
    return this.sessionStorage.getRecentSessionActivity(limit, hoursBack);
  }
  async getSessionById(sessionId) {
    return this.sessionStorage.getSessionById(sessionId);
  }
  async createSession(sessionData) {
    return this.sessionStorage.createSession(sessionData);
  }
  async updateSession(sessionId, updates) {
    return this.sessionStorage.updateSession(sessionId, updates);
  }
  // Session quality and lifecycle methods (delegated)
  async getTranscriptCountBySession(sessionId) {
    return this.sessionStorage.getTranscriptCountBySession(sessionId);
  }
  async getSessionQualityStats() {
    return this.sessionStorage.getSessionQualityStats();
  }
  // Analytics methods
  async getSessionAnalytics(sessionId) {
    const translationsForSession = await db.select().from(translations).where(eq7(translations.sessionId, sessionId));
    if (translationsForSession.length === 0) {
      return { totalTranslations: 0, averageLatency: 0, languagePairs: [] };
    }
    const totalTranslationsCount = translationsForSession.length;
    const totalLatencySum = translationsForSession.reduce((sum, t) => sum + (t.latency || 0), 0);
    const averageLatencyValue = totalTranslationsCount > 0 ? totalLatencySum / totalTranslationsCount : 0;
    const languagePairsMap = /* @__PURE__ */ new Map();
    for (const t of translationsForSession) {
      if (t.sourceLanguage && t.targetLanguage) {
        const key = `${t.sourceLanguage}-${t.targetLanguage}`;
        const pair = languagePairsMap.get(key);
        if (pair) {
          pair.count++;
        } else {
          languagePairsMap.set(key, { sourceLanguage: t.sourceLanguage, targetLanguage: t.targetLanguage, count: 1 });
        }
      }
    }
    return { totalTranslations: totalTranslationsCount, averageLatency: averageLatencyValue, languagePairs: Array.from(languagePairsMap.values()) };
  }
  // Teacher ID session methods - delegate to sessionStorage
  async findActiveSessionByTeacherId(teacherId) {
    await this.ensureInitialized();
    return this.sessionStorage.findActiveSessionByTeacherId(teacherId);
  }
  async findRecentSessionByTeacherId(teacherId, withinMinutes) {
    await this.ensureInitialized();
    return this.sessionStorage.findRecentSessionByTeacherId(teacherId, withinMinutes);
  }
  async reactivateSession(sessionId) {
    await this.ensureInitialized();
    return this.sessionStorage.reactivateSession(sessionId);
  }
  async createTranslation(translationData) {
    return this.translationStorage.createTranslation(translationData);
  }
  // Analytics methods for metrics
  async getSessionMetrics(timeRange) {
    logger_default.debug("DatabaseStorage.getSessionMetrics called", { timeRange });
    const totalSessionsQueryName = timeRange ? "total_sessions_query_with_time_range" : "total_sessions_query_without_time_range";
    const totalSessionsResult = await db.select({ totalSessions: count() }).from(sessions).where(timeRange ? and4(gte3(sessions.startTime, timeRange.startDate), lte2(sessions.startTime, timeRange.endDate)) : void 0).prepare(totalSessionsQueryName).execute(timeRange ? { startDate: timeRange.startDate, endDate: timeRange.endDate } : void 0);
    const totalSessionsCount = Number(totalSessionsResult[0]?.totalSessions) || 0;
    let averageSessionDurationValue = 0;
    if (totalSessionsCount > 0) {
      const durationQueryName = timeRange ? "sum_duration_query_with_time_range" : "sum_duration_query_without_time_range";
      const durationResult = await db.select({
        totalDuration: sql2`SUM(CASE WHEN ${sessions.endTime} IS NOT NULL THEN EXTRACT(EPOCH FROM (${sessions.endTime} - ${sessions.startTime})) * 1000 ELSE 0 END)::bigint`,
        countSessions: count(sessions.id)
      }).from(sessions).where(
        timeRange ? and4(gte3(sessions.startTime, timeRange.startDate), lte2(sessions.startTime, timeRange.endDate), isNotNull(sessions.endTime)) : isNotNull(sessions.endTime)
      ).prepare(durationQueryName).execute(timeRange ? { startDate: timeRange.startDate, endDate: timeRange.endDate } : void 0);
      if (durationResult && durationResult.length > 0 && durationResult[0].countSessions && Number(durationResult[0].countSessions) > 0) {
        averageSessionDurationValue = (Number(durationResult[0].totalDuration) || 0) / Number(durationResult[0].countSessions);
      }
    }
    const activeSessionsResult = await db.select({ count: count() }).from(sessions).where(eq7(sessions.isActive, true)).prepare("active_sessions_query").execute();
    const activeSessionsCount = Number(activeSessionsResult[0]?.count) || 0;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
    const sessionsLast24HoursResult = await db.select({ count: count() }).from(sessions).where(gte3(sessions.startTime, twentyFourHoursAgo)).prepare("sessions_last_24_hours_query").execute();
    const sessionsLast24HoursCount = Number(sessionsLast24HoursResult[0]?.count) || 0;
    logger_default.debug("DatabaseStorage.getSessionMetrics results", { totalSessionsCount, averageSessionDuration: averageSessionDurationValue, activeSessionsCount, sessionsLast24Hours: sessionsLast24HoursCount });
    return {
      totalSessions: totalSessionsCount,
      averageSessionDuration: averageSessionDurationValue,
      activeSessions: activeSessionsCount,
      sessionsLast24Hours: sessionsLast24HoursCount
    };
  }
  async getTranslationMetrics(timeRange) {
    logger_default.debug("DatabaseStorage.getTranslationMetrics called", { timeRange });
    const mainQueryName = timeRange ? "translation_metrics_main_with_range" : "translation_metrics_main_no_range";
    let query = db.select({
      total_translations: count(translations.id),
      avg_latency: avg(translations.latency)
    }).from(translations);
    if (timeRange) {
      query = query.where(and4(gte3(translations.timestamp, timeRange.startDate), lte2(translations.timestamp, timeRange.endDate)));
    }
    const mainMetricsResult = await query.prepare(mainQueryName).execute(timeRange);
    let totalTranslationsValue = 0;
    let averageLatencyValue = 0;
    if (mainMetricsResult && mainMetricsResult.length > 0) {
      totalTranslationsValue = Number(mainMetricsResult[0].total_translations) || 0;
      averageLatencyValue = Math.round(Number(mainMetricsResult[0].avg_latency)) || 0;
    }
    const recentTranslationsQueryName = "translation_metrics_recent";
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1e3);
    const recentTranslationsResult = await db.select({ count: count(translations.id) }).from(translations).where(gte3(translations.timestamp, oneHourAgo)).prepare(recentTranslationsQueryName).execute();
    let recentTranslationsCount = 0;
    if (recentTranslationsResult && recentTranslationsResult.length > 0 && recentTranslationsResult[0].count !== null) {
      recentTranslationsCount = Number(recentTranslationsResult[0].count) || 0;
    }
    logger_default.debug("DatabaseStorage.getTranslationMetrics results", { totalTranslations: totalTranslationsValue, averageLatency: averageLatencyValue, recentTranslations: recentTranslationsCount });
    return { totalTranslations: totalTranslationsValue, averageLatency: averageLatencyValue, recentTranslations: recentTranslationsCount };
  }
  async getLanguagePairUsage(timeRange) {
    logger_default.debug("DatabaseStorage.getLanguagePairUsage called", { timeRange });
    const queryName = timeRange ? "language_pair_usage_query_with_range" : "language_pair_usage_query_no_range";
    let queryBuilder = db.select({
      source_language: translations.sourceLanguage,
      target_language: translations.targetLanguage,
      pair_count: count(translations.id),
      avg_latency: avg(translations.latency)
    }).from(translations);
    if (timeRange) {
      queryBuilder = queryBuilder.where(and4(gte3(translations.timestamp, timeRange.startDate), lte2(translations.timestamp, timeRange.endDate)));
    }
    const finalQuery = queryBuilder.groupBy(translations.sourceLanguage, translations.targetLanguage).orderBy(desc4(count(translations.id)));
    const results = await finalQuery.prepare(queryName).execute(timeRange);
    if (!results || results.length === 0) {
      return [];
    }
    return results.map((row) => ({
      sourceLanguage: row.source_language ?? "unknown",
      targetLanguage: row.target_language ?? "unknown",
      count: Number(row.pair_count) || 0,
      averageLatency: Math.round(Number(row.avg_latency)) || 0
    }));
  }
  // Note: Database reset functionality has been moved to test utilities
  // to avoid contaminating production code with test-specific methods
};

// server/services/WebSocketServer.ts
init_logger();
import { WebSocketServer as WSServer } from "ws";

// server/services/websocket/ConnectionManager.ts
var ConnectionManager = class {
  constructor() {
    this.connections = /* @__PURE__ */ new Set();
    this.roles = /* @__PURE__ */ new Map();
    this.languages = /* @__PURE__ */ new Map();
    this.sessionIds = /* @__PURE__ */ new Map();
    this.classroomCodes = /* @__PURE__ */ new Map();
    this.clientSettings = /* @__PURE__ */ new Map();
    // Track whether a student connection has been counted in session stats
    this.studentCounted = /* @__PURE__ */ new Map();
  }
  /**
   * Add a new connection with its session ID
   */
  addConnection(ws, sessionId, classroomCode) {
    this.connections.add(ws);
    this.sessionIds.set(ws, sessionId);
    if (classroomCode) {
      this.classroomCodes.set(ws, classroomCode);
    }
    ws.sessionId = sessionId;
  }
  /**
   * Remove a connection and all its associated metadata
   */
  removeConnection(ws) {
    this.connections.delete(ws);
    this.roles.delete(ws);
    this.languages.delete(ws);
    this.sessionIds.delete(ws);
    this.classroomCodes.delete(ws);
    this.clientSettings.delete(ws);
    this.studentCounted.delete(ws);
  }
  /**
   * Set the role for a connection
   */
  setRole(ws, role) {
    this.roles.set(ws, role);
  }
  /**
   * Set the language for a connection
   */
  setLanguage(ws, language) {
    this.languages.set(ws, language);
  }
  /**
   * Set client settings for a connection
   */
  setClientSettings(ws, settings) {
    this.clientSettings.set(ws, settings);
  }
  /**
   * Get all active connections
   */
  getConnections() {
    return new Set(this.connections);
  }
  /**
   * Get role for a specific connection
   */
  getRole(ws) {
    return this.roles.get(ws);
  }
  /**
   * Get language for a specific connection
   */
  getLanguage(ws) {
    return this.languages.get(ws);
  }
  /**
   * Get session ID for a specific connection
   */
  getSessionId(ws) {
    return this.sessionIds.get(ws);
  }
  /**
   * Get client settings for a specific connection
   */
  getClientSettings(ws) {
    return this.clientSettings.get(ws);
  }
  /**
   * Get classroom code for a specific connection
   */
  getClassroomCode(ws) {
    return this.classroomCodes.get(ws);
  }
  /**
   * Get total number of active connections
   */
  getConnectionCount() {
    return this.connections.size;
  }
  /**
   * Get number of students (connections with role 'student')
   */
  getStudentCount() {
    return Array.from(this.roles.values()).filter((role) => role === "student").length;
  }
  /**
   * Get number of teachers (connections with role 'teacher')  
   */
  getTeacherCount() {
    return Array.from(this.roles.values()).filter((role) => role === "teacher").length;
  }
  /**
   * Get all student connections and their languages for a specific session
   * Used for broadcasting translations only to students in the same session
   */
  getStudentConnectionsAndLanguagesForSession(sessionId) {
    const studentConnections = [];
    const studentLanguages = [];
    for (const [connection, role] of this.roles.entries()) {
      if (role === "student" && this.sessionIds.get(connection) === sessionId) {
        studentConnections.push(connection);
        const language = this.languages.get(connection) || "en";
        studentLanguages.push(language);
      }
    }
    return {
      connections: studentConnections,
      languages: studentLanguages
    };
  }
  /**
   * Get all student connections and their languages
   * Used for broadcasting translations
   */
  getStudentConnectionsAndLanguages() {
    const studentConnections = [];
    const studentLanguages = [];
    for (const [connection, role] of this.roles.entries()) {
      if (role === "student") {
        studentConnections.push(connection);
        const language = this.languages.get(connection) || "en";
        studentLanguages.push(language);
      }
    }
    return {
      connections: studentConnections,
      languages: studentLanguages
    };
  }
  /**
   * Check if any connections exist
   */
  hasConnections() {
    return this.connections.size > 0;
  }
  /**
   * Get all unique session IDs from active connections
   */
  getActiveSessionIds() {
    return Array.from(new Set(this.sessionIds.values()));
  }
  /**
   * Clear all connections and associated metadata (for shutdown)
   */
  clearAll() {
    this.connections.clear();
    this.roles.clear();
    this.languages.clear();
    this.sessionIds.clear();
    this.clientSettings.clear();
    this.studentCounted.clear();
  }
  /**
   * Update the session ID for an existing connection without affecting other metadata
   */
  updateSessionId(ws, sessionId) {
    this.sessionIds.set(ws, sessionId);
  }
  /**
   * Remove only the session ID for a connection, keeping other metadata
   */
  removeSessionId(ws) {
    this.sessionIds.delete(ws);
  }
  /**
   * Check if a student connection has already been counted in session stats
   */
  isStudentCounted(ws) {
    return this.studentCounted.get(ws) || false;
  }
  /**
   * Mark a student connection as counted in session stats
   */
  setStudentCounted(ws, counted) {
    this.studentCounted.set(ws, counted);
  }
};

// server/services/websocket/SessionService.ts
init_logger();
init_config();
var SessionService = class {
  constructor(storage) {
    this.classroomSessions = /* @__PURE__ */ new Map();
    this.sessionCounter = 0;
    this.classroomCleanupInterval = null;
    this.storage = storage;
    this.startCleanupTask();
  }
  /**
   * Generate a unique session ID
   */
  generateSessionId() {
    this.sessionCounter++;
    return `session-${this.sessionCounter}-${Date.now()}`;
  }
  /**
   * Generate a classroom code for a session
   */
  generateClassroomCode(sessionId) {
    for (const [code, session2] of this.classroomSessions.entries()) {
      if (session2.sessionId === sessionId) {
        return code;
      }
    }
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const session = {
      code: result,
      sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      teacherConnected: true,
      expiresAt: Date.now() + config.session.classroomCodeExpiration
      // Configurable expiration
    };
    this.classroomSessions.set(result, session);
    logger_default.info(`Created classroom session with code ${result} for session ${sessionId}`);
    return result;
  }
  /**
   * Get classroom session by code
   */
  getClassroomSession(code) {
    return this.classroomSessions.get(code);
  }
  /**
   * Get all classroom sessions
   */
  getAllClassroomSessions() {
    return new Map(this.classroomSessions);
  }
  /**
   * Update session in storage
   */
  async updateSessionInStorage(sessionId, updates) {
    try {
      await this.storage.updateSession(sessionId, updates);
      logger_default.debug("Updated session in storage:", { sessionId, updates });
    } catch (error) {
      logger_default.error("Failed to update session in storage:", { error, sessionId });
      throw error;
    }
  }
  /**
   * Clean up expired classroom sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    const expiredSessions = [];
    for (const [code, session] of this.classroomSessions.entries()) {
      if (session.expiresAt < now) {
        expiredSessions.push(code);
      }
    }
    for (const code of expiredSessions) {
      this.classroomSessions.delete(code);
      logger_default.info(`Cleaned up expired classroom session: ${code}`);
    }
    if (expiredSessions.length > 0) {
      logger_default.info(`Cleaned up ${expiredSessions.length} expired classroom sessions`);
    }
  }
  /**
   * Start periodic cleanup task
   */
  startCleanupTask() {
    this.classroomCleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, config.session.classroomCodeCleanupInterval);
    logger_default.info("Started classroom session cleanup task");
  }
  /**
   * Stop cleanup task and cleanup resources
   */
  shutdown() {
    if (this.classroomCleanupInterval) {
      clearInterval(this.classroomCleanupInterval);
      this.classroomCleanupInterval = null;
    }
    this.classroomSessions.clear();
    logger_default.info("SessionService shutdown completed");
  }
};

// server/services/websocket/TranslationOrchestrator.ts
init_logger();
init_config();

// server/services/TranslationService.ts
import fs3 from "fs";
import path3 from "path";
import OpenAI2 from "openai";

// server/services/textToSpeech/TextToSpeechService.ts
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { createHash } from "crypto";
import { createLogger, format, transports } from "winston";
var writeFile = promisify(fs.writeFile);
var mkdir = promisify(fs.mkdir);
var readFile = promisify(fs.readFile);
var stat = promisify(fs.stat);
var access = promisify(fs.access);
var CACHE_DIR = path.join(process.cwd(), "audio-cache");
var MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1e3;
var TEMP_DIR = process.env.TEMP_DIR || path.join(process.cwd(), "temp");
var DEFAULT_TTS_MODEL = "tts-1";
var TTS_RESPONSE_FORMAT = "mp3";
var DEFAULT_SPEED = 1;
var EMOTION_SPEEDS = {
  excited: 1.2,
  serious: 0.9,
  calm: 0.9,
  sad: 0.8
};
var EMOTION_VOICE_MAP = {
  excited: "nova",
  serious: "onyx",
  calm: "shimmer",
  sad: "echo"
};
var BASE_CONFIDENCE = 0.3;
var PATTERN_CONFIDENCE_WEIGHT = 0.5;
var MATCH_DENSITY_MULTIPLIER = 20;
var MIN_CONFIDENCE_FOR_FORMATTING = 0.5;
var VOICE_OPTIONS = {
  "en": ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
  // English
  "es": ["nova", "echo", "alloy"],
  // Spanish (using neutral voices)
  "fr": ["alloy", "nova", "shimmer"],
  // French (using neutral voices)
  "de": ["onyx", "nova", "shimmer"],
  // German (using neutral voices)
  "ja": ["nova", "alloy", "echo"],
  // Japanese (using neutral voices)
  "zh": ["alloy", "nova", "onyx"],
  // Chinese (using neutral voices)
  "default": ["nova", "alloy"]
  // Default fallback
};
var EMOTION_PATTERNS = [
  {
    name: "excited",
    voiceStyle: "excited",
    // Higher pitch, faster pace
    patterns: [
      /\!+/g,
      // Exclamation marks
      /amazing|fantastic|incredible|awesome|wow|wonderful/gi,
      /😄|😃|😁|🤩|😍|🎉|💯|⚡/g
      // Excited emojis
    ]
  },
  {
    name: "serious",
    voiceStyle: "serious",
    // Slower, more deliberate pace
    patterns: [
      /important|critical|crucial|serious|warning|caution|beware/gi,
      /⚠️|❗|🚨|🔴|❓/g
      // Warning/serious emojis
    ]
  },
  {
    name: "calm",
    voiceStyle: "calming",
    // Soft, soothing tone
    patterns: [
      /relax|calm|gentle|peaceful|quiet|softly/gi,
      /😌|🧘|💭|☮️|💫/g
      // Calm emojis
    ]
  },
  {
    name: "sad",
    voiceStyle: "sad",
    // Lower pitch, slower pace
    patterns: [
      /sad|sorry|unfortunately|regret|disappointed/gi,
      /😢|😥|😔|😞|💔/g
      // Sad emojis
    ]
  }
];
var BrowserSpeechSynthesisService = class {
  /**
   * Instead of generating audio on the server, returns a special marker buffer
   * The client will recognize this marker and use the browser's SpeechSynthesis API
   */
  async synthesizeSpeech(options) {
    console.log(`Using browser speech synthesis for text (${options.text.length} chars) in ${options.languageCode}`);
    const markerText = JSON.stringify({
      type: "browser-speech",
      text: options.text,
      languageCode: options.languageCode,
      preserveEmotions: options.preserveEmotions,
      speed: options.speed || 1,
      autoPlay: true
      // Enable automatic playback to match OpenAI behavior
    });
    return Buffer.from(markerText);
  }
};
var SilentTextToSpeechService = class {
  async synthesizeSpeech(_options) {
    console.log("Using silent (no audio) TTS service");
    return Buffer.from([]);
  }
};
var OpenAITextToSpeechService = class {
  constructor(openai2) {
    this.openai = openai2;
    this.ensureCacheDirectoryExists();
  }
  /**
   * Ensure cache directory exists
   */
  async ensureCacheDirectoryExists() {
    try {
      await access(CACHE_DIR, fs.constants.F_OK);
    } catch (error) {
      try {
        await mkdir(CACHE_DIR, { recursive: true });
        console.log(`Created audio cache directory: ${CACHE_DIR}`);
      } catch (mkdirError) {
        console.error("Error creating audio cache directory:", mkdirError);
      }
    }
    try {
      await access(TEMP_DIR, fs.constants.F_OK);
    } catch (error) {
      try {
        await mkdir(TEMP_DIR, { recursive: true });
        console.log(`Created temp directory: ${TEMP_DIR}`);
      } catch (mkdirError) {
        console.error("Error creating temp directory:", mkdirError);
      }
    }
  }
  /**
   * Generate cache key for a TTS request
   */
  generateCacheKey(options) {
    const dataToHash = JSON.stringify({
      text: options.text,
      languageCode: options.languageCode,
      voice: options.voice,
      speed: options.speed,
      preserveEmotions: options.preserveEmotions
    });
    return createHash("md5").update(dataToHash).digest("hex");
  }
  /**
   * Check if cached audio exists and is valid
   */
  async getCachedAudio(cacheKey) {
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.mp3`);
    try {
      await access(cachePath, fs.constants.F_OK);
      const fileStats = await stat(cachePath);
      const fileAgeMs = Date.now() - fileStats.mtimeMs;
      if (fileAgeMs < MAX_CACHE_AGE_MS) {
        console.log(`Using cached audio: ${cachePath}`);
        return await readFile(cachePath);
      } else {
        console.log(`Cache expired for: ${cachePath}`);
        return null;
      }
    } catch (error) {
      return null;
    }
  }
  /**
   * Save audio to cache
   */
  async cacheAudio(cacheKey, audioBuffer) {
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.mp3`);
    try {
      await writeFile(cachePath, audioBuffer);
      console.log(`Cached audio to: ${cachePath}`);
    } catch (error) {
      console.error("Error caching audio:", error);
    }
  }
  /**
   * Detect emotions in text
   */
  detectEmotions(text2) {
    const detectedEmotions = [];
    EMOTION_PATTERNS.forEach((emotionPattern) => {
      let matchCount = 0;
      let totalMatches = 0;
      emotionPattern.patterns.forEach((pattern) => {
        const matches = text2.match(pattern);
        if (matches && matches.length > 0) {
          matchCount++;
          totalMatches += matches.length;
        }
      });
      if (matchCount > 0) {
        const patternRatio = matchCount / emotionPattern.patterns.length;
        const textLength = text2.length;
        const confidence = Math.min(
          BASE_CONFIDENCE + patternRatio * PATTERN_CONFIDENCE_WEIGHT + totalMatches / textLength * MATCH_DENSITY_MULTIPLIER,
          1
        );
        detectedEmotions.push({
          emotion: emotionPattern.name,
          confidence
        });
      }
    });
    return detectedEmotions.sort((a, b) => b.confidence - a.confidence);
  }
  /**
   * Select appropriate voice for language and emotion
   */
  selectVoice(languageCode, detectedEmotion) {
    const lang = languageCode.split("-")[0].toLowerCase();
    if (detectedEmotion && detectedEmotion in EMOTION_VOICE_MAP) {
      return EMOTION_VOICE_MAP[detectedEmotion];
    }
    const availableVoices = VOICE_OPTIONS[lang] || VOICE_OPTIONS.default;
    return availableVoices[0];
  }
  /**
   * Adjust speech parameters based on detected emotion
   */
  adjustSpeechParams(emotion, options) {
    const params = {
      voice: options.voice || this.selectVoice(options.languageCode, void 0),
      // Default voice if no emotion or specific mapping
      speed: options.speed || DEFAULT_SPEED,
      input: options.text
    };
    const languageCode = options.languageCode || "en";
    if (emotion in EMOTION_SPEEDS) {
      params.voice = this.selectVoice(languageCode, emotion);
      params.speed = EMOTION_SPEEDS[emotion];
      params.input = this.formatInputForEmotion(options.text, emotion);
    }
    return params;
  }
  /**
   * Format input text with SSML (Speech Synthesis Markup Language)
   * Note: OpenAI TTS doesn't support SSML directly but we can use text formatting
   * to better convey mood to the model
   */
  formatInputForEmotion(text2, emotion) {
    let formattedText = text2;
    if (emotion === "excited") {
      formattedText = text2.replace(/!/g, "!!").replace(/\?/g, "?!");
    } else if (emotion === "serious") {
      formattedText = text2.charAt(0).toUpperCase() + text2.slice(1) + "...";
    } else if (emotion === "calm") {
      if (!text2.endsWith(".") && !text2.endsWith("?") && !text2.endsWith("!")) {
        formattedText = text2 + ".";
      }
    } else if (emotion === "sad") {
      formattedText = text2 + "...";
    }
    return formattedText;
  }
  /**
   * Process emotions and adjust speech parameters if emotion preservation is enabled
   */
  processEmotions(options) {
    let voice = options.voice || this.selectVoice(options.languageCode);
    let speed = options.speed || DEFAULT_SPEED;
    let input = options.text;
    if (options.preserveEmotions) {
      const detectedEmotions = this.detectEmotions(options.text);
      if (detectedEmotions.length > 0) {
        const topEmotion = detectedEmotions[0];
        console.log(`Detected emotion: ${topEmotion.emotion} (confidence: ${topEmotion.confidence.toFixed(2)})`);
        const adjustedParams = this.adjustSpeechParams(topEmotion.emotion, options);
        voice = adjustedParams.voice;
        speed = adjustedParams.speed;
        if (topEmotion.confidence > MIN_CONFIDENCE_FOR_FORMATTING) {
          input = this.formatInputForEmotion(adjustedParams.input, topEmotion.emotion);
        } else {
          input = adjustedParams.input;
        }
      }
    }
    return { voice, speed, input };
  }
  /**
   * Call OpenAI's TTS API with the given parameters
   */
  async callOpenAIAPI(voice, speed, input) {
    try {
      const apiPayload = {
        model: DEFAULT_TTS_MODEL,
        input,
        voice,
        response_format: TTS_RESPONSE_FORMAT,
        speed
      };
      const response = await this.openai.audio.speech.create(apiPayload);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      throw new TextToSpeechError(
        `Speech synthesis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "API_ERROR",
        error
      );
    }
  }
  /**
   * Synthesize speech from text using OpenAI's TTS API
   */
  async synthesizeSpeech(options) {
    const cacheKey = this.generateCacheKey(options);
    const cachedAudio = await this.getCachedAudio(cacheKey);
    if (cachedAudio) {
      return cachedAudio;
    }
    try {
      console.log(`Synthesizing speech for text (${options.text.length} chars) in ${options.languageCode}`);
      const { voice, speed, input } = this.processEmotions(options);
      console.log(`Using voice: ${voice}, speed: ${speed}`);
      const audioBuffer = await this.callOpenAIAPI(voice, speed, input);
      await this.cacheAudio(cacheKey, audioBuffer);
      return audioBuffer;
    } catch (error) {
      console.error("Error synthesizing speech:", error);
      if (error instanceof TextToSpeechError) {
        throw error;
      }
      throw new Error(`Speech synthesis failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
};
var logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}
var ttsLogger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp(),
    format.printf((info) => `${info.timestamp} [${String(info.level).toUpperCase()}] ${String(info.message)}`)
  ),
  transports: [
    new transports.File({ filename: path.join(logsDir, "tts.log") }),
    new transports.Console()
  ]
});
var TextToSpeechFactory = class _TextToSpeechFactory {
  constructor() {
    this.services = /* @__PURE__ */ new Map();
    this.services.set("browser", new BrowserSpeechSynthesisService());
    this.services.set("silent", new SilentTextToSpeechService());
  }
  static getInstance() {
    if (!_TextToSpeechFactory.instance) {
      _TextToSpeechFactory.instance = new _TextToSpeechFactory();
    }
    return _TextToSpeechFactory.instance;
  }
  getService(serviceType = "openai") {
    if (serviceType.toLowerCase() === "openai") {
      const apiKey = process.env.OPENAI_API_KEY || "";
      if (!apiKey) {
        ttsLogger.warn("[TTS Factory] OPENAI_API_KEY is missing. Falling back to silent TTS.");
        return this.services.get("silent");
      }
      const openai2 = new OpenAI({ apiKey });
      return new OpenAITextToSpeechService(openai2);
    }
    const service = this.services.get(serviceType.toLowerCase());
    if (!service) {
      ttsLogger.warn(`TTS service '${serviceType}' not found, falling back to openai`);
      return this.getService("openai");
    }
    return service;
  }
};
var ttsFactory = TextToSpeechFactory.getInstance();
var TextToSpeechError = class extends Error {
  constructor(message, code, originalError) {
    super(message);
    this.code = code;
    this.originalError = originalError;
    this.name = "TextToSpeechError";
  }
};

// server/services/TranslationService.ts
import { promisify as promisify3 } from "util";
import { fileURLToPath } from "url";

// server/services/helpers/DevelopmentModeHelper.ts
import { Buffer as Buffer2 } from "buffer";
var DevelopmentModeHelper = class {
  /**
   * Create a simple WAV buffer with silence
   * Used for development mode when no real audio processing is available
   */
  static createSilentAudioBuffer() {
    const wavHeader = Buffer2.from([
      82,
      73,
      70,
      70,
      // "RIFF"
      36,
      0,
      0,
      0,
      // ChunkSize (36 bytes + data size)
      87,
      65,
      86,
      69,
      // "WAVE"
      102,
      109,
      116,
      32,
      // "fmt "
      16,
      0,
      0,
      0,
      // Subchunk1Size (16 bytes)
      1,
      0,
      // AudioFormat (1 = PCM)
      1,
      0,
      // NumChannels (1 = mono)
      68,
      172,
      0,
      0,
      // SampleRate (44100 Hz)
      136,
      88,
      1,
      0,
      // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
      2,
      0,
      // BlockAlign (NumChannels * BitsPerSample/8)
      16,
      0,
      // BitsPerSample (16 bits)
      100,
      97,
      116,
      97,
      // "data"
      0,
      0,
      0,
      0
      // Subchunk2Size (data size)
    ]);
    const sampleCount = 44100;
    const dataSize = sampleCount * 2;
    const silenceData = Buffer2.alloc(dataSize);
    wavHeader.writeUInt32LE(dataSize, 40);
    wavHeader.writeUInt32LE(36 + dataSize, 4);
    return Buffer2.concat([wavHeader, silenceData]);
  }
  /**
   * Get a synthetic translation based on target language
   */
  static getLanguageSpecificTranslation(text2, targetLanguage) {
    const devTranslations = {
      es: "Esto es una traducci\xF3n en modo de desarrollo.",
      fr: "Ceci est une traduction en mode d\xE9veloppement.",
      de: "Dies ist eine \xDCbersetzung im Entwicklungsmodus."
    };
    const langPrefix = targetLanguage.split("-")[0].toLowerCase();
    return devTranslations[langPrefix] || text2;
  }
};

// server/services/handlers/AudioFileHandler.ts
import fs2 from "fs";
import path2 from "path";
import { promisify as promisify2 } from "util";
import * as os from "os";
var writeFile2 = promisify2(fs2.writeFile);
var unlink = promisify2(fs2.unlink);
var stat2 = promisify2(fs2.stat);
var mkdir2 = fs2.mkdir ? promisify2(fs2.mkdir) : void 0;
var DEFAULT_TEMP_DIR = os.tmpdir();
var AUDIO_FILE_PREFIX = "temp-audio-";
var AUDIO_FILE_EXTENSION = ".wav";
var AudioFileError = class extends Error {
  constructor(message, code, originalError) {
    super(message);
    this.code = code;
    this.originalError = originalError;
    this.name = "AudioFileError";
  }
};
var AudioFileHandler = class {
  constructor(tempDir = DEFAULT_TEMP_DIR, enableLogging = true) {
    this.tempDir = tempDir;
    this.enableLogging = enableLogging;
  }
  /**
   * Ensures the temporary directory exists
   */
  async ensureTempDirectoryExists() {
    if (!mkdir2) {
      return;
    }
    try {
      await mkdir2(this.tempDir, { recursive: true });
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw new AudioFileError(
          `Failed to create temp directory: ${this.tempDir}`,
          "CREATE_FAILED",
          error
        );
      }
    }
  }
  /**
   * Validates audio buffer
   */
  validateAudioBuffer(buffer) {
    if (!Buffer.isBuffer(buffer)) {
      throw new AudioFileError(
        "Invalid audio buffer: expected Buffer instance",
        "INVALID_BUFFER"
      );
    }
    if (buffer.length === 0) {
      throw new AudioFileError(
        "Invalid audio buffer: buffer is empty",
        "INVALID_BUFFER"
      );
    }
  }
  /**
   * Generates a unique filename
   */
  generateFilename(options = {}) {
    const prefix = options.prefix || AUDIO_FILE_PREFIX;
    const extension = options.extension || AUDIO_FILE_EXTENSION;
    const timestamp2 = options.preserveTimestamp ? Date.now() : Date.now() + Math.random();
    return `${prefix}${timestamp2}${extension}`;
  }
  /**
   * Logs a message if logging is enabled
   */
  log(message, level2 = "info") {
    if (this.enableLogging) {
      if (level2 === "error") {
        console.error(message);
      } else {
        console.log(message);
      }
    }
  }
  /**
   * Create a temporary file from an audio buffer
   */
  async createTempFile(audioBuffer, options = {}) {
    this.validateAudioBuffer(audioBuffer);
    await this.ensureTempDirectoryExists();
    const filename = this.generateFilename(options);
    const filePath = path2.join(this.tempDir, filename);
    try {
      await writeFile2(filePath, audioBuffer);
      this.log(`Saved audio buffer to temporary file: ${filePath}`);
      if (this.enableLogging) {
        const fileStats = await stat2(filePath);
        this.log(`Audio file size: ${fileStats.size} bytes, created: ${fileStats.mtime}`);
        const estimatedDuration = Math.round(fileStats.size / 16e3 / 2);
        this.log(`Audio duration estimate: ~${estimatedDuration} seconds`);
      }
      return filePath;
    } catch (error) {
      const errorMessage = `Failed to create temporary audio file: ${error instanceof Error ? error.message : "Unknown error"}`;
      this.log(errorMessage, "error");
      throw new AudioFileError(
        errorMessage,
        "CREATE_FAILED",
        error
      );
    }
  }
  /**
   * Delete a temporary file
   */
  async deleteTempFile(filePath) {
    try {
      await unlink(filePath);
      this.log(`Deleted temporary file: ${filePath}`);
    } catch (error) {
      const errorMessage = `Error cleaning up temporary file: ${error instanceof Error ? error.message : "Unknown error"}`;
      this.log(errorMessage, "error");
    }
  }
  /**
   * Delete multiple temporary files
   */
  async deleteTempFiles(filePaths) {
    await Promise.all(
      filePaths.map((filePath) => this.deleteTempFile(filePath))
    );
  }
  /**
   * Get the configured temporary directory
   */
  getTempDir() {
    return this.tempDir;
  }
};

// server/services/TranslationService.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path3.dirname(__filename);
var writeFile3 = promisify3(fs3.writeFile);
var unlink2 = promisify3(fs3.unlink);
var stat3 = promisify3(fs3.stat);
var DEFAULT_WHISPER_MODEL = "whisper-1";
var DEFAULT_CHAT_MODEL = "gpt-4o";
var LANGUAGE_MAP = {
  "en-US": "English",
  "fr-FR": "French",
  "es-ES": "Spanish",
  "de-DE": "German",
  "it-IT": "Italian",
  "ja-JP": "Japanese",
  "ko-KR": "Korean",
  "pt-BR": "Portuguese",
  "ru-RU": "Russian",
  "zh-CN": "Chinese (Simplified)",
  "ar-SA": "Arabic",
  "hi-IN": "Hindi",
  "tr-TR": "Turkish",
  "nl-NL": "Dutch",
  "pl-PL": "Polish",
  "sv-SE": "Swedish",
  "da-DK": "Danish",
  "fi-FI": "Finnish",
  "no-NO": "Norwegian",
  "cs-CZ": "Czech",
  "hu-HU": "Hungarian",
  "el-GR": "Greek",
  "he-IL": "Hebrew",
  "th-TH": "Thai",
  "vi-VN": "Vietnamese",
  "id-ID": "Indonesian",
  "ms-MY": "Malay",
  "ro-RO": "Romanian",
  "uk-UA": "Ukrainian",
  "bg-BG": "Bulgarian",
  "hr-HR": "Croatian",
  "sr-RS": "Serbian",
  "sk-SK": "Slovak",
  "sl-SI": "Slovenian",
  "et-EE": "Estonian",
  "lv-LV": "Latvian",
  "lt-LT": "Lithuanian"
};
var SUSPICIOUS_PHRASES = [
  "If there is no speech or only background noise, return an empty string",
  "This is classroom speech from a teacher",
  "Transcribe any audible speech accurately",
  "return an empty string"
];
var OpenAITranscriptionService = class {
  constructor(openai2, audioHandler2 = new AudioFileHandler()) {
    this.openai = openai2;
    this.audioHandler = audioHandler2;
  }
  /**
   * Transcribe audio using OpenAI Whisper API
   */
  async transcribe(audioBuffer, sourceLanguage) {
    if (!audioBuffer || audioBuffer.length < 1e3) {
      console.log(`Audio buffer too small for transcription: ${audioBuffer?.length} bytes`);
      return "";
    }
    let tempFilePath = "";
    try {
      tempFilePath = await this.audioHandler.createTempFile(audioBuffer);
      const audioReadStream = fs3.createReadStream(tempFilePath);
      const primaryLanguage = sourceLanguage.split("-")[0];
      const transcriptionResponse = await this.openai.audio.transcriptions.create({
        file: audioReadStream,
        model: DEFAULT_WHISPER_MODEL,
        language: primaryLanguage,
        response_format: "json"
      });
      if (transcriptionResponse.text) {
        const originalText = transcriptionResponse.text;
        const isPotentialPromptLeak = SUSPICIOUS_PHRASES.some(
          (phrase) => originalText.includes(phrase)
        );
        if (isPotentialPromptLeak) {
          console.log("\u26A0\uFE0F DETECTED PROMPT LEAKAGE: The transcription appears to contain prompt instructions");
          console.log("Treating this as an empty transcription and triggering fallback mechanism");
          return "";
        }
        return originalText;
      } else {
        console.log("Transcription returned no text - Whisper API failed to detect speech");
        return "";
      }
    } catch (error) {
      console.error("Error during transcription:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Transcription failed: ${errorMessage}`);
    } finally {
      if (tempFilePath) {
        await this.audioHandler.deleteTempFile(tempFilePath);
      }
    }
  }
};
var OpenAITranslationService = class {
  constructor(openai2) {
    this.maxRetries = 3;
    this.openai = openai2;
  }
  /**
   * Get the full language name from a language code
   */
  getLanguageName(languageCode) {
    return LANGUAGE_MAP[languageCode] || languageCode.split("-")[0];
  }
  /**
   * Handle translation errors in a standardized way
   * Extracts useful information from various error types
   */
  handleTranslationError(error, originalText, retryCount) {
    let errorMessage = "Unknown error occurred";
    let statusCode = void 0;
    let shouldRetry = retryCount < this.maxRetries;
    if (error instanceof Error) {
      errorMessage = error.message;
      if ("status" in error && typeof error.status === "number") {
        statusCode = error.status;
        const code = statusCode || 0;
        shouldRetry = retryCount < this.maxRetries && (code === 429 || code >= 500 || code === 0);
      }
    }
    console.error(`Translation error [attempt ${retryCount + 1}/${this.maxRetries + 1}]:`, errorMessage);
    return {
      error: errorMessage,
      originalText,
      retryCount,
      statusCode,
      shouldRetry
    };
  }
  /**
   * Create translation request with exponential backoff retry
   */
  async executeWithRetry(text2, sourceLangName, targetLangName, retryCount = 0) {
    try {
      const prompt = `
        Translate this text from ${sourceLangName} to ${targetLangName}. 
        Maintain the same tone and style. Return only the translation without explanations or notes.
        
        Original text: "${text2}"
        
        Translation:
      `;
      const translation = await this.openai.chat.completions.create({
        model: DEFAULT_CHAT_MODEL,
        messages: [
          { role: "system", content: "You are a professional translator with expertise in multiple languages." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 500
      });
      const translatedText = translation.choices[0]?.message?.content?.trim();
      if (translatedText) {
        return translatedText;
      } else {
        console.warn(`OpenAI returned no translated content for: "${text2}". Returning original.`);
        return text2;
      }
    } catch (error) {
      const errorResponse = this.handleTranslationError(error, text2, retryCount);
      if (errorResponse.shouldRetry) {
        const delay = Math.pow(2, retryCount) * 1e3;
        console.log(`Retrying translation in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.executeWithRetry(text2, sourceLangName, targetLangName, retryCount + 1);
      }
      throw new Error(`Translation failed after ${retryCount + 1} attempts: ${errorResponse.error}`);
    }
  }
  /**
   * Translate text from one language to another
   * Implementation now has reduced complexity by separating concerns
   */
  async translate(text2, sourceLanguage, targetLanguage) {
    if (!text2) {
      return "";
    }
    if (targetLanguage === sourceLanguage) {
      console.log(`No translation needed - source and target language are the same (${targetLanguage})`);
      return text2;
    }
    try {
      const sourceLangName = this.getLanguageName(sourceLanguage);
      const targetLangName = this.getLanguageName(targetLanguage);
      const translatedText = await this.executeWithRetry(text2, sourceLangName, targetLangName);
      return translatedText;
    } catch (error) {
      console.error(`Error translating to ${targetLanguage}:`, error);
      if (error instanceof Error) {
        console.error(`Translation error details: ${error.message}`);
      }
      return "";
    }
  }
};
var SpeechTranslationService = class {
  constructor(transcriptionService2, translationService2, apiKeyAvailable) {
    this.transcriptionService = transcriptionService2;
    this.translationService = translationService2;
    this.apiKeyAvailable = apiKeyAvailable;
  }
  /**
   * Create development mode synthetic translation for testing without API key
   */
  createDevelopmentModeTranslation(sourceLanguage, targetLanguage, preTranscribedText) {
    console.log("DEV MODE: Using synthetic translation data due to missing API key");
    const originalText = preTranscribedText || "This is a development mode transcription.";
    const translatedText = DevelopmentModeHelper.getLanguageSpecificTranslation(
      originalText,
      targetLanguage
    );
    const audioBuffer = DevelopmentModeHelper.createSilentAudioBuffer();
    console.log(`DEV MODE: Returning synthetic translation: "${translatedText}"`);
    return {
      originalText,
      translatedText,
      audioBuffer
    };
  }
  /**
   * Get text either from pre-transcribed input or by transcribing audio
   * Extracted to reduce complexity
   */
  async getOriginalText(audioBuffer, sourceLanguage, preTranscribedText) {
    if (preTranscribedText) {
      console.log(`Using pre-transcribed text instead of audio: "${preTranscribedText}"`);
      return preTranscribedText;
    }
    try {
      return await this.transcriptionService.transcribe(audioBuffer, sourceLanguage);
    } catch (error) {
      console.error("Transcription service failed:", error);
      return "";
    }
  }
  /**
   * Translate text to target language
   * Extracted to reduce complexity
   */
  async translateText(text2, sourceLanguage, targetLanguage) {
    try {
      return await this.translationService.translate(
        text2,
        sourceLanguage,
        targetLanguage
      );
    } catch (error) {
      console.error("Translation service failed:", error);
      return "";
    }
  }
  /**
   * Transcribe and translate speech
   * Main public method that orchestrates the workflow
   * Now includes emotional tone preservation in synthesized speech
   */
  async translateSpeech(audioBuffer, sourceLanguage, targetLanguage, preTranscribedText, options) {
    if (!this.apiKeyAvailable) {
      return this.createDevelopmentModeTranslation(sourceLanguage, targetLanguage, preTranscribedText);
    }
    const originalText = await this.getOriginalText(
      audioBuffer,
      sourceLanguage,
      preTranscribedText
    );
    if (!originalText) {
      return {
        originalText: "",
        translatedText: "",
        audioBuffer
      };
    }
    const translatedText = await this.translateText(
      originalText,
      sourceLanguage,
      targetLanguage
    );
    let translatedAudioBuffer = audioBuffer;
    try {
      const ttsServiceType = options && options.ttsServiceType || process.env.TTS_SERVICE_TYPE || "browser";
      console.log(`Using TTS service '${ttsServiceType}' for language '${targetLanguage}'`);
      const ttsService = ttsFactory.getService(ttsServiceType);
      translatedAudioBuffer = await ttsService.synthesizeSpeech({
        text: translatedText || originalText,
        languageCode: targetLanguage,
        preserveEmotions: true
        // Enable emotional tone preservation
      });
    } catch (error) {
      console.error("Error generating audio for translation:", error);
    }
    return {
      originalText,
      translatedText,
      // Don't fall back to original text
      audioBuffer: translatedAudioBuffer
    };
  }
};
var openai;
try {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OpenAI API key status: Missing");
    console.warn("OPENAI_API_KEY is missing or empty. This might cause API failures.");
  } else {
    console.log("OpenAI API key status: Present");
  }
  openai = new OpenAI2({
    apiKey: process.env.OPENAI_API_KEY || "sk-placeholder-for-initialization-only"
  });
  console.log("OpenAI client initialized successfully");
} catch (error) {
  console.error("Error initializing OpenAI client:", error);
  openai = new OpenAI2({ apiKey: "sk-placeholder-for-initialization-only" });
}
var audioHandler = new AudioFileHandler();
var transcriptionService = new OpenAITranscriptionService(openai, audioHandler);
var translationService = new OpenAITranslationService(openai);
var speechTranslationService = new SpeechTranslationService(
  transcriptionService,
  translationService,
  Boolean(process.env.OPENAI_API_KEY)
);

// server/services/websocket/TranslationOrchestrator.ts
var TranslationOrchestrator = class {
  // IStorage - using any to avoid circular dependency
  constructor(storage) {
    this.storage = storage;
  }
  /**
   * Translate text to multiple target languages
   */
  async translateToMultipleLanguages(request) {
    const { text: text2, sourceLanguage, targetLanguages, startTime, latencyTracking } = request;
    logger_default.info("Translating to multiple languages:", {
      text: text2,
      sourceLanguage,
      targetLanguages,
      targetLanguageCount: targetLanguages.length
    });
    const preparationEndTime = Date.now();
    latencyTracking.components.preparation = preparationEndTime - startTime;
    const translations2 = /* @__PURE__ */ new Map();
    const translationResults = [];
    const translationStartTime = Date.now();
    const translationPromises = targetLanguages.map(async (targetLanguage) => {
      try {
        const result = await speechTranslationService.translateSpeech(
          Buffer.from(""),
          // Empty buffer since we have text
          sourceLanguage,
          targetLanguage,
          text2,
          // Use the provided text directly
          { ttsServiceType: "openai" }
          // Always use OpenAI TTS for best quality
        );
        const translation = result.translatedText;
        translations2.set(targetLanguage, translation);
        translationResults.push({ language: targetLanguage, translation });
        logger_default.info("Translation completed:", {
          sourceLanguage,
          targetLanguage,
          originalText: text2,
          translatedText: translation
        });
        return { targetLanguage, translation };
      } catch (error) {
        logger_default.error(`Translation failed for ${targetLanguage}:`, { error });
        translations2.set(targetLanguage, text2);
        translationResults.push({ language: targetLanguage, translation: text2 });
        return { targetLanguage, translation: text2 };
      }
    });
    await Promise.all(translationPromises);
    const translationEndTime = Date.now();
    latencyTracking.components.translation = translationEndTime - translationStartTime;
    logger_default.info("All translations completed:", {
      translationCount: translations2.size,
      translationTime: latencyTracking.components.translation
    });
    return {
      translations: translations2,
      translationResults,
      latencyInfo: latencyTracking.components
    };
  }
  /**
   * Send translations to all student connections, returns a Promise that resolves when all sends are complete
   */
  async sendTranslationsToStudents(options) {
    const {
      studentConnections,
      originalText,
      sourceLanguage,
      translations: translations2,
      startTime,
      latencyTracking,
      getClientSettings,
      getLanguage,
      getSessionId
    } = options;
    const storage = this.storage;
    logger_default.info("WebSocketServer: sendTranslationsToStudents started");
    const ttsStartTime = Date.now();
    const deliveryResults = [];
    const sendWithRetry = async (studentWs, studentLanguage, attempt = 1) => {
      try {
        const clientSettings = getClientSettings(studentWs) || {};
        const translation = translations2.get(studentLanguage) || originalText;
        const ttsServiceType = clientSettings.ttsServiceType || "openai";
        const useClientSpeech = clientSettings.useClientSpeech === true;
        let audioData = "";
        let speechParams;
        if (useClientSpeech) {
          speechParams = {
            type: "browser-speech",
            text: translation,
            languageCode: studentLanguage,
            autoPlay: true
          };
        } else {
          try {
            const audioBuffer = await this.generateTTSAudio(
              translation,
              studentLanguage,
              ttsServiceType
            );
            audioData = audioBuffer ? audioBuffer.toString("base64") : "";
          } catch (error) {
            logger_default.error("Error generating TTS audio:", { error });
            audioData = "";
          }
        }
        const ttsEndTime = Date.now();
        if (latencyTracking.components.tts === 0) {
          latencyTracking.components.tts = ttsEndTime - ttsStartTime;
        }
        const serverCompleteTime = Date.now();
        const totalLatency = serverCompleteTime - startTime;
        const translationMessage = {
          type: "translation",
          text: translation,
          originalText,
          sourceLanguage,
          targetLanguage: studentLanguage,
          ttsServiceType,
          latency: {
            total: totalLatency,
            serverCompleteTime,
            components: latencyTracking.components
          },
          audioData,
          useClientSpeech,
          ...speechParams && { speechParams }
        };
        studentWs.send(JSON.stringify(translationMessage));
        logger_default.info("Sent translation to student:", {
          studentLanguage,
          translation,
          originalText,
          ttsServiceType,
          useClientSpeech,
          totalLatency,
          hasAudio: audioData.length > 0,
          attempt
        });
        return true;
      } catch (error) {
        logger_default.error("Error sending translation to student:", { error, studentLanguage, attempt });
        if (attempt < 3) {
          logger_default.warn(`Retrying translation delivery for ${studentLanguage}, attempt ${attempt + 1}`);
          return await sendWithRetry(studentWs, studentLanguage, attempt + 1);
        }
        return false;
      }
    };
    const translationPromises = studentConnections.map(async (studentWs) => {
      const studentLanguage = getLanguage(studentWs);
      if (!studentLanguage || typeof studentLanguage !== "string" || studentLanguage.trim().length === 0) {
        logger_default.warn("Student has no valid language set, skipping translation", {
          sessionId: getSessionId ? getSessionId(studentWs) : "unknown",
          studentLanguage
        });
        deliveryResults.push({ studentWs, studentLanguage: studentLanguage || "", delivered: false, error: "Invalid language" });
        return;
      }
      const delivered = await sendWithRetry(studentWs, studentLanguage, 1);
      deliveryResults.push({ studentWs, studentLanguage, delivered });
      if (delivered && storage) {
        const enableDetailedTranslationLogging = process.env.ENABLE_DETAILED_TRANSLATION_LOGGING === "true";
        if (enableDetailedTranslationLogging) {
          const classroomSessionId = getSessionId?.(studentWs);
          const translationLatency = latencyTracking.components?.translation || 0;
          logger_default.info("WebSocketServer: About to persist translation", {
            classroomSessionId,
            translatedText: translations2.get(studentLanguage) || originalText,
            translationLatency,
            originalText,
            sourceLanguage,
            targetLanguage: studentLanguage
          });
          if (classroomSessionId) {
            if (!sourceLanguage || typeof sourceLanguage !== "string" || sourceLanguage.trim().length === 0) {
              logger_default.error("Invalid sourceLanguage, skipping translation storage", {
                sourceLanguage,
                classroomSessionId
              });
              return;
            }
            if (!studentLanguage || typeof studentLanguage !== "string" || studentLanguage.trim().length === 0) {
              logger_default.error("Invalid targetLanguage (studentLanguage), skipping translation storage", {
                studentLanguage,
                classroomSessionId
              });
              return;
            }
            logger_default.info("WebSocketServer: Attempting to call storage.addTranslation (detailed logging enabled)");
            try {
              const translationData = {
                sessionId: classroomSessionId,
                sourceLanguage,
                targetLanguage: studentLanguage,
                originalText,
                translatedText: translations2.get(studentLanguage) || originalText,
                latency: translationLatency
              };
              console.log("TranslationOrchestrator: About to call storage.addTranslation with data:", translationData);
              await storage.addTranslation(translationData);
              logger_default.info("WebSocketServer: storage.addTranslation finished successfully", { sessionId: classroomSessionId });
              console.log("TranslationOrchestrator: storage.addTranslation completed successfully");
            } catch (storageError) {
              logger_default.error("WebSocketServer: CRITICAL - Error calling storage.addTranslation. Database insertion failed!", {
                error: storageError,
                sessionId: classroomSessionId,
                errorMessage: storageError instanceof Error ? storageError.message : "Unknown error",
                errorStack: storageError instanceof Error ? storageError.stack : void 0
              });
              console.error("CRITICAL DATABASE ERROR in addTranslation:", {
                error: storageError,
                message: storageError instanceof Error ? storageError.message : "Unknown error",
                stack: storageError instanceof Error ? storageError.stack : void 0,
                sessionId: classroomSessionId
              });
              logger_default.error("=== TRANSLATION STORAGE FAILED ===");
              logger_default.error("This database error should be investigated:", storageError);
              logger_default.error("=== END STORAGE ERROR ===");
            }
          } else {
            logger_default.warn("WebSocketServer: Detailed translation logging enabled, but classroomSessionId not available, skipping storage.addTranslation", { hasSessionId: !!classroomSessionId });
          }
        } else {
          logger_default.info("WebSocketServer: Detailed translation logging is disabled via environment variable ENABLE_DETAILED_TRANSLATION_LOGGING, skipping storage.addTranslation");
        }
      }
      if (!delivered) {
        logger_default.error("CRITICAL: Translation delivery failed for student after 3 attempts", {
          studentLanguage,
          sessionId: getSessionId ? getSessionId(studentWs) : "unknown"
        });
      }
    });
    logger_default.info("WebSocketServer: Awaiting all translation deliveries before session cleanup");
    await Promise.all(translationPromises);
    const failedDeliveries = deliveryResults.filter((r) => !r.delivered);
    if (failedDeliveries.length > 0) {
      logger_default.error("Summary: Some students did not receive translations after retries", {
        failedStudents: failedDeliveries.map((r) => ({ studentLanguage: r.studentLanguage, error: r.error }))
      });
    } else {
      logger_default.info("Summary: All students received translations successfully");
    }
    logger_default.info("WebSocketServer: sendTranslationsToStudents finished (all translations sent, safe for cleanup)");
  }
  /**
   * Generate TTS audio for the given text
   */
  async generateTTSAudio(text2, languageCode, ttsServiceType = "openai", voice) {
    const audioBuffer = await this.generateTTSAudioInternal(text2, languageCode, ttsServiceType, voice);
    return audioBuffer || Buffer.from("");
  }
  /**
   * Generate TTS audio for the given text (internal implementation)
   */
  async generateTTSAudioInternal(text2, languageCode, ttsServiceType, voice) {
    if (!text2 || text2.trim().length === 0) {
      logger_default.warn("Cannot generate TTS for empty text");
      return null;
    }
    try {
      logger_default.info("Generating TTS audio:", {
        text: text2.substring(0, config.session.logTextPreviewLength) + (text2.length > config.session.logTextPreviewLength ? "..." : ""),
        languageCode,
        ttsServiceType,
        voice
      });
      const result = await speechTranslationService.translateSpeech(
        Buffer.from(""),
        // Empty buffer since we have text
        languageCode,
        // Source language is the same as target for TTS-only
        languageCode,
        // Target language
        text2,
        // Text to convert to speech
        { ttsServiceType }
        // Force specified TTS service type
      );
      if (!result.audioBuffer || result.audioBuffer.length === 0) {
        logger_default.warn("speechTranslationService returned empty audio buffer");
        return null;
      }
      logger_default.info("TTS audio generated successfully:", {
        audioSize: result.audioBuffer.length,
        languageCode,
        ttsServiceType
      });
      return result.audioBuffer;
    } catch (error) {
      logger_default.error("Error generating TTS audio:", {
        error,
        text: text2.substring(0, 50),
        languageCode,
        ttsServiceType
      });
      return null;
    }
  }
  /**
   * Validate TTS request parameters
   */
  validateTTSRequest(text2, languageCode) {
    if (!text2 || typeof text2 !== "string" || text2.trim().length === 0) {
      logger_default.error("Invalid TTS text:", { text: text2 });
      return false;
    }
    if (!languageCode || typeof languageCode !== "string") {
      logger_default.error("Invalid TTS language code:", { languageCode });
      return false;
    }
    return true;
  }
};

// server/services/websocket/ClassroomSessionManager.ts
init_logger();
init_config();
var ClassroomSessionManager = class {
  constructor() {
    this.classroomSessions = /* @__PURE__ */ new Map();
    this.cleanupInterval = null;
    this.setupCleanup();
  }
  /**
   * Generate a classroom code for a session
   */
  generateClassroomCode(sessionId) {
    console.log(`\u{1F50D} DEBUG: generateClassroomCode called with sessionId: ${sessionId}`);
    for (const [code2, session2] of this.classroomSessions.entries()) {
      if (session2.sessionId === sessionId) {
        session2.lastActivity = Date.now();
        session2.teacherConnected = true;
        console.log(`\u{1F50D} DEBUG: Found existing code ${code2} for sessionId ${sessionId}, reusing it`);
        return code2;
      }
    }
    console.log(`\u{1F50D} DEBUG: No existing code found for sessionId ${sessionId}, generating new one`);
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code;
    do {
      code = "";
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.classroomSessions.has(code));
    console.log(`\u{1F50D} DEBUG: Generated new classroom code: ${code} for sessionId: ${sessionId}`);
    const now = Date.now();
    const expiresAt = now + config.session.classroomCodeExpiration;
    console.log(`\u{1F50D} DEBUG: Setting expiration - now=${now}, expiration=${config.session.classroomCodeExpiration}ms, expiresAt=${expiresAt}`);
    const session = {
      code,
      sessionId,
      createdAt: now,
      lastActivity: now,
      teacherConnected: true,
      expiresAt
    };
    this.classroomSessions.set(code, session);
    logger_default.info(`Created new classroom session: ${code} for session ${sessionId}`);
    return code;
  }
  /**
   * Validate classroom code
   */
  isValidClassroomCode(code) {
    console.log(`[DEBUG] isValidClassroomCode called with: ${code}`);
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      console.log(`[DEBUG] Classroom code ${code} has invalid format`);
      logger_default.info(`DEBUG: Classroom code ${code} has invalid format`);
      return false;
    }
    const session = this.classroomSessions.get(code);
    if (!session) {
      console.log(`[DEBUG] Classroom code ${code} not found in sessions`);
      logger_default.info(`DEBUG: Classroom code ${code} not found in sessions`);
      return false;
    }
    const now = Date.now();
    console.log(`[DEBUG] Checking expiration for code ${code}: now=${now}, expiresAt=${session.expiresAt}, expired=${now > session.expiresAt}`);
    logger_default.info(`DEBUG: Checking expiration for code ${code}: now=${now}, expiresAt=${session.expiresAt}, expired=${now > session.expiresAt}`);
    if (now > session.expiresAt) {
      this.classroomSessions.delete(code);
      console.log(`[DEBUG] Classroom code ${code} expired and removed`);
      logger_default.info(`Classroom code ${code} expired and removed`);
      return false;
    }
    session.lastActivity = Date.now();
    console.log(`[DEBUG] Classroom code ${code} is valid`);
    return true;
  }
  /**
   * Get session by classroom code
   */
  getSessionByCode(code) {
    return this.classroomSessions.get(code);
  }
  /**
   * Get all classroom sessions
   */
  getAllSessions() {
    return new Map(this.classroomSessions);
  }
  /**
   * Update session activity
   */
  updateActivity(code) {
    const session = this.classroomSessions.get(code);
    if (session) {
      session.lastActivity = Date.now();
    }
  }
  /**
   * Get classroom code by session ID
   */
  getClassroomCodeBySessionId(sessionId) {
    for (const [code, session] of this.classroomSessions.entries()) {
      if (session.sessionId === sessionId) {
        return code;
      }
    }
    return void 0;
  }
  /**
   * Set up periodic cleanup of expired classroom sessions
   */
  setupCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      for (const [code, session] of this.classroomSessions.entries()) {
        if (now > session.expiresAt) {
          this.classroomSessions.delete(code);
          cleaned++;
        }
      }
      if (cleaned > 0) {
        logger_default.info(`Cleaned up ${cleaned} expired classroom sessions`);
      }
    }, config.session.classroomCodeCleanupInterval);
  }
  /**
   * Clear all sessions (used for shutdown)
   */
  clear() {
    this.classroomSessions.clear();
  }
  /**
   * Clear all classroom sessions (for shutdown)
   */
  clearAll() {
    this.classroomSessions.clear();
    logger_default.info("All classroom sessions cleared");
  }
  /**
   * Shutdown the classroom session manager
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
    logger_default.info("ClassroomSessionManager shutdown completed");
  }
  /**
   * Get session metrics for diagnostics
   */
  getSessionMetrics() {
    const activeSessions = [];
    for (const [code, session] of this.classroomSessions.entries()) {
      if (Date.now() <= session.expiresAt) {
        activeSessions.push(code);
      }
    }
    return {
      totalSessions: this.classroomSessions.size,
      activeSessions
    };
  }
  /**
   * Get the number of active classroom sessions
   */
  getActiveSessionCount() {
    const now = Date.now();
    let activeCount = 0;
    for (const session of this.classroomSessions.values()) {
      if (now <= session.expiresAt) {
        activeCount++;
      }
    }
    return activeCount;
  }
  /**
   * Get all active sessions (primarily for debugging)
   */
  getActiveSessions() {
    const now = Date.now();
    const activeSessions = [];
    for (const session of this.classroomSessions.values()) {
      if (now <= session.expiresAt) {
        activeSessions.push(session);
      }
    }
    return activeSessions;
  }
  /**
   * Manually trigger cleanup of expired sessions (primarily for testing)
   */
  triggerCleanup() {
    const now = Date.now();
    let cleaned = 0;
    for (const [code, session] of this.classroomSessions.entries()) {
      if (now > session.expiresAt) {
        this.classroomSessions.delete(code);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger_default.info(`Manually triggered cleanup: cleaned up ${cleaned} expired classroom sessions`);
    }
    return cleaned;
  }
  /**
   * Add a classroom session directly (primarily for testing)
   */
  addSession(code, session) {
    this.classroomSessions.set(code, session);
  }
  /**
   * Check if a classroom code exists (primarily for testing)
   */
  hasSession(code) {
    return this.classroomSessions.has(code);
  }
  /**
   * Restore a classroom session from database (used during teacher reconnection)
   */
  restoreClassroomSession(classroomCode, sessionId) {
    const existingSession = this.classroomSessions.get(classroomCode);
    if (existingSession) {
      existingSession.lastActivity = Date.now();
      existingSession.teacherConnected = true;
      logger_default.info(`Restored existing classroom session: ${classroomCode} for session ${sessionId}`);
      return;
    }
    const session = {
      code: classroomCode,
      sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      teacherConnected: true,
      expiresAt: Date.now() + config.session.classroomCodeExpiration
      // Configurable expiration from now
    };
    this.classroomSessions.set(classroomCode, session);
    logger_default.info(`Restored classroom session: ${classroomCode} for session ${sessionId}`);
  }
};

// server/services/websocket/StorageSessionManager.ts
init_logger();
var StorageSessionManager = class {
  // Will be injected
  constructor(storage) {
    this.storage = storage;
  }
  /**
   * Set the classroom session manager (injected from WebSocketServer)
   */
  setClassroomSessionManager(classroomSessionManager) {
    this.classroomSessionManager = classroomSessionManager;
  }
  /**
   * Create session in storage for metrics tracking
   */
  async createSession(sessionId, teacherId) {
    try {
      const existingSession = await this.storage.getSessionById(sessionId);
      if (existingSession) {
        logger_default.info("Session already exists in storage:", { sessionId });
        if (existingSession.studentsCount && existingSession.studentsCount > 0 && !existingSession.isActive) {
          await this.storage.updateSession(sessionId, { isActive: true });
        }
        return;
      }
      const finalTeacherId = teacherId || `teacher_${sessionId}`;
      if (!teacherId) {
        logger_default.warn("Creating session without authenticated teacher ID - using fallback:", { sessionId, fallbackTeacherId: finalTeacherId });
      }
      let classCode;
      if (this.classroomSessionManager) {
        classCode = this.classroomSessionManager.generateClassroomCode(sessionId);
      } else {
        classCode = this.generateFallbackClassCode();
      }
      await this.storage.createSession({
        sessionId,
        teacherId: finalTeacherId,
        // Always provide a teacher ID
        classCode,
        // Provide the classroom code immediately
        isActive: true,
        // Session is active when teacher registers
        teacherLanguage: null,
        // Will be set when teacher registers
        studentLanguage: null,
        // Will be set when student registers
        lastActivityAt: /* @__PURE__ */ new Date()
        // Set initial activity timestamp
        // startTime is automatically set by the database default
      });
      logger_default.info("Successfully created new session in storage:", { sessionId, teacherId: finalTeacherId });
    } catch (error) {
      if (error?.code === "23505" || error?.details?.code === "23505" || error?.code === "DUPLICATE_ENTRY" && error?.details?.code === "23505" || error?.code === "CREATE_FAILED" && error?.details?.code === "23505") {
        logger_default.info("Session already exists (race condition detected):", { sessionId });
        return;
      }
      logger_default.error("Failed to create or update session in storage:", { sessionId, error });
    }
  }
  /**
   * Update session in storage
   */
  async updateSession(sessionId, updates) {
    try {
      const result = await this.storage.updateSession(sessionId, updates);
      return !!result;
    } catch (error) {
      logger_default.error("Failed to update session in storage:", { sessionId, error, updates });
      return false;
    }
  }
  /**
   * End session in storage
   */
  async endSession(sessionId) {
    try {
      await this.storage.endSession(sessionId);
      logger_default.info("Successfully ended session in storage:", { sessionId });
    } catch (error) {
      logger_default.error("Failed to end session in storage:", { sessionId, error });
    }
  }
  /**
   * Get session by ID
   */
  async getSession(sessionId) {
    try {
      return await this.storage.getSessionById(sessionId);
    } catch (error) {
      logger_default.error("Failed to get session from storage:", { sessionId, error });
      return null;
    }
  }
  /**
   * Check if session exists and is active
   */
  async isSessionActive(sessionId) {
    try {
      const session = await this.storage.getSessionById(sessionId);
      return session?.isActive ?? false;
    } catch (error) {
      logger_default.error("Failed to check session status:", { sessionId, error });
      return false;
    }
  }
  /**
   * Create session in storage with teacher language
   */
  async createSessionWithLanguage(sessionId, teacherLanguage, teacherId) {
    try {
      const existingSession = await this.storage.getSessionById(sessionId);
      if (existingSession) {
        logger_default.info("Session already exists in storage, updating teacher language:", { sessionId, teacherLanguage });
        const updates = {};
        updates.isActive = true;
        if (teacherLanguage && teacherLanguage !== "unknown") {
          updates.teacherLanguage = teacherLanguage;
        }
        if (Object.keys(updates).length > 0) {
          await this.storage.updateSession(sessionId, updates);
        }
        return;
      }
      const finalTeacherId = teacherId || `teacher_${sessionId}`;
      if (!teacherId) {
        logger_default.warn("Creating session without authenticated teacher ID - using fallback:", { sessionId, fallbackTeacherId: finalTeacherId });
      }
      let classCode;
      if (this.classroomSessionManager) {
        classCode = this.classroomSessionManager.generateClassroomCode(sessionId);
      } else {
        classCode = this.generateFallbackClassCode();
      }
      const sessionData = {
        sessionId,
        teacherId: finalTeacherId,
        // Always provide a teacher ID
        classCode,
        // Provide the classroom code immediately
        isActive: true,
        // Session is active when teacher registers
        lastActivityAt: /* @__PURE__ */ new Date()
        // Set initial activity timestamp
        // startTime is automatically set by the database default
      };
      if (teacherLanguage && teacherLanguage !== "unknown") {
        sessionData.teacherLanguage = teacherLanguage;
      }
      await this.storage.createSession(sessionData);
      logger_default.info("Successfully created new session in storage with teacher language:", { sessionId, teacherLanguage, teacherId: finalTeacherId });
    } catch (error) {
      logger_default.error("Failed to create or update session in storage:", { sessionId, teacherLanguage, error });
    }
  }
  /**
   * Generate a fallback classroom code when classroom session manager is not available
   */
  generateFallbackClassCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
};

// server/services/websocket/ConnectionHealthManager.ts
init_logger();
init_config();
var ConnectionHealthManager = class {
  constructor(wss) {
    this.heartbeatInterval = null;
    this.wss = wss;
    this.setupHeartbeat();
  }
  /**
   * Set up heartbeat mechanism to detect dead connections
   */
  setupHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const client = ws;
        if (!client.isAlive) {
          logger_default.info("Terminating dead connection", { sessionId: client.sessionId });
          return client.terminate();
        }
        client.isAlive = false;
        client.ping();
        try {
          client.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
        } catch (error) {
          logger_default.debug("Failed to send ping message, connection might be closing");
        }
      });
    }, config.session.healthCheckInterval);
  }
  /**
   * Mark a connection as alive (called when pong received)
   */
  markAlive(client) {
    client.isAlive = true;
  }
  /**
   * Initialize connection health tracking
   */
  initializeConnection(client) {
    client.isAlive = true;
    client.on("pong", () => {
      this.markAlive(client);
    });
  }
  /**
   * Get connection health status
   */
  isConnectionAlive(client) {
    return client.isAlive ?? false;
  }
  /**
   * Get health metrics for all connections
   */
  getHealthMetrics() {
    let totalConnections = 0;
    let aliveConnections = 0;
    let deadConnections = 0;
    this.wss.clients.forEach((ws) => {
      const client = ws;
      totalConnections++;
      if (client.isAlive) {
        aliveConnections++;
      } else {
        deadConnections++;
      }
    });
    return {
      totalConnections,
      aliveConnections,
      deadConnections
    };
  }
  /**
   * Shutdown the health manager
   */
  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    logger_default.info("ConnectionHealthManager shutdown completed");
  }
};

// server/services/websocket/ConnectionLifecycleManager.ts
init_logger();
init_config();
import { URL } from "url";
import { randomUUID, randomBytes } from "crypto";

// server/services/websocket/WebSocketResponseService.ts
init_logger();
var WebSocketResponseService = class {
  /**
   * Send an error response and close the connection
   */
  sendErrorAndClose(ws, error) {
    try {
      const errorMessage = {
        type: "error",
        message: error.message,
        code: error.type
      };
      ws.send(JSON.stringify(errorMessage));
      ws.close(error.closeCode, error.closeReason);
    } catch (sendError) {
      logger_default.error("Failed to send error response:", { error: sendError });
      try {
        ws.close(error.closeCode, error.closeReason);
      } catch (closeError) {
        logger_default.error("Failed to close connection after error:", { error: closeError });
      }
    }
  }
  /**
   * Send connection confirmation message
   */
  sendConnectionConfirmation(ws, sessionId, classroomCode) {
    try {
      const connectionMessage = {
        type: "connection",
        status: "connected",
        sessionId,
        ...classroomCode && { classroomCode }
      };
      ws.send(JSON.stringify(connectionMessage));
    } catch (error) {
      logger_default.error("Error sending connection confirmation:", { error });
    }
  }
  /**
   * Send a generic message safely with error handling
   */
  sendMessage(ws, message, context) {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      logger_default.error(`Failed to send ${context || "message"}:`, { error, message });
    }
  }
};

// server/services/websocket/ConnectionLifecycleManager.ts
var ConnectionLifecycleManager = class {
  // WebSocketServer instance for accessing SessionCleanupService
  constructor(connectionManager, classroomSessionManager, storageSessionManager, connectionHealthManager, messageDispatcher, webSocketServer) {
    this.sessionCounter = 0;
    this.connectionManager = connectionManager;
    this.classroomSessionManager = classroomSessionManager;
    this.storageSessionManager = storageSessionManager;
    this.connectionHealthManager = connectionHealthManager;
    this.messageDispatcher = messageDispatcher;
    this.responseService = new WebSocketResponseService();
    this.webSocketServer = webSocketServer;
  }
  /**
   * Handle new WebSocket connection
   */
  async handleConnection(ws, request) {
    logger_default.info("New WebSocket connection established");
    this.connectionHealthManager.initializeConnection(ws);
    const { sessionId, classroomCode } = this.parseConnectionRequest(request);
    console.log(`[DEBUG] ConnectionLifecycleManager: parsed classroomCode=${classroomCode}, sessionId=${sessionId}`);
    if (classroomCode && !this.classroomSessionManager.isValidClassroomCode(classroomCode)) {
      console.log(`[DEBUG] ConnectionLifecycleManager: Invalid classroom code ${classroomCode} - closing connection`);
      logger_default.warn(`Invalid classroom code attempted: ${classroomCode}`);
      ws.send(JSON.stringify({
        type: "error",
        message: "Classroom session expired or invalid. Please ask teacher for new link.",
        code: "INVALID_CLASSROOM"
      }));
      ws.close(1008, "Invalid classroom session");
      return;
    }
    console.log(`[DEBUG] ConnectionLifecycleManager: Classroom code ${classroomCode} is valid or not provided - continuing`);
    this.connectionManager.addConnection(ws, sessionId, classroomCode || void 0);
    try {
      logger_default.info("Sending connection confirmation:", { sessionId, classroomCode });
      this.responseService.sendConnectionConfirmation(ws, sessionId, classroomCode || void 0);
      logger_default.info("Connection confirmation sent successfully");
    } catch (error) {
      logger_default.error("Failed to send connection confirmation:", { sessionId, error });
    }
    this.setupConnectionEventHandlers(ws);
  }
  /**
   * Parse connection request to extract session ID and classroom code
   */
  parseConnectionRequest(request) {
    let sessionId = this.generateSessionId();
    let classroomCode = null;
    if (request?.url) {
      const baseUrl = `http://${config.server.host}:${config.server.port}`;
      const url = new URL(request.url, baseUrl);
      classroomCode = url.searchParams.get("class") || url.searchParams.get("code");
      if (classroomCode) {
        const session = this.classroomSessionManager.getSessionByCode(classroomCode);
        if (session) {
          sessionId = session.sessionId;
          logger_default.info(`Client joining classroom ${classroomCode} with session ${sessionId}`);
        }
      }
    }
    return { sessionId, classroomCode };
  }
  /**
   * Set up event handlers for a WebSocket connection
   */
  setupConnectionEventHandlers(ws) {
    ws.on("close", async () => {
      await this.handleConnectionClose(ws);
    });
    ws.on("error", (error) => {
      logger_default.error("WebSocket error:", { error });
    });
  }
  /**
   * Send connection confirmation to client
   */
  sendConnectionConfirmation(ws, classroomCode, sessionId) {
    try {
      const finalSessionId = sessionId || this.connectionManager.getSessionId(ws);
      this.responseService.sendConnectionConfirmation(ws, finalSessionId || "unknown", classroomCode || void 0);
    } catch (error) {
      logger_default.error("Error sending connection confirmation:", { error });
    }
  }
  /**
   * Handle WebSocket connection close
   */
  async handleConnectionClose(ws) {
    const sessionId = this.connectionManager.getSessionId(ws);
    const role = this.connectionManager.getRole(ws);
    logger_default.info("WebSocket connection closed", { sessionId, role });
    this.connectionManager.removeConnection(ws);
    if (sessionId && role === "student") {
      if (this.connectionManager.isStudentCounted(ws)) {
        try {
          const session = await this.webSocketServer?.storage?.getActiveSession(sessionId);
          if (session && session.studentsCount > 0) {
            await this.webSocketServer.storageSessionManager.updateSession(sessionId, {
              studentsCount: session.studentsCount - 1
            });
            logger_default.info(`Decremented studentsCount for session ${sessionId} to ${session.studentsCount - 1}`);
          }
        } catch (error) {
          logger_default.error("Error updating studentsCount on disconnect:", error);
        }
      }
      const remainingStudents = this.countActiveStudentsInSession(sessionId);
      const remainingTeachers = this.countActiveTeachersInSession(sessionId);
      logger_default.info(`Student disconnected from session ${sessionId}. Remaining: ${remainingStudents} students, ${remainingTeachers} teachers`);
      if (remainingStudents === 0) {
        if (remainingTeachers > 0) {
          try {
            const cleanupService = this.webSocketServer?.getSessionCleanupService();
            if (cleanupService) {
              await cleanupService.markAllStudentsLeft(sessionId);
            }
          } catch (error) {
            logger_default.error("Error marking students left:", error);
          }
        } else {
          try {
            const cleanupService = this.webSocketServer?.getSessionCleanupService();
            if (cleanupService) {
              await cleanupService.endSession(sessionId, "All users disconnected");
            }
          } catch (error) {
            logger_default.error("Error ending session:", error);
          }
        }
      }
    } else if (sessionId && role === "teacher") {
      const remainingStudents = this.countActiveStudentsInSession(sessionId);
      const remainingTeachers = this.countActiveTeachersInSession(sessionId);
      logger_default.info(`Teacher disconnected from session ${sessionId}. Remaining: ${remainingStudents} students, ${remainingTeachers} teachers`);
      if (remainingTeachers === 0 && remainingStudents === 0) {
        try {
          const session = await this.webSocketServer?.storage?.getActiveSession(sessionId);
          const cleanupService = this.webSocketServer?.getSessionCleanupService();
          if (session && cleanupService) {
            const hadStudents = session.studentsCount > 0;
            const sessionStartTime = session.startTime || session.lastActivityAt;
            const sessionAge = sessionStartTime ? Date.now() - sessionStartTime.getTime() : 0;
            const isVeryShortSession = sessionAge < config.session.veryShortSessionThreshold;
            if (hadStudents) {
              await cleanupService.endSession(sessionId, "All users disconnected");
              logger_default.info(`Ended session ${sessionId} immediately - all users disconnected from session with students.`);
            } else if (isVeryShortSession && !session.teacherId) {
              await cleanupService.endSession(sessionId, "Teacher disconnected, session too short");
              logger_default.info(`Ended short teacher-only session ${sessionId} immediately - session was too short.`);
            } else {
              await cleanupService.updateSessionActivity(sessionId);
              logger_default.info(`Teacher disconnected from teacher-only session ${sessionId}. Starting grace period for teacher reconnection.`);
            }
          }
        } catch (error) {
          logger_default.error("Error handling teacher disconnect:", error);
        }
      } else if (remainingTeachers === 0 && remainingStudents > 0) {
        try {
          const cleanupService = this.webSocketServer?.getSessionCleanupService();
          if (cleanupService) {
            await cleanupService.updateSessionActivity(sessionId);
            logger_default.info(`Teacher disconnected from session ${sessionId} with ${remainingStudents} students. Session activity updated.`);
          }
        } catch (error) {
          logger_default.error("Error updating session activity on teacher disconnect:", error);
        }
      }
    }
  }
  /**
   * Count active students in a session
   */
  countActiveStudentsInSession(sessionId) {
    let count2 = 0;
    for (const conn of this.connectionManager.getConnections()) {
      if (this.connectionManager.getSessionId(conn) === sessionId && this.connectionManager.getRole(conn) === "student") {
        count2++;
      }
    }
    return count2;
  }
  /**
   * Count active teachers in a session
   */
  countActiveTeachersInSession(sessionId) {
    let count2 = 0;
    for (const conn of this.connectionManager.getConnections()) {
      if (this.connectionManager.getSessionId(conn) === sessionId && this.connectionManager.getRole(conn) === "teacher") {
        count2++;
      }
    }
    return count2;
  }
  /**
   * Check if there are other connections with the same session ID
   */
  hasOtherConnectionsWithSessionId(sessionId) {
    if (!sessionId) return false;
    let connectionsWithSameSession = 0;
    for (const connection of this.connectionManager.getConnections()) {
      if (this.connectionManager.getSessionId(connection) === sessionId) {
        connectionsWithSameSession++;
      }
    }
    return connectionsWithSameSession > 1;
  }
  /**
   * Generate a unique session ID
   */
  generateSessionId() {
    try {
      return `session-${randomUUID()}`;
    } catch (error) {
      const randomBytesHex = randomBytes(16).toString("hex");
      this.sessionCounter++;
      return `session-${this.sessionCounter}-${Date.now()}-${randomBytesHex}`;
    }
  }
  /**
   * Get lifecycle metrics
   */
  getLifecycleMetrics() {
    return {
      sessionsCreated: this.sessionCounter,
      currentSessionId: this.sessionCounter
    };
  }
};

// server/services/websocket/ConnectionValidationService.ts
init_logger();
var ConnectionValidationService = class {
  constructor(classroomSessionManager) {
    this.classroomSessionManager = classroomSessionManager;
    this.responseService = new WebSocketResponseService();
  }
  /**
   * Validate a WebSocket connection with optional classroom code
   */
  validateConnection(classroomCode) {
    if (!classroomCode) {
      return { isValid: true };
    }
    if (!this.classroomSessionManager.isValidClassroomCode(classroomCode)) {
      logger_default.warn(`Invalid classroom code attempted: ${classroomCode}`);
      return {
        isValid: false,
        error: {
          type: "INVALID_CLASSROOM",
          message: "Classroom session expired or invalid. Please ask teacher for new link.",
          closeCode: 1008,
          closeReason: "Invalid classroom session"
        }
      };
    }
    return { isValid: true };
  }
  /**
   * Send validation error response and close connection
   */
  handleValidationError(ws, error) {
    if (!error) return;
    this.responseService.sendErrorAndClose(ws, error);
  }
};

// server/services/websocket/SessionMetricsService.ts
var SessionMetricsService = class {
  constructor(connectionManager, classroomSessionManager) {
    this.connectionManager = connectionManager;
    this.classroomSessionManager = classroomSessionManager;
  }
  /**
   * Calculate active session metrics
   */
  calculateActiveSessionMetrics() {
    const activeSessions = /* @__PURE__ */ new Set();
    let studentsConnected = 0;
    let teachersConnected = 0;
    const currentLanguages = /* @__PURE__ */ new Set();
    const connections = this.connectionManager.getConnections();
    for (const connection of connections) {
      const sessionId = this.connectionManager.getSessionId(connection);
      const role = this.connectionManager.getRole(connection);
      const language = this.connectionManager.getLanguage(connection);
      if (sessionId) {
        const classroomCode = this.classroomSessionManager.getClassroomCodeBySessionId(sessionId);
        if (classroomCode) {
          activeSessions.add(classroomCode);
        }
      }
      if (role === "student") {
        studentsConnected++;
      } else if (role === "teacher") {
        teachersConnected++;
        if (language) {
          currentLanguages.add(language);
        }
      }
    }
    return {
      activeSessions: activeSessions.size,
      studentsConnected,
      teachersConnected,
      currentLanguages: Array.from(currentLanguages)
    };
  }
};

// server/services/SessionLifecycleService.ts
init_logger();
var SessionLifecycleService = class {
  // 5 minutes
  constructor(storage) {
    this.storage = storage;
    this.MIN_SESSION_DURATION = 3e4;
    // 30 seconds
    this.DEFAULT_INACTIVE_TIMEOUT = 5 * 60 * 1e3;
  }
  /**
   * Classify a session based on its activity and duration
   */
  classifySession(session, transcriptCount) {
    const startTime = session.startTime ? session.startTime.getTime() : Date.now();
    const endTime = session.endTime ? session.endTime.getTime() : Date.now();
    const duration = endTime - startTime;
    if (duration < this.MIN_SESSION_DURATION) {
      return {
        isReal: false,
        reason: "too_short",
        studentsCount: session.studentsCount || 0,
        totalTranslations: session.totalTranslations || 0,
        duration,
        transcriptCount
      };
    }
    if (session.studentsCount === 0) {
      return {
        isReal: false,
        reason: "no_students",
        studentsCount: 0,
        totalTranslations: session.totalTranslations || 0,
        duration,
        transcriptCount
      };
    }
    if ((session.totalTranslations || 0) === 0 && transcriptCount === 0) {
      return {
        isReal: false,
        reason: "no_activity",
        studentsCount: session.studentsCount || 0,
        totalTranslations: 0,
        duration,
        transcriptCount: 0
      };
    }
    return {
      isReal: true,
      reason: "real",
      studentsCount: session.studentsCount || 0,
      totalTranslations: session.totalTranslations || 0,
      duration,
      transcriptCount
    };
  }
  /**
   * Update session activity timestamp
   */
  async updateSessionActivity(sessionId) {
    try {
      const existingSession = await this.storage.getActiveSession(sessionId);
      if (!existingSession) {
        logger_default.debug("Session not yet persisted to database, skipping activity update", { sessionId });
        return;
      }
      await this.storage.updateSession(sessionId, {
        lastActivityAt: /* @__PURE__ */ new Date()
      });
      logger_default.debug("Updated session activity", { sessionId });
    } catch (error) {
      logger_default.error("Failed to update session activity", { sessionId, error });
    }
  }
  /**
   * Process inactive sessions and end them if needed
   */
  async processInactiveSessions(inactiveTimeoutMs = this.DEFAULT_INACTIVE_TIMEOUT) {
    const result = {
      endedCount: 0,
      classifiedCount: 0
    };
    try {
      const activeSessions = await this.storage.getAllActiveSessions();
      const now = /* @__PURE__ */ new Date();
      const cutoffTime = new Date(now.getTime() - inactiveTimeoutMs);
      for (const session of activeSessions) {
        const lastActivity = session.lastActivityAt || session.startTime;
        if (lastActivity && lastActivity < cutoffTime) {
          const classification = this.classifySession(session, 0);
          await this.storage.updateSession(session.sessionId, {
            isActive: false,
            endTime: now,
            quality: classification.isReal ? "real" : classification.reason,
            qualityReason: this.getQualityReasonText(classification)
          });
          result.endedCount++;
          result.classifiedCount++;
          logger_default.info("Ended inactive session", {
            sessionId: session.sessionId,
            quality: classification.reason,
            inactiveFor: now.getTime() - (lastActivity?.getTime() || 0)
          });
        }
      }
      logger_default.info("Processed inactive sessions", result);
      return result;
    } catch (error) {
      logger_default.error("Failed to process inactive sessions", { error });
      return result;
    }
  }
  /**
   * Clean up and classify dead sessions
   */
  async cleanupDeadSessions(limit = 100) {
    const result = {
      classified: 0,
      deadSessions: 0,
      realSessions: 0
    };
    try {
      const recentActivity = await this.storage.getRecentSessionActivity(limit);
      for (const activity of recentActivity) {
        const session = await this.storage.getSessionById(activity.sessionId);
        if (!session || session.quality !== "unknown") {
          continue;
        }
        const classification = this.classifySession(session, activity.transcriptCount);
        let quality;
        if (classification.isReal) {
          quality = "real";
        } else {
          quality = classification.reason;
        }
        await this.storage.updateSession(session.sessionId, {
          quality,
          qualityReason: this.getQualityReasonText(classification)
        });
        result.classified++;
        if (classification.isReal) {
          result.realSessions++;
        } else {
          result.deadSessions++;
        }
        logger_default.debug("Classified session", {
          sessionId: session.sessionId,
          quality,
          reason: classification.reason
        });
      }
      logger_default.info("Cleaned up dead sessions", result);
      return result;
    } catch (error) {
      logger_default.error("Failed to cleanup dead sessions", { error });
      return result;
    }
  }
  /**
   * Get human-readable quality reason text
   */
  getQualityReasonText(classification) {
    switch (classification.reason) {
      case "no_students":
        return `No students joined this session (duration: ${Math.round(classification.duration / 1e3)}s)`;
      case "no_activity":
        return `Session had ${classification.studentsCount} students but no translations or transcripts (duration: ${Math.round(classification.duration / 1e3)}s)`;
      case "too_short":
        return `Session was too short (${Math.round(classification.duration / 1e3)}s) to be meaningful`;
      case "real":
        return `Session had meaningful activity: ${classification.studentsCount} students, ${classification.totalTranslations} translations, ${classification.transcriptCount} transcripts`;
      default:
        return "Unknown classification reason";
    }
  }
  /**
   * Get session quality statistics
   */
  async getQualityStatistics() {
    try {
      return await this.storage.getSessionQualityStats();
    } catch (error) {
      logger_default.error("Failed to get quality statistics", { error });
      return {
        total: 0,
        real: 0,
        dead: 0,
        breakdown: {}
      };
    }
  }
};

// server/services/SessionCountCacheService.ts
init_logger();
var SessionCountCacheService = class {
  constructor(storage) {
    this.cachedActiveSessionCount = 0;
    this.cacheInterval = null;
    this.CACHE_UPDATE_INTERVAL_MS = 30 * 1e3;
    // 30 seconds
    this.isRunning = false;
    this.storage = storage;
  }
  /**
   * Start the cache service
   */
  start() {
    if (this.isRunning) {
      logger_default.warn("SessionCountCacheService is already running");
      return;
    }
    this.isRunning = true;
    this.updateCache();
    this.cacheInterval = setInterval(() => {
      if (this.isRunning) {
        this.updateCache();
      }
    }, this.CACHE_UPDATE_INTERVAL_MS);
    logger_default.info("SessionCountCacheService started");
  }
  /**
   * Stop the cache service
   */
  stop() {
    this.isRunning = false;
    if (this.cacheInterval) {
      clearInterval(this.cacheInterval);
      this.cacheInterval = null;
    }
    logger_default.info("SessionCountCacheService stopped");
  }
  /**
   * Get the cached active session count
   */
  getActiveSessionCount() {
    return this.cachedActiveSessionCount;
  }
  /**
   * Invalidate and immediately update the cache
   */
  async invalidateCache() {
    if (!this.isRunning) {
      return;
    }
    try {
      await this.updateCache();
    } catch (error) {
      logger_default.error("Failed to invalidate session count cache:", { error });
    }
  }
  /**
   * Update storage instance (for test isolation)
   */
  updateStorage(newStorage) {
    this.storage = newStorage;
    if (this.isRunning) {
      this.updateCache();
    }
  }
  /**
   * Check if the service is currently running
   */
  isServiceRunning() {
    return this.isRunning;
  }
  /**
   * Update the cached active session count from database
   */
  async updateCache() {
    if (!this.isRunning) {
      return;
    }
    try {
      const activeSessions = await this.storage.getAllActiveSessions();
      this.cachedActiveSessionCount = activeSessions.length;
    } catch (error) {
      if (error?.message?.includes("pool after calling end") || error?.details?.message?.includes("pool after calling end")) {
        logger_default.warn("SessionCountCacheService: Database connection closed, stopping service");
        this.stop();
        return;
      }
      logger_default.error("Failed to update session count cache:", { error });
    }
  }
};

// server/services/websocket/MessageHandler.ts
init_logger();
init_config();
var MessageHandlerRegistry = class {
  constructor() {
    this.handlers = /* @__PURE__ */ new Map();
  }
  /**
   * Register a message handler for a specific message type
   */
  register(handler) {
    this.handlers.set(handler.getMessageType(), handler);
  }
  /**
   * Get a handler for a specific message type
   */
  getHandler(messageType) {
    return this.handlers.get(messageType);
  }
  /**
   * Check if a handler exists for a message type
   */
  hasHandler(messageType) {
    return this.handlers.has(messageType);
  }
  /**
   * Get all registered message types
   */
  getRegisteredTypes() {
    return Array.from(this.handlers.keys());
  }
};
var MessageDispatcher = class {
  constructor(registry, context) {
    this.registry = registry;
    this.context = context;
  }
  /**
   * Dispatch a message to the appropriate handler
   */
  async dispatch(ws, data) {
    try {
      const message = JSON.parse(data);
      const skipValidation = ["register", "ping", "pong"].includes(message.type);
      if (!skipValidation) {
        const sessionId = this.context.connectionManager.getSessionId(ws);
        if (sessionId) {
          try {
            const session = await this.context.storage.getSessionById(sessionId);
            if (!session || !session.isActive) {
              const errorResponse = {
                type: "session_expired",
                message: "Your class session has ended. Please ask your teacher for a new link.",
                code: "SESSION_EXPIRED"
              };
              ws.send(JSON.stringify(errorResponse));
              setTimeout(() => {
                if (typeof ws.close === "function") {
                  ws.close(1008, "Session expired");
                }
              }, config.session.sessionExpiredMessageDelay);
              logger_default.info(`Rejected message from expired session: ${sessionId}`);
              return;
            }
          } catch (error) {
            logger_default.error("Error validating session:", { sessionId, error });
          }
        }
      }
      const handler = this.registry.getHandler(message.type);
      if (handler) {
        const contextWithWs = { ...this.context, ws };
        await handler.handle(message, contextWithWs);
      } else {
        logger_default.warn("Unknown message type:", { type: message.type });
      }
    } catch (error) {
      logger_default.error("Error handling message:", { error, data });
    }
  }
};

// server/services/websocket/RegisterMessageHandler.ts
init_logger();
init_config();
var RegisterMessageHandler = class {
  getMessageType() {
    return "register";
  }
  async handle(message, context) {
    logger_default.info(
      "Processing message type=register from connection:",
      { role: message.role, languageCode: message.languageCode, name: message.name }
    );
    const currentRole = context.connectionManager.getRole(context.ws);
    if (message.role) {
      if (currentRole !== message.role) {
        logger_default.info(`Changing connection role from ${currentRole} to ${message.role}`);
      }
      context.connectionManager.setRole(context.ws, message.role);
      if (message.role === "teacher") {
        await this.handleTeacherRegistration(context.ws, message, context);
      }
    }
    if (message.languageCode) {
      context.connectionManager.setLanguage(context.ws, message.languageCode);
    }
    const settings = context.connectionManager.getClientSettings(context.ws) || {};
    if (message.settings) {
      Object.assign(settings, message.settings);
      logger_default.info("Client settings updated:", message.settings);
    }
    context.connectionManager.setClientSettings(context.ws, settings);
    logger_default.info(
      "Updated connection:",
      { role: context.connectionManager.getRole(context.ws), languageCode: context.connectionManager.getLanguage(context.ws), settings }
    );
    if (message.role === "student") {
      const classroomCode = message.classroomCode || context.connectionManager.getClassroomCode(context.ws);
      logger_default.info(`DEBUG: Student registration - classroomCode from message: ${message.classroomCode}, from connection: ${context.connectionManager.getClassroomCode(context.ws)}, final: ${classroomCode}`);
      if (classroomCode) {
        console.log(`[DEBUG] Validating classroom code: ${classroomCode}`);
        logger_default.info(`DEBUG: Validating classroom code: ${classroomCode}`);
        if (!context.webSocketServer._classroomSessionManager.isValidClassroomCode(classroomCode)) {
          console.log(`[DEBUG] Student registration FAILED - invalid classroom code: ${classroomCode}`);
          logger_default.warn(`Student attempted to register with invalid classroom code: ${classroomCode}`);
          const errorResponse = {
            type: "error",
            message: "Classroom session expired or invalid. Please ask teacher for new link.",
            code: "INVALID_CLASSROOM"
          };
          context.ws.send(JSON.stringify(errorResponse));
          if (typeof context.ws.close === "function") {
            setTimeout(() => {
              context.ws.close(1008, "Invalid classroom session");
            }, config.session.invalidClassroomMessageDelay);
          }
          return;
        }
        console.log(`[DEBUG] Student registration SUCCESS - valid classroom code: ${classroomCode}`);
      } else {
        console.log("[DEBUG] No classroom code provided, skipping validation");
      }
    }
    const response = {
      type: "register",
      status: "success",
      data: {
        role: context.connectionManager.getRole(context.ws),
        languageCode: context.connectionManager.getLanguage(context.ws),
        settings
      }
    };
    context.ws.send(JSON.stringify(response));
    if (message.role === "student") {
      await this.handleStudentRegistration(context.ws, message, context);
    }
  }
  /**
   * Handle teacher registration specifics
   */
  async handleTeacherRegistration(ws, message, context) {
    let sessionId = context.connectionManager.getSessionId(context.ws);
    let classroomCode;
    let wasExistingSession = false;
    console.log(`\u{1F50D} DEBUG: handleTeacherRegistration - sessionId from connection: ${sessionId}, message.teacherId: ${message.teacherId || "NONE"}`);
    if (!sessionId) {
      logger_default.error("Teacher has no session ID - this should not happen");
      return;
    }
    if (message.teacherId) {
      try {
        logger_default.info(`[TEACHER_RECONNECT] Looking for existing session with teacherId: ${message.teacherId}`);
        let existingSession = await context.storage.findActiveSessionByTeacherId(message.teacherId);
        if (!existingSession) {
          logger_default.info(`[TEACHER_RECONNECT] No active session found, checking for recent sessions for teacherId: ${message.teacherId}`);
          const recentSession = await context.storage.findRecentSessionByTeacherId(message.teacherId, 10);
          if (recentSession && !recentSession.isActive) {
            logger_default.info(`[TEACHER_RECONNECT] Found recent inactive session, reactivating: ${recentSession.sessionId}`);
            existingSession = await context.storage.reactivateSession(recentSession.sessionId);
            if (existingSession) {
              logger_default.info(`[TEACHER_RECONNECT] Successfully reactivated session: ${existingSession.sessionId}`);
            } else {
              logger_default.warn(`[TEACHER_RECONNECT] Failed to reactivate session: ${recentSession.sessionId}`);
            }
          }
        }
        logger_default.info("[TEACHER_RECONNECT] Found existing session:", existingSession ? {
          sessionId: existingSession.sessionId,
          teacherId: existingSession.teacherId,
          isActive: existingSession.isActive,
          classCode: existingSession.classCode
        } : "NONE");
        if (existingSession && existingSession.sessionId !== sessionId) {
          logger_default.info(`[TEACHER_RECONNECT] Teacher has existing active session with teacherId: ${existingSession.sessionId}, current session: ${sessionId}`);
          logger_default.info(`[TEACHER_RECONNECT] Teacher reconnecting to existing session with teacherId: ${existingSession.sessionId}`);
          const cleanupService = context.webSocketServer.getSessionCleanupService();
          if (cleanupService) {
            await cleanupService.endSession(sessionId, "Duplicate session - teacher reconnected to existing with teacherId");
          }
          sessionId = existingSession.sessionId;
          wasExistingSession = true;
          context.connectionManager.updateSessionId(context.ws, existingSession.sessionId);
          if (cleanupService) {
            await cleanupService.updateSessionActivity(sessionId);
          }
          if (existingSession.classCode) {
            context.webSocketServer.classroomSessionManager.restoreClassroomSession(
              existingSession.classCode,
              sessionId
            );
            logger_default.info(`[TEACHER_RECONNECT] Restored classroom code ${existingSession.classCode} for reconnected teacher session ${sessionId}`);
          }
        } else if (existingSession && existingSession.sessionId === sessionId) {
          logger_default.info("[TEACHER_RECONNECT] Teacher connected to same session as existing - no action needed");
        } else {
          logger_default.info(`[TEACHER_RECONNECT] No existing session found for teacherId: ${message.teacherId}, proceeding with new session: ${sessionId}`);
        }
      } catch (error) {
        logger_default.error("Error searching for existing teacher sessions by teacherId:", {
          teacherId: message.teacherId,
          errorMessage: error?.message || "No error message",
          errorStack: error?.stack || "No stack trace",
          errorCode: error?.code || "No error code",
          errorName: error?.name || "No error name",
          fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
        });
      }
    } else if (message.languageCode) {
      try {
        const activeSessions = await context.storage.getAllActiveSessions();
        const existingSession = activeSessions.find(
          (s) => s.teacherLanguage === message.languageCode && s.isActive && s.sessionId !== sessionId
        );
        if (existingSession) {
          logger_default.info(`Teacher has existing active session: ${existingSession.sessionId}, current session: ${sessionId}`);
          const existingSessionAge = (/* @__PURE__ */ new Date()).getTime() - new Date(existingSession.lastActivityAt).getTime();
          const gracePermissionMs = config.session.teacherReconnectionGracePeriod;
          if (existingSessionAge < gracePermissionMs) {
            logger_default.info(`Teacher reconnecting to existing recent session: ${existingSession.sessionId}`);
            const cleanupService = context.webSocketServer.getSessionCleanupService();
            if (cleanupService) {
              await cleanupService.endSession(sessionId, "Duplicate session - teacher reconnected to existing");
            }
            sessionId = existingSession.sessionId;
            wasExistingSession = true;
            context.connectionManager.updateSessionId(context.ws, existingSession.sessionId);
            if (cleanupService) {
              await cleanupService.updateSessionActivity(sessionId);
            }
            if (existingSession.classCode) {
              context.webSocketServer.classroomSessionManager.restoreClassroomSession(
                existingSession.classCode,
                sessionId
              );
              logger_default.info(`Restored classroom code ${existingSession.classCode} for reconnected teacher session ${sessionId}`);
            }
          } else {
            logger_default.info(`Ending existing session ${existingSession.sessionId} - teacher created new session ${sessionId}`);
            const cleanupService = context.webSocketServer.getSessionCleanupService();
            if (cleanupService) {
              await cleanupService.endSession(existingSession.sessionId, "Teacher created new session");
            }
          }
        }
      } catch (error) {
        logger_default.error("Error searching for existing teacher sessions:", { error, teacherLanguage: message.languageCode });
      }
    }
    try {
      let session = await context.storage.getActiveSession(sessionId);
      if (!session && !wasExistingSession) {
        if (!wasExistingSession) {
          logger_default.info("Creating new session for teacher:", { sessionId, languageCode: message.languageCode, teacherId: message.teacherId });
          await context.webSocketServer.storageSessionManager.createSession(sessionId, message.teacherId);
          session = await context.storage.getActiveSession(sessionId);
        } else {
          session = await context.storage.getActiveSession(sessionId);
        }
      } else {
        logger_default.info("Using existing session for teacher:", { sessionId });
      }
      console.log(`\u{1F50D} DEBUG: About to generate classroom code for sessionId: ${sessionId}`);
      classroomCode = context.webSocketServer.classroomSessionManager.generateClassroomCode(sessionId);
      if (sessionId && classroomCode) {
        try {
          const currentSession = await context.storage.getSessionById(sessionId);
          if (currentSession && !currentSession.classCode) {
            await context.webSocketServer.storageSessionManager.updateSession(sessionId, {
              classCode: classroomCode
            });
            logger_default.info(`Stored classroom code ${classroomCode} for session ${sessionId}`);
          }
        } catch (error) {
          logger_default.error("Error storing classroom code:", { error, sessionId, classroomCode });
        }
      }
    } catch (error) {
      logger_default.error("Failed to create/get session for teacher:", { error, sessionId });
      console.log(`\u{1F50D} DEBUG: About to generate classroom code (fallback) for sessionId: ${sessionId}`);
      classroomCode = context.webSocketServer.classroomSessionManager.generateClassroomCode(sessionId);
    }
    const sessionInfo = context.webSocketServer.classroomSessionManager.getSessionByCode(classroomCode);
    if (sessionId && message.languageCode) {
      try {
        const updateData = {
          teacherLanguage: message.languageCode
        };
        const result = await context.webSocketServer.storageSessionManager.updateSession(sessionId, updateData);
        if (!result) {
          logger_default.warn("Failed to update session with teacher language", { sessionId });
        }
      } catch (error) {
        logger_default.error("Error updating session with teacher language:", { error, sessionId });
      }
    }
    const response = {
      type: "classroom_code",
      code: classroomCode,
      sessionId,
      expiresAt: sessionInfo?.expiresAt || Date.now() + config.session.classroomCodeExpiration
      // Fallback expiration
    };
    context.ws.send(JSON.stringify(response));
    logger_default.info(`Generated classroom code ${classroomCode} for teacher session ${sessionId}`);
  }
  /**
   * Handle student registration specifics
   */
  async handleStudentRegistration(ws, message, context) {
    let studentSessionId = context.connectionManager.getSessionId(context.ws);
    const studentName = message.name || "Unknown Student";
    const studentLanguage = message.languageCode || "unknown";
    const classroomCode = context.connectionManager.getClassroomCode(context.ws) || message.classroomCode;
    logger_default.info("[DEBUG] Student registration started:", {
      studentSessionId,
      studentName,
      studentLanguage,
      classroomCode,
      messageClassroomCode: message.classroomCode,
      connectionClassroomCode: context.connectionManager.getClassroomCode(context.ws)
    });
    if (!studentSessionId) {
      logger_default.error("Student has no session ID - this should not happen");
      return;
    }
    try {
      let session = await context.storage.getSessionById(studentSessionId);
      if (session && session.endTime) {
        logger_default.warn("Student trying to join ended session:", { studentSessionId, endTime: session.endTime });
        session = null;
      }
      logger_default.info("[DEBUG] Student session lookup:", {
        studentSessionId,
        sessionFound: !!session,
        sessionData: session ? {
          id: session.id,
          sessionId: session.sessionId,
          isActive: session.isActive,
          studentsCount: session.studentsCount,
          classCode: session.classCode
        } : null,
        classroomCode
      });
      if (!session && classroomCode) {
        logger_default.info("[DEBUG] Looking up teacher session by classroom code:", { classroomCode });
        const sessionInfo = context.webSocketServer.classroomSessionManager.getSessionByCode(classroomCode);
        logger_default.info("[DEBUG] Teacher session lookup result:", {
          sessionInfo: sessionInfo ? {
            sessionId: sessionInfo.sessionId,
            expiresAt: sessionInfo.expiresAt
          } : null
        });
        if (sessionInfo) {
          session = await context.storage.getSessionById(sessionInfo.sessionId);
          if (session && session.endTime) {
            logger_default.warn("Student trying to join ended session via classroom code:", {
              sessionId: sessionInfo.sessionId,
              endTime: session.endTime
            });
            session = null;
          }
          logger_default.info("[DEBUG] Teacher session from storage:", {
            teacherSessionId: sessionInfo.sessionId,
            sessionFound: !!session,
            sessionData: session ? {
              id: session.id,
              sessionId: session.sessionId,
              isActive: session.isActive,
              studentsCount: session.studentsCount,
              classCode: session.classCode
            } : null
          });
          if (session) {
            context.connectionManager.updateSessionId(context.ws, sessionInfo.sessionId);
            logger_default.info("[DEBUG] Student session ID updated to match teacher session:", {
              oldSessionId: studentSessionId,
              newSessionId: sessionInfo.sessionId,
              classroomCode
            });
            studentSessionId = sessionInfo.sessionId;
          }
        }
      }
      if (!session) {
        logger_default.error("Student trying to join non-existent session:", { studentSessionId, classroomCode });
        const errorResponse = {
          type: "error",
          message: "Session not found. Please ask teacher for a new link.",
          code: "SESSION_NOT_FOUND"
        };
        context.ws.send(JSON.stringify(errorResponse));
        return;
      }
      const currentCount = session.studentsCount || 0;
      const alreadyCounted = context.connectionManager.isStudentCounted(context.ws);
      logger_default.info("Student registration details:", {
        sessionId: studentSessionId,
        currentCount,
        studentName,
        alreadyCounted,
        classroomCode
      });
      try {
        const updateData = {
          studentsCount: alreadyCounted ? currentCount : currentCount + 1,
          isActive: true
        };
        if (!alreadyCounted && currentCount === 0) {
          updateData.startTime = /* @__PURE__ */ new Date();
          logger_default.info("[DEBUG] First student joining - updating startTime:", {
            sessionId: studentSessionId,
            studentName
          });
        }
        if (classroomCode) {
          updateData.classCode = classroomCode;
        }
        if (studentLanguage && studentLanguage !== "unknown") {
          updateData.studentLanguage = studentLanguage;
        }
        logger_default.info("[DEBUG] About to update session:", {
          sessionId: studentSessionId,
          updateData,
          currentSessionState: {
            id: session.id,
            sessionId: session.sessionId,
            isActive: session.isActive,
            studentsCount: session.studentsCount,
            classCode: session.classCode
          }
        });
        await context.webSocketServer.storageSessionManager.updateSession(studentSessionId, updateData);
        const updatedSession = await context.storage.getActiveSession(studentSessionId);
        logger_default.info("[DEBUG] Session after update:", {
          sessionId: studentSessionId,
          updatedSessionData: updatedSession ? {
            id: updatedSession.id,
            sessionId: updatedSession.sessionId,
            isActive: updatedSession.isActive,
            studentsCount: updatedSession.studentsCount,
            classCode: updatedSession.classCode
          } : null
        });
        if (!alreadyCounted) {
          context.connectionManager.setStudentCounted(context.ws, true);
        }
        if (currentCount === 0) {
          try {
            const cleanupService = context.webSocketServer.getSessionCleanupService();
            if (cleanupService) {
              await cleanupService.markStudentsRejoined(studentSessionId);
            }
          } catch (error) {
            logger_default.error("Error marking students rejoined:", { error });
          }
        }
      } catch (error) {
        logger_default.error("Failed to update session for student registration:", { error });
      }
      const allConnections = context.connectionManager.getConnections();
      logger_default.info("[DEBUG] Looking for teachers to notify about student_joined:", {
        totalConnections: allConnections.length,
        studentSessionId,
        studentName
      });
      let teachersFound = 0;
      let teachersNotified = 0;
      allConnections.forEach((client, index) => {
        const clientRole = context.connectionManager.getRole(client);
        const clientSessionId = context.connectionManager.getSessionId(client);
        logger_default.info(`[DEBUG] Connection ${index}:`, {
          isSameAsStudentWs: client === context.ws,
          clientRole,
          clientSessionId,
          studentSessionId,
          isMatchingSession: clientSessionId === studentSessionId,
          isTeacher: clientRole === "teacher"
        });
        if (client !== context.ws && clientRole === "teacher") {
          teachersFound++;
          if (clientSessionId === studentSessionId) {
            const studentJoinedMessage = {
              type: "student_joined",
              payload: {
                // Generate a simple unique ID for the student for this message
                studentId: `student-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                name: studentName,
                languageCode: studentLanguage
              }
            };
            try {
              client.send(JSON.stringify(studentJoinedMessage));
              teachersNotified++;
              logger_default.info(`[DEBUG] Successfully sent 'student_joined' to teacher for student: ${studentName} in session ${studentSessionId}`);
            } catch (error) {
              logger_default.error("[DEBUG] Failed to send 'student_joined' message to teacher:", { error });
            }
          }
        }
      });
      logger_default.info("[DEBUG] Student notification summary:", {
        totalConnections: allConnections.length,
        teachersFound,
        teachersNotified,
        studentSessionId,
        studentName
      });
    } catch (error) {
      logger_default.error("Failed to handle student registration:", { error });
    }
  }
};

// server/services/websocket/PingMessageHandler.ts
init_logger();
var PingMessageHandler = class {
  getMessageType() {
    return "ping";
  }
  async handle(message, context) {
    context.ws.isAlive = true;
    const response = {
      type: "pong",
      timestamp: Date.now(),
      originalTimestamp: message.timestamp
    };
    try {
      context.ws.send(JSON.stringify(response));
    } catch (error) {
      logger_default.error("Error sending pong response:", { error });
    }
  }
};

// server/services/websocket/SettingsMessageHandler.ts
init_logger();
var SettingsMessageHandler = class {
  getMessageType() {
    return "settings";
  }
  async handle(message, context) {
    try {
      const role = context.connectionManager.getRole(context.ws);
      const settings = context.connectionManager.getClientSettings(context.ws) || {};
      if (message.ttsServiceType) {
        settings.ttsServiceType = message.ttsServiceType;
        logger_default.info(`Updated TTS service type for ${role} to: ${settings.ttsServiceType}`);
      }
      if (message.settings) {
        Object.assign(settings, message.settings);
      }
      context.connectionManager.setClientSettings(context.ws, settings);
      const response = {
        type: "settings",
        status: "success",
        settings
      };
      try {
        context.ws.send(JSON.stringify(response));
      } catch (sendError) {
        logger_default.error("Error sending settings response:", sendError);
      }
    } catch (error) {
      logger_default.error("Error handling settings message:", error);
    }
  }
};

// server/services/websocket/TranscriptionMessageHandler.ts
init_logger();
var TranscriptionMessageHandler = class {
  getMessageType() {
    return "transcription";
  }
  async handle(message, context) {
    logger_default.info("Received transcription from", {
      role: context.connectionManager.getRole(context.ws),
      text: message.text
    });
    const startTime = Date.now();
    const latencyTracking = {
      start: startTime,
      components: {
        preparation: 0,
        translation: 0,
        tts: 0,
        processing: 0
      }
    };
    const role = context.connectionManager.getRole(context.ws);
    const sessionId = context.connectionManager.getSessionId(context.ws);
    if (role !== "teacher") {
      logger_default.warn("Ignoring transcription from non-teacher role:", { role });
      return;
    }
    if (sessionId) {
      const teacherLanguage2 = context.connectionManager.getLanguage(context.ws) || "en-US";
      try {
        await context.storage.addTranscript({
          sessionId,
          language: teacherLanguage2,
          text: message.text
        });
        logger_default.info("Transcript stored successfully", { sessionId, language: teacherLanguage2 });
      } catch (error) {
        logger_default.error("Failed to store transcript:", { error, sessionId });
      }
    }
    const { connections: studentConnections, languages: studentLanguages } = context.connectionManager.getStudentConnectionsAndLanguagesForSession(sessionId);
    if (studentConnections.length === 0) {
      logger_default.info("No students connected, skipping translation");
      return;
    }
    const teacherLanguage = context.connectionManager.getLanguage(context.ws) || "en-US";
    const result = await context.translationService.translateToMultipleLanguages({
      text: message.text,
      sourceLanguage: teacherLanguage,
      targetLanguages: studentLanguages,
      startTime,
      latencyTracking
    });
    const translations2 = {};
    const translationResults = {};
    result.translations.forEach((translation, language) => {
      translations2[language] = translation;
    });
    result.translationResults.forEach(({ language, translation }) => {
      translationResults[language] = {
        originalText: message.text,
        translatedText: translation,
        audioBuffer: Buffer.from("")
        // Empty buffer for now
      };
    });
    const latencyInfo = result.latencyInfo;
    Object.assign(latencyTracking.components, latencyInfo);
    const processingEndTime = Date.now();
    latencyTracking.components.processing = processingEndTime - startTime - latencyTracking.components.translation;
    context.translationService.sendTranslationsToStudents({
      studentConnections,
      originalText: message.text,
      sourceLanguage: teacherLanguage,
      translations: result.translations,
      translationResults: result.translationResults,
      startTime,
      latencyTracking,
      getClientSettings: (ws) => context.connectionManager.getClientSettings(ws),
      getLanguage: (ws) => context.connectionManager.getLanguage(ws),
      getSessionId: (ws) => context.connectionManager.getSessionId(ws),
      storage: context.storage
    });
  }
};

// server/services/websocket/TTSRequestMessageHandler.ts
init_logger();
var TTSRequestMessageHandler = class {
  getMessageType() {
    return "tts_request";
  }
  async handle(message, context) {
    const text2 = message.text;
    const languageCode = message.languageCode;
    if (!context.translationService.validateTTSRequest(text2, languageCode)) {
      await this.sendTTSErrorResponse(context, "Invalid TTS request parameters");
      return;
    }
    const ttsServiceType = "openai";
    try {
      const audioBuffer = await context.translationService.generateTTSAudio(
        text2,
        languageCode,
        ttsServiceType,
        message.voice
      );
      if (audioBuffer && audioBuffer.length > 0) {
        await this.sendTTSResponse(
          context,
          text2,
          languageCode,
          audioBuffer,
          ttsServiceType
        );
      } else {
        await this.sendTTSErrorResponse(context, "Failed to generate audio");
      }
    } catch (error) {
      logger_default.error("Error handling TTS request:", { error });
      await this.sendTTSErrorResponse(context, "TTS generation error");
    }
  }
  /**
   * Send TTS response with audio data
   */
  async sendTTSResponse(context, text2, languageCode, audioBuffer, ttsServiceType) {
    try {
      const response = {
        type: "tts_response",
        status: "success",
        text: text2,
        languageCode,
        ttsServiceType,
        timestamp: Date.now()
      };
      const bufferString = audioBuffer.toString("utf8");
      if (bufferString.startsWith('{"type":"browser-speech"')) {
        response.useClientSpeech = true;
        try {
          response.speechParams = JSON.parse(bufferString);
        } catch (error) {
          logger_default.error("Error parsing speech params:", { error });
          response.speechParams = {
            type: "browser-speech",
            text: text2,
            languageCode,
            autoPlay: true
          };
        }
      } else {
        response.audioData = audioBuffer.toString("base64");
        response.useClientSpeech = false;
      }
      context.ws.send(JSON.stringify(response));
      logger_default.info(`TTS response sent successfully for language '${languageCode}'`);
    } catch (error) {
      logger_default.error("Error sending TTS response:", { error });
      try {
        await this.sendTTSErrorResponse(context, "Failed to send audio data");
      } catch (sendError) {
        logger_default.error("Error sending TTS error response:", { sendError });
      }
    }
  }
  /**
   * Send TTS error response
   */
  async sendTTSErrorResponse(context, messageText, code = "TTS_ERROR") {
    try {
      const ttsErrorResponse = {
        type: "tts_response",
        status: "error",
        error: {
          message: messageText,
          code
        },
        timestamp: Date.now()
      };
      context.ws.send(JSON.stringify(ttsErrorResponse));
      logger_default.error(`TTS error response sent: ${messageText}`);
    } catch (error) {
      logger_default.error("Error sending TTS error response:", { error });
    }
  }
};

// server/services/websocket/AudioMessageHandler.ts
init_logger();
init_config();
var AudioMessageHandler = class {
  getMessageType() {
    return "audio";
  }
  async handle(message, context) {
    try {
      const role = context.connectionManager.getRole(context.ws);
      if (role !== "teacher") {
        logger_default.info("Ignoring audio from non-teacher role:", { role });
        return;
      }
    } catch (error) {
      logger_default.error("Error processing teacher audio:", { error });
      return;
    }
    if (message.data) {
      await this.processTeacherAudio(context, message.data);
    }
  }
  /**
   * Process audio from teacher
   */
  async processTeacherAudio(context, audioData) {
    if (!audioData || audioData.length < config.session.minAudioDataLength) {
      return;
    }
    try {
      const audioBuffer = Buffer.from(audioData, "base64");
      if (audioBuffer.length < config.session.minAudioBufferLength) {
        return;
      }
      const teacherLanguage = context.connectionManager.getLanguage(context.ws) || "en-US";
      const sessionId = context.connectionManager.getSessionId(context.ws);
      if (!sessionId) {
        logger_default.error("No session ID found for teacher");
        return;
      }
      logger_default.debug("Received audio chunk from teacher, using client-side transcription");
    } catch (error) {
      logger_default.error("Error processing teacher audio:", { error });
    }
  }
};

// server/services/websocket/PongMessageHandler.ts
var PongMessageHandler = class {
  getMessageType() {
    return "pong";
  }
  async handle(message, context) {
    context.ws.isAlive = true;
  }
};

// server/services/WebSocketServer.ts
var WebSocketServer = class _WebSocketServer {
  constructor(server, storage) {
    this.isShutdown = false;
    // Lifecycle management
    this.lifecycleCleanupInterval = null;
    // Stats
    this.heartbeatInterval = null;
    // Backward compatibility properties for unit tests
    // These delegate to the ConnectionManager to maintain the same interface
    this._connectionsSet = null;
    _WebSocketServer.instances.add(this);
    this.wss = new WSServer({ server });
    this.storage = storage;
    this.connectionManager = new ConnectionManager();
    this.sessionService = new SessionService(storage);
    this.translationOrchestrator = new TranslationOrchestrator(storage);
    this.classroomSessionManager = new ClassroomSessionManager();
    this.storageSessionManager = new StorageSessionManager(storage);
    this.storageSessionManager.setClassroomSessionManager(this.classroomSessionManager);
    this.connectionHealthManager = new ConnectionHealthManager(this.wss);
    this.connectionValidationService = new ConnectionValidationService(this.classroomSessionManager);
    this.sessionMetricsService = new SessionMetricsService(this.connectionManager, this.classroomSessionManager);
    this.webSocketResponseService = new WebSocketResponseService();
    this.sessionLifecycleService = new SessionLifecycleService(storage);
    this.sessionCountCacheService = new SessionCountCacheService(storage);
    this.messageHandlerRegistry = new MessageHandlerRegistry();
    this.setupMessageHandlers();
    const context = {
      ws: null,
      // Will be set by the dispatcher for each message
      connectionManager: this.connectionManager,
      storage: this.storage,
      sessionService: this.sessionService,
      // Inject SessionService
      translationService: this.translationOrchestrator,
      // Inject TranslationOrchestrator
      sessionLifecycleService: this.sessionLifecycleService,
      // Inject SessionLifecycleService
      webSocketServer: this
    };
    this.messageDispatcher = new MessageDispatcher(this.messageHandlerRegistry, context);
    this.connectionLifecycleManager = new ConnectionLifecycleManager(
      this.connectionManager,
      this.classroomSessionManager,
      this.storageSessionManager,
      this.connectionHealthManager,
      this.messageDispatcher,
      this
    );
    this.setupEventHandlers();
    this.startSessionLifecycleManagement();
    this.initializeSessionCleanupService().catch((error) => {
      logger_default.error("Failed to initialize SessionCleanupService during construction:", { error });
    });
    this.sessionCountCacheService.start();
  }
  static {
    // Add static registry to track all instances for cleanup
    this.instances = /* @__PURE__ */ new Set();
  }
  /**
   * Get the number of active WebSocket connections.
   * Implements IActiveSessionProvider.
   * @returns The number of active connections.
   */
  getActiveSessionCount() {
    return this.connectionManager.getConnectionCount();
  }
  /**
   * Get the number of active sessions (actual classroom sessions from database).
   * Implements IActiveSessionProvider.
   * @returns The number of active sessions.
   */
  getActiveSessionsCount() {
    return this.sessionCountCacheService.getActiveSessionCount();
  }
  /**
   * Get the number of active student connections.
   * Implements IActiveSessionProvider.
   * @returns The number of active student connections.
   */
  getActiveStudentCount() {
    return this.connectionManager.getStudentCount();
  }
  /**
   * Get the number of active teacher connections.
   * Implements IActiveSessionProvider.
   * @returns The number of active teacher connections.
   */
  getActiveTeacherCount() {
    return this.connectionManager.getTeacherCount();
  }
  /**
   * Set up WebSocket server event handlers
   */
  setupEventHandlers() {
    this.wss.on("connection", (ws, request) => {
      this.handleConnection(ws, request);
    });
  }
  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, request) {
    logger_default.info("New WebSocket connection established");
    this.connectionLifecycleManager.handleConnection(ws, request).catch((error) => {
      logger_default.error("Error in connection lifecycle handling:", { error });
    });
    ws.on("message", (data) => {
      this.handleMessage(ws, data.toString());
    });
    ws.on("close", () => {
      this.connectionLifecycleManager.handleConnectionClose(ws);
    });
    ws.on("error", (error) => {
      logger_default.error("WebSocket error:", { error });
    });
  }
  /**
   * Handle incoming WebSocket message
   */
  async handleMessage(ws, data) {
    let messageType = "unknown";
    try {
      const messageData = JSON.parse(data);
      messageType = messageData.type;
      if (messageType !== "ping" && messageType !== "pong") {
        logger_default.debug("Handling message", { type: messageType, sessionId: this.connectionManager.getSessionId(ws) });
      }
    } catch (error) {
    }
    try {
      await this.messageDispatcher.dispatch(ws, data);
    } catch (error) {
      logger_default.error("Message dispatch error:", { error, data });
      return;
    }
    const activityUpdateMessages = ["transcription", "audio", "settings"];
    if (activityUpdateMessages.includes(messageType)) {
      await this.updateSessionActivity(ws);
    }
  }
  /**
   * Get all student connections and their unique languages
   */
  /**
   * Get connections
   */
  getConnections() {
    return this.connectionManager.getConnections();
  }
  /**
   * Get connection language
   */
  getLanguage(client) {
    return this.connectionManager.getLanguage(client);
  }
  /**
   * Close WebSocket server
   */
  close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.lifecycleCleanupInterval) {
      clearInterval(this.lifecycleCleanupInterval);
      this.lifecycleCleanupInterval = null;
    }
    this.wss.close();
  }
  /**
   * Generate a unique session ID
   */
  /**
   * Get active session metrics for diagnostics
   */
  getActiveSessionMetrics() {
    return this.sessionMetricsService.calculateActiveSessionMetrics();
  }
  // Method to gracefully shut down the WebSocket server
  shutdown() {
    if (this.isShutdown) {
      logger_default.warn("[WebSocketServer] Shutdown already in progress or completed.");
      return;
    }
    this.isShutdown = true;
    logger_default.info("[WebSocketServer] Shutting down...");
    _WebSocketServer.instances.delete(this);
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger_default.info("[WebSocketServer] Heartbeat interval cleared.");
    }
    if (this.lifecycleCleanupInterval) {
      clearInterval(this.lifecycleCleanupInterval);
      this.lifecycleCleanupInterval = null;
      logger_default.info("[WebSocketServer] Session lifecycle interval cleared.");
    }
    if (this.sessionCountCacheService) {
      this.sessionCountCacheService.stop();
      logger_default.info("[WebSocketServer] Session count cache service stopped.");
    }
    this.sessionService.shutdown();
    logger_default.info("[WebSocketServer] SessionService shutdown completed.");
    if (this.sessionCleanupService) {
      try {
        this.sessionCleanupService.stop();
        logger_default.info("[WebSocketServer] SessionCleanupService stopped.");
      } catch (error) {
        logger_default.error("[WebSocketServer] Error stopping SessionCleanupService:", { error });
      }
    }
    const connections = this.connectionManager.getConnections();
    logger_default.info(`[WebSocketServer] Closing ${connections.size} client connections...`);
    connections.forEach((client) => {
      client.terminate();
    });
    logger_default.info("[WebSocketServer] All client connections terminated.");
    this.connectionManager.clearAll();
    this.classroomSessionManager.clearAll();
    logger_default.info("[WebSocketServer] Internal maps and sets cleared.");
    if (this.wss) {
      this.wss.close((err) => {
        if (err) {
          logger_default.error("[WebSocketServer] Error closing WebSocket server:", { err });
        } else {
          logger_default.info("[WebSocketServer] WebSocket server closed.");
        }
      });
    }
    logger_default.info("[WebSocketServer] Shutdown complete.");
  }
  /**
   * Static method to shutdown all WebSocketServer instances
   * Useful for test cleanup and process exit handlers
   */
  static shutdownAll() {
    logger_default.info(`[WebSocketServer] Shutting down ${_WebSocketServer.instances.size} remaining instances...`);
    const instances = Array.from(_WebSocketServer.instances);
    for (const instance of instances) {
      try {
        instance.shutdown();
      } catch (error) {
        logger_default.error("[WebSocketServer] Error during instance shutdown:", { error });
      }
    }
    logger_default.info("[WebSocketServer] All instances shutdown complete.");
  }
  get connections() {
    if (!this._connectionsSet) {
      const manager = this.connectionManager;
      const realSet = manager.getConnections();
      this._connectionsSet = new Proxy(realSet, {
        get(target, prop) {
          if (prop === "add") {
            return (ws) => {
              const sessionId = ws.sessionId || "temp-session-" + Date.now();
              manager.addConnection(ws, sessionId);
              return target;
            };
          }
          if (prop === "delete") {
            return (ws) => {
              manager.removeConnection(ws);
              return true;
            };
          }
          return target[prop];
        }
      });
    }
    return this._connectionsSet;
  }
  set connections(value) {
    const existingSessionIds = /* @__PURE__ */ new Map();
    for (const connection of value) {
      const existingSessionId = this.connectionManager.getSessionId(connection);
      if (existingSessionId) {
        existingSessionIds.set(connection, existingSessionId);
      }
    }
    this.connectionManager.clearAll();
    for (const connection of value) {
      const sessionId = existingSessionIds.get(connection) || connection.sessionId || `temp-${Date.now()}-${Math.random()}`;
      this.connectionManager.addConnection(connection, sessionId);
    }
    this._connectionsSet = null;
  }
  get roles() {
    const manager = this.connectionManager;
    const rolesMap = /* @__PURE__ */ new Map();
    for (const connection of manager.getConnections()) {
      const role = manager.getRole(connection);
      if (role) {
        rolesMap.set(connection, role);
      }
    }
    return new Proxy(rolesMap, {
      get(target, prop) {
        if (prop === "set") {
          return (ws, role) => {
            manager.setRole(ws, role);
            return target.set(ws, role);
          };
        }
        if (prop === "get") {
          return (ws) => manager.getRole(ws);
        }
        return target[prop];
      }
    });
  }
  set roles(value) {
    for (const [connection, role] of value) {
      this.connectionManager.setRole(connection, role);
    }
  }
  get languages() {
    const languagesMap = /* @__PURE__ */ new Map();
    for (const connection of this.connectionManager.getConnections()) {
      const language = this.connectionManager.getLanguage(connection);
      if (language) {
        languagesMap.set(connection, language);
      }
    }
    return languagesMap;
  }
  set languages(value) {
    for (const [connection, language] of value) {
      this.connectionManager.setLanguage(connection, language);
    }
  }
  get sessionIds() {
    const manager = this.connectionManager;
    const sessionIdsMap = /* @__PURE__ */ new Map();
    for (const connection of manager.getConnections()) {
      const sessionId = manager.getSessionId(connection);
      if (sessionId) {
        sessionIdsMap.set(connection, sessionId);
      }
    }
    return new Proxy(sessionIdsMap, {
      get(target, prop) {
        if (prop === "set") {
          return (ws, sessionId) => {
            manager.updateSessionId(ws, sessionId);
            return target.set(ws, sessionId);
          };
        }
        if (prop === "delete") {
          return (ws) => {
            manager.removeSessionId(ws);
            return target.delete(ws);
          };
        }
        if (prop === "get") {
          return (ws) => manager.getSessionId(ws);
        }
        return target[prop];
      }
    });
  }
  set sessionIds(value) {
    for (const [connection, sessionId] of value) {
      this.connectionManager.updateSessionId(connection, sessionId);
    }
  }
  get clientSettings() {
    const settingsMap = /* @__PURE__ */ new Map();
    for (const connection of this.connectionManager.getConnections()) {
      const settings = this.connectionManager.getClientSettings(connection);
      if (settings) {
        settingsMap.set(connection, settings);
      }
    }
    return settingsMap;
  }
  set clientSettings(value) {
    for (const [connection, settings] of value) {
      this.connectionManager.setClientSettings(connection, settings);
    }
  }
  // Expose the ConnectionManager for direct testing access
  get _connectionManager() {
    return this.connectionManager;
  }
  // Expose the ClassroomSessionManager for direct testing access
  get _classroomSessionManager() {
    return this.classroomSessionManager;
  }
  // Helper method for tests to add connections directly
  _addTestConnection(ws, sessionId, role, language, settings) {
    this.connectionManager.addConnection(ws, sessionId);
    if (role) this.connectionManager.setRole(ws, role);
    if (language) this.connectionManager.setLanguage(ws, language);
    if (settings) this.connectionManager.setClientSettings(ws, settings);
  }
  /**
   * Set up message handlers for different message types
   */
  setupMessageHandlers() {
    this.messageHandlerRegistry.register(new RegisterMessageHandler());
    this.messageHandlerRegistry.register(new PingMessageHandler());
    this.messageHandlerRegistry.register(new SettingsMessageHandler());
    this.messageHandlerRegistry.register(new TranscriptionMessageHandler());
    this.messageHandlerRegistry.register(new TTSRequestMessageHandler());
    this.messageHandlerRegistry.register(new AudioMessageHandler());
    this.messageHandlerRegistry.register(new PongMessageHandler());
  }
  /**
   * Start session lifecycle management tasks
   */
  startSessionLifecycleManagement() {
    this.lifecycleCleanupInterval = setInterval(async () => {
      try {
        if (this.isShutdown) {
          return;
        }
        const inactiveResult = await this.sessionLifecycleService.processInactiveSessions();
        if (inactiveResult.endedCount > 0 || inactiveResult.classifiedCount > 0) {
          logger_default.info("Session lifecycle: processed inactive sessions", inactiveResult);
        }
        const cleanupResult = await this.sessionLifecycleService.cleanupDeadSessions();
        if (cleanupResult.classified > 0) {
          logger_default.info("Session lifecycle: classified sessions", cleanupResult);
        }
      } catch (error) {
        logger_default.error("Session lifecycle management error:", { error });
      }
    }, 2 * 60 * 1e3);
    logger_default.info("Session lifecycle management started");
  }
  /**
   * Initialize and start the SessionCleanupService
   */
  async initializeSessionCleanupService() {
    try {
      const { SessionCleanupService: SessionCleanupService2 } = await Promise.resolve().then(() => (init_SessionCleanupService(), SessionCleanupService_exports));
      this.sessionCleanupService = new SessionCleanupService2();
      this.sessionCleanupService.start();
      logger_default.info("SessionCleanupService started");
    } catch (error) {
      logger_default.error("Failed to initialize SessionCleanupService:", { error });
    }
  }
  /**
   * Get the SessionCleanupService instance
   */
  getSessionCleanupService() {
    return this.sessionCleanupService;
  }
  /**
   * Update storage instance - used for test isolation
   */
  updateStorage(newStorage) {
    this.storage = newStorage;
    this.sessionService = new SessionService(newStorage);
    this.translationOrchestrator = new TranslationOrchestrator(newStorage);
    this.storageSessionManager = new StorageSessionManager(newStorage);
    this.storageSessionManager.setClassroomSessionManager(this.classroomSessionManager);
    this.sessionLifecycleService = new SessionLifecycleService(newStorage);
    this.sessionCountCacheService.updateStorage(newStorage);
    const context = {
      ws: null,
      connectionManager: this.connectionManager,
      storage: newStorage,
      sessionService: this.sessionService,
      translationService: this.translationOrchestrator,
      sessionLifecycleService: this.sessionLifecycleService,
      webSocketServer: this
    };
    this.messageDispatcher = new MessageDispatcher(this.messageHandlerRegistry, context);
  }
  /**
   * Update session activity for the current connection's session
   */
  async updateSessionActivity(ws) {
    const sessionId = this.connectionManager.getSessionId(ws);
    if (sessionId) {
      const now = Date.now();
      const lastUpdate = ws.lastActivityUpdate || 0;
      if (now - lastUpdate > 3e4) {
        ws.lastActivityUpdate = now;
        await this.sessionLifecycleService.updateSessionActivity(sessionId);
      }
    }
  }
  // Helper getter for tests to access connectionHealthManager
  get _connectionHealthManager() {
    return this.connectionHealthManager;
  }
};

// server/server.ts
init_SessionCleanupService();
import fs4 from "fs";

// server/vite.ts
init_logger();
init_analytics_security();
import express from "express";
import { createServer as createViteServer } from "vite";
import path4 from "path";
import fsPromises from "fs/promises";
import fsSync from "fs";
var vite = null;
async function setupVite(app) {
  const viteConfigPath = path4.resolve(process.cwd(), "config", "vite.config.ts");
  logger_default.info(`[VITE DEV] Attempting to load Vite config from: ${viteConfigPath}`);
  try {
    const configModule = await import(
      viteConfigPath
      /* @vite-ignore */
    );
    let resolvedViteConfig;
    if (typeof configModule.default === "function") {
      resolvedViteConfig = await configModule.default({ command: "serve", mode: "development" });
    } else {
      resolvedViteConfig = configModule.default;
    }
    if (!resolvedViteConfig) {
      throw new Error("Vite config loaded as undefined or null.");
    }
    logger_default.info(`[VITE DEV] Successfully loaded Vite config. Root: ${resolvedViteConfig.root || path4.resolve(process.cwd(), "client")}, Base: ${resolvedViteConfig.base || "/"}`);
    vite = await createViteServer({
      configFile: viteConfigPath,
      server: {
        middlewareMode: true
      },
      appType: "custom"
    });
    logger_default.info("[VITE DEV] Vite server created successfully.");
    if (vite) {
      app.use(vite.middlewares);
      logger_default.info("[VITE DEV] Vite asset/HMR middleware configured.");
      const inputs = resolvedViteConfig.build?.rollupOptions?.input;
      if (typeof inputs === "object" && inputs !== null) {
        for (const [name, filePath] of Object.entries(inputs)) {
          if (typeof filePath !== "string") continue;
          let urlPath;
          if (name === "main") {
            urlPath = "/";
          } else if (filePath.endsWith(".html") && name === path4.basename(filePath, ".html")) {
            urlPath = name === "diagnostics" ? "/diagnostics.html" : `/${name}`;
          } else {
            logger_default.warn(`[VITE DEV] Skipping HTML route for entry '${name}' due to unclear path mapping from ${filePath}`);
            continue;
          }
          if (name === "analytics") {
            const { analyticsPageAuth: analyticsPageAuth2 } = await Promise.resolve().then(() => (init_analytics_security(), analytics_security_exports));
            app.get("/analytics", analyticsPageAuth2, async (req, res, next) => {
              try {
                const html = await fsPromises.readFile(filePath, "utf-8");
                const transformedHtml = await vite.transformIndexHtml(req.originalUrl, html);
                logger_default.info(`[VITE DEV] Serving transformed /analytics from ${filePath} (analytics.html)`);
                res.status(200).set({ "Content-Type": "text/html" }).end(transformedHtml);
              } catch (e) {
                logger_default.error(`[VITE DEV] Error transforming HTML for /analytics: ${e.message}`);
                return next(e);
              }
            });
          }
          if (name === "main" && urlPath === "/") {
            app.get("/index.html", async (req, res, next) => {
              try {
                const html = await fsPromises.readFile(filePath, "utf-8");
                const transformedHtml = await vite.transformIndexHtml(req.originalUrl, html);
                logger_default.info(`[VITE DEV] Serving transformed /index.html (explicitly) from ${filePath}`);
                res.status(200).set({ "Content-Type": "text/html" }).end(transformedHtml);
              } catch (e) {
                logger_default.error(`[VITE DEV] Error transforming HTML for ${req.originalUrl} (explicit /index.html): ${e.message}`);
                return next(e);
              }
            });
          }
          app.get(urlPath, async (req, res, next) => {
            try {
              const html = await fsPromises.readFile(filePath, "utf-8");
              const transformedHtml = await vite.transformIndexHtml(req.originalUrl, html);
              logger_default.info(`[VITE DEV] Serving transformed ${urlPath} from ${filePath} for originalUrl ${req.originalUrl}`);
              res.status(200).set({ "Content-Type": "text/html" }).end(transformedHtml);
            } catch (e) {
              logger_default.error(`[VITE DEV] Error transforming HTML for ${req.originalUrl} (path ${urlPath}): ${e.message}`);
              return next(e);
            }
          });
          logger_default.info(`[VITE DEV] Configured HTML route: ${urlPath} -> ${filePath}`);
        }
      } else {
        logger_default.warn("[VITE DEV] No HTML entry points found in Vite config (build.rollupOptions.input) to set up routes.");
      }
      logger_default.info("[VITE DEV] Vite HTML transformation routes configured.");
    } else {
      logger_default.error("[VITE DEV SETUP] Vite server instance was not created. Middleware not applied.");
      throw new Error("Vite server instance is null after creation attempt.");
    }
  } catch (error) {
    logger_default.error(`[VITE DEV SETUP] Failed to create Vite server or apply middleware: ${error.message}`);
    logger_default.error(`[VITE DEV SETUP] Error stack: ${error.stack}`);
    app.use((req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.status(500).send("Vite server setup failed. Please check server logs for more details.");
    });
  }
}
function serveStatic(app) {
  const clientDistPath = path4.resolve(process.cwd(), "dist", "client");
  logger_default.info(`[PROD STATIC] Configuring static file serving from: ${clientDistPath}`);
  if (!fsSync.existsSync(clientDistPath)) {
    logger_default.error(`[PROD STATIC] Distribution directory not found: ${clientDistPath}. Static serving will not work.`);
    app.get("*", (req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api/")) {
        logger_default.warn(`[PROD STATIC] Attempted to serve ${req.path} but dist folder is missing.`);
        res.status(503).send("Static assets are not available. The application may not have been built correctly.");
      } else {
        next();
      }
    });
    return;
  }
  app.use(express.static(clientDistPath, { index: false }));
  const htmlEntries = {
    "/": "index.html",
    "/teacher": "teacher.html",
    "/teacher-login.html": "teacher-login.html",
    "/student": "student.html",
    "/analytics": "analytics.html"
    // Analytics route serves analytics.html
  };
  Object.entries(htmlEntries).forEach(([routePath, fileName]) => {
    const filePath = path4.join(clientDistPath, fileName);
    if (fsSync.existsSync(filePath)) {
      if (routePath === "/analytics") {
        app.get(routePath, analyticsPageAuth, (req, res) => {
          logger_default.info(`[PROD STATIC] Serving ${filePath} for ${req.path} (with auth)`);
          res.sendFile(filePath);
        });
      } else {
        app.get(routePath, (req, res) => {
          logger_default.info(`[PROD STATIC] Serving ${filePath} for ${req.path}`);
          res.sendFile(filePath);
        });
      }
      if (fileName === "index.html" && routePath === "/") {
        app.get("/index.html", (req, res) => {
          logger_default.info(`[PROD STATIC] Serving ${filePath} for /index.html (explicit)`);
          res.sendFile(filePath);
        });
      }
    } else {
      logger_default.warn(`[PROD STATIC] HTML file not found for route ${routePath}: ${filePath}. This route will result in a 404 if not handled otherwise.`);
    }
  });
  logger_default.info("[PROD STATIC] Static serving configured for assets and specific HTML files.");
}

// server/server.ts
var configureCorsMiddleware = (app) => {
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
    } else {
      next();
    }
  });
};
async function startServer(app) {
  app.use((req, res, next) => {
    logger_default.info({
      message: "GENERAL LOGGER: Request received",
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      headers: req.headers,
      query: req.query,
      ip: req.ip
    });
    next();
  });
  if (!process.env.OPENAI_API_KEY) {
    logger_default.warn("OpenAI API key not found. TTS and other AI features may not work.");
  } else {
    logger_default.info("OpenAI API key found and client configured.");
  }
  configureCorsMiddleware(app);
  app.use(express2.json());
  let vitePort = process.env.VITE_PORT || "3006";
  const vitePortFilePath = path5.resolve(process.cwd(), ".vite_dev_server_port");
  logger_default.info(`[INIT] Attempting to read Vite port from: ${vitePortFilePath}`);
  try {
    if (fs4.existsSync(vitePortFilePath)) {
      vitePort = fs4.readFileSync(vitePortFilePath, "utf-8").trim();
      logger_default.info(`[INIT] Using Vite dev server port from .vite_dev_server_port: ${vitePort}`);
    } else {
      logger_default.warn(`[INIT] .vite_dev_server_port file not found at ${vitePortFilePath}. Using default/env VITE_PORT: ${vitePort}.`);
    }
  } catch (error) {
    logger_default.error(`[INIT] Error reading Vite port file: ${error.message}. Using default/env VITE_PORT: ${vitePort}.`);
  }
  const viteDevServerUrl = `http://localhost:${vitePort}`;
  logger_default.info(`[INIT] Vite dev server URL configured to: ${viteDevServerUrl}`);
  let storage;
  storage = new DatabaseStorage();
  logger_default.info("[INIT] Using database storage.");
  const httpServer = createServer(app);
  const wss = new WebSocketServer(httpServer, storage);
  const cleanupService = new SessionCleanupService();
  cleanupService.start();
  logger_default.info("[INIT] Session cleanup service started.");
  process.on("SIGTERM", () => {
    logger_default.info("SIGTERM received, shutting down gracefully...");
    cleanupService.stop();
  });
  process.on("SIGINT", () => {
    logger_default.info("SIGINT received, shutting down gracefully...");
    cleanupService.stop();
  });
  const apiRoutes = createApiRoutes(storage, wss, cleanupService);
  app.use("/api", apiRoutes);
  app.use("/api", apiErrorHandler);
  if (process.env.NODE_ENV === "development") {
    logger_default.info("[INIT] Development mode: Setting up Vite middleware.");
    await setupVite(app);
  } else if (process.env.NODE_ENV === "production") {
    logger_default.info("[INIT] Production mode: Setting up static file serving.");
    serveStatic(app);
  } else {
    logger_default.info("[INIT] Test mode: Setting up static file serving for E2E tests.");
    serveStatic(app);
  }
  app.use((err, req, res, next) => {
    logger_default.error("Global error handler caught an error:", {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      status: err.status || (res.statusCode >= 400 ? res.statusCode : 500)
      // Use err.status or derive from res.statusCode
    });
    if (res.headersSent) {
      return next(err);
    }
    const statusCode = err.status || (res.statusCode >= 400 ? res.statusCode : 500) || 500;
    res.status(statusCode).json({
      error: {
        message: err.message || "Internal Server Error",
        ...process.env.NODE_ENV !== "production" && { stack: err.stack }
        // Include stack in non-production
      }
    });
  });
  const port = Number(process.env.PORT);
  const host = process.env.HOST;
  if (!port || isNaN(port) || port <= 0) {
    logger_default.error(`[CRITICAL] Invalid PORT: ${process.env.PORT}. Server cannot start.`);
    process.exit(1);
  }
  if (!host) {
    logger_default.error("[CRITICAL] HOST not set. Server cannot start.");
    process.exit(1);
  }
  return new Promise((resolve, reject) => {
    httpServer.listen(port, host, () => {
      logger_default.info(`Server listening on http://${host}:${port}`);
      resolve(httpServer);
    });
    httpServer.on("error", (error) => {
      logger_default.error("Failed to start server:", error);
      reject(error);
    });
  });
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const appInstance = express2();
  logger_default.info("[DIRECT_RUN] server.ts is being run directly. Initializing and starting server...");
  startServer(appInstance).catch((error) => {
    logger_default.error("[DIRECT_RUN] Failed to start server from direct run:", error);
    process.exit(1);
  });
}

// server/index.ts
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path6.dirname(__filename2);
var rootDir = path6.resolve(__dirname2, "..");
console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] SERVER_INDEX_TS: Script starting`);
try {
  console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] SERVER_INDEX_TS: Calling validateConfig()`);
  validateConfig();
  console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] SERVER_INDEX_TS: validateConfig() completed successfully`);
  debugTimingScaling();
  console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] SERVER_INDEX_TS: Creating Express app instance`);
  const app = express3();
  const port = process.env.PORT || "5000";
  console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] SERVER_INDEX_TS: Determined port: ${port}`);
  console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] SERVER_INDEX_TS: Calling startServer(app)`);
  startServer(app);
  console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] SERVER_INDEX_TS: startServer(app) has been called. Server should be initializing and listening.`);
} catch (error) {
  console.error(`[${(/* @__PURE__ */ new Date()).toISOString()}] SERVER_INDEX_TS: CRITICAL ERROR during initialization:`, error);
  if (error instanceof Error) {
    console.error(`[${(/* @__PURE__ */ new Date()).toISOString()}] SERVER_INDEX_TS: Error stack: ${error.stack}`);
  }
  process.exit(1);
}
export {
  startServer
};
