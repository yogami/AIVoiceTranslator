// This file will be referenced in Vitest config to set up global mocks
import { config } from "dotenv";

// Load test environment variables
config({ path: ".env.test" });

// Set test environment
process.env.NODE_ENV = "test";

// Set test-specific OpenAI key if not already set
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = "test-key-for-unit-tests";
}

// Determine test mode from environment
const testMode = process.env.TEST_MODE || "all";
console.log(`[Vitest Setup] Test mode: ${testMode}`);

// Provide safe defaults to satisfy config import in tests
process.env.PORT = process.env.PORT || '3001';
process.env.HOST = process.env.HOST || '127.0.0.1';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'debug';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test:test@localhost:5432/testdb';
// Prevent accidental network features during tests
process.env.FEATURE_TWO_WAY_COMMUNICATION = process.env.FEATURE_TWO_WAY_COMMUNICATION || '0';

// Force free tiers for integration/component tests; avoid premium APIs during tests
if (testMode !== 'unit') {
  process.env.STT_SERVICE_TYPE = process.env.STT_SERVICE_TYPE || 'free-enhanced';
  // In component mode, avoid network: use offline/local translation
  if (testMode === 'component') {
    process.env.TRANSLATION_SERVICE_TYPE = 'offline';
    process.env.DISABLE_TEXT2WAV = '1';
  } else {
    process.env.TRANSLATION_SERVICE_TYPE = process.env.TRANSLATION_SERVICE_TYPE || 'free-basic';
  }
  process.env.TTS_SERVICE_TYPE = process.env.TTS_SERVICE_TYPE || 'free-hq';
  // Disable premium keys to avoid importing cloud SDK paths
  delete process.env.OPENAI_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;
  process.env.FEATURE_SERVER_INTERIM_TRANSCRIPTION = process.env.FEATURE_SERVER_INTERIM_TRANSCRIPTION || '0';
  process.env.ENABLE_MAC_SAY_FALLBACK = '0';
  // Enable manual translation control in tests so manual-mode suites pass
  process.env.FEATURE_MANUAL_TRANSLATION_CONTROL = process.env.FEATURE_MANUAL_TRANSLATION_CONTROL || '1';
  console.log('[Vitest Setup] Forcing free-tier services for tests');
}

// Ensure ElevenLabs key is available for unit tests that exercise premium paths
if (testMode === 'unit' && !process.env.ELEVENLABS_API_KEY) {
  process.env.ELEVENLABS_API_KEY = 'test-elevenlabs-key-for-unit-tests';
}

// Initialize test isolation based on mode
if (testMode !== "unit") {
  // Enable test isolation for component and integration tests
  process.env.TEST_ISOLATION_ENABLED = "true";
  console.log("[Vitest Setup] Test isolation enabled for non-unit tests");
}

// Global cleanup handler to ensure all WebSocketServer instances are properly shut down
// This prevents background intervals from causing "Cannot use a pool after calling end on the pool" errors
process.on("exit", () => {
  try {
    // Import WebSocketServer dynamically to avoid circular dependencies
    let WebSocketServerModule: any = null;
    try {
      WebSocketServerModule = require("../../server/services/WebSocketServer");
    } catch (_) {
      try {
        WebSocketServerModule = require("../../server/interface-adapters/websocket/WebSocketServer");
      } catch (e) {
        console.warn("[Test Cleanup] WebSocketServer module not found for cleanup");
      }
    }
    const WebSocketServer = WebSocketServerModule?.WebSocketServer;
    if (WebSocketServer && typeof WebSocketServer.shutdownAll === "function") {
      WebSocketServer.shutdownAll();
    }
  } catch (error: any) {
    // Ignore errors during cleanup - this is best effort
    console.warn("[Test Cleanup] Error during WebSocketServer cleanup:", error?.message || String(error));
  }
});

// Enhanced error handling for different test modes
process.on("uncaughtException", (error) => {
  console.error(`[Test ${testMode}] Uncaught Exception:`, error);
  // Try to cleanup before exiting
  try {
    const { WebSocketServer } = require("../../server/services/WebSocketServer");
    if (WebSocketServer && typeof WebSocketServer.shutdownAll === "function") {
      WebSocketServer.shutdownAll();
    }
  } catch (cleanupError) {
    // Ignore cleanup errors
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error(`[Test ${testMode}] Unhandled Rejection at:`, promise, "reason:", reason);
  // Prevent aborting the entire test run (e.g., text2wav wasm abort)
});

// Add test isolation markers
if (process.env.TEST_ISOLATION_ENABLED === "true") {
  const startTime = Date.now();
  console.log(`[Vitest Setup] Test isolation active - Started at ${new Date(startTime).toISOString()}`);
  
  // Track test suite start
  process.env.TEST_SUITE_START_TIME = startTime.toString();
}

// Don't set global config in setup file, it will be handled by config files