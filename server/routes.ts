/**
 * API Routes Module
 * 
 * Express routes for the REST API following software craftsmanship principles:
 * - Single Responsibility: Each handler has one clear purpose
 * - DRY: Shared logic is extracted into reusable functions
 * - Explicit Error Handling: Consistent error responses
 * - Input Validation: All inputs are validated before processing
 * - Clean Code: Self-documenting function names and clear structure
 */
import { Router, Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { DiagnosticsService } from './services/DiagnosticsService.js';

// Constants
const API_VERSION = '1.0.0';
const CLASSROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;

// Initialize services
const diagnosticsService = new DiagnosticsService();

// Export for use in other parts of the application
export { diagnosticsService };

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Validate required fields in request body
 */
function validateRequiredFields(body: any, fields: string[]): void {
  const missingFields = fields.filter(field => !body[field]);
  if (missingFields.length > 0) {
    throw new ApiError(400, `Missing required fields: ${missingFields.join(', ')}`);
  }
}

/**
 * Parse and validate limit parameter
 */
function parseLimit(limitParam: any, defaultLimit: number = 10): number {
  if (!limitParam) return defaultLimit;
  
  const limit = parseInt(limitParam as string);
  if (isNaN(limit) || limit < 1) {
    throw new ApiError(400, 'Invalid limit parameter: must be a positive integer');
  }
  
  return Math.min(limit, 100); // Cap at 100 for performance
}

// Create router instance
export const apiRoutes = Router();

// ============================================================================
// Language Routes
// ============================================================================

/**
 * Get all available languages
 */
const getLanguages = asyncHandler(async (req: Request, res: Response) => {
  const languages = await storage.getLanguages();
  res.json(languages);
});

/**
 * Get only active languages
 */
const getActiveLanguages = asyncHandler(async (req: Request, res: Response) => {
  const activeLanguages = await storage.getActiveLanguages();
  res.json(activeLanguages);
});

/**
 * Update language status
 */
const updateLanguageStatus = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;
  const { isActive } = req.body;
  
  if (typeof isActive !== 'boolean') {
    throw new ApiError(400, 'isActive must be a boolean value');
  }
  
  const updatedLanguage = await storage.updateLanguageStatus(code, isActive);
  
  if (!updatedLanguage) {
    throw new ApiError(404, `Language with code '${code}' not found`);
  }
  
  res.json(updatedLanguage);
});

// ============================================================================
// Translation Routes
// ============================================================================

/**
 * Save a new translation
 */
const saveTranslation = asyncHandler(async (req: Request, res: Response) => {
  validateRequiredFields(req.body, ['sourceLanguage', 'targetLanguage', 'originalText', 'translatedText']);
  
  const { sourceLanguage, targetLanguage, originalText, translatedText, latency } = req.body;
  
  // Additional validation
  if (originalText.trim().length === 0) {
    throw new ApiError(400, 'originalText cannot be empty');
  }
  
  if (translatedText.trim().length === 0) {
    throw new ApiError(400, 'translatedText cannot be empty');
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

/**
 * Get translations by target language
 */
const getTranslationsByLanguage = asyncHandler(async (req: Request, res: Response) => {
  const { language } = req.params;
  const limit = parseLimit(req.query.limit);
  
  const translations = await storage.getTranslationsByLanguage(language, limit);
  
  res.json(translations);
});

// ============================================================================
// Transcript Routes
// ============================================================================

/**
 * Save a new transcript
 */
const saveTranscript = asyncHandler(async (req: Request, res: Response) => {
  validateRequiredFields(req.body, ['sessionId', 'language', 'text']);
  
  const { sessionId, language, text } = req.body;
  
  if (text.trim().length === 0) {
    throw new ApiError(400, 'text cannot be empty');
  }
  
  const transcript = await storage.addTranscript({
    sessionId,
    language,
    text: text.trim()
  });
  
  res.status(201).json(transcript);
});

/**
 * Get transcripts by session and language
 */
const getTranscriptsBySession = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId, language } = req.params;
  
  const transcripts = await storage.getTranscriptsBySession(sessionId, language);
  
  res.json(transcripts);
});

// ============================================================================
// User Routes
// ============================================================================

/**
 * Get user information
 */
const getUser = asyncHandler(async (req: Request, res: Response) => {
  // In a real application, extract user ID from auth token
  const userId = 1; // Placeholder for testing
  
  const user = await storage.getUser(userId);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  res.json(user);
});

// ============================================================================
// Health & Diagnostics Routes
// ============================================================================

/**
 * Health check endpoint
 */
const healthCheck = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: API_VERSION,
    database: 'connected',
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * Get application diagnostics
 */
const getDiagnostics = asyncHandler(async (req: Request, res: Response) => {
  const diagnostics = await diagnosticsService.getMetrics();
  res.json(diagnostics);
});

/**
 * Export diagnostics data
 */
const exportDiagnostics = asyncHandler(async (req: Request, res: Response) => {
  const exportData = await diagnosticsService.getExportData();
  
  // Set headers for file download
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="diagnostics-${Date.now()}.json"`);
  
  res.json(exportData);
});

// ============================================================================
// Classroom Routes
// ============================================================================

/**
 * Join classroom by code
 */
const joinClassroom = asyncHandler(async (req: Request, res: Response) => {
  const { classCode } = req.params;
  
  if (!CLASSROOM_CODE_PATTERN.test(classCode)) {
    throw new ApiError(400, 'Invalid classroom code format');
  }
  
  // Redirect to student interface with classroom parameter
  res.redirect(`/student?code=${classCode}`);
});

// ============================================================================
// Test Routes
// ============================================================================

/**
 * Simple test endpoint
 */
const testEndpoint = (req: Request, res: Response) => {
  res.json({
    message: 'API is working',
    timestamp: new Date().toISOString()
  });
};

// ============================================================================
// Route Registration
// ============================================================================

// Language routes
apiRoutes.get('/languages', getLanguages);
apiRoutes.get('/languages/active', getActiveLanguages);
apiRoutes.put('/languages/:code/status', updateLanguageStatus);

// Translation routes
apiRoutes.post('/translations', saveTranslation);
apiRoutes.get('/translations/:language', getTranslationsByLanguage);

// Transcript routes
apiRoutes.post('/transcripts', saveTranscript);
apiRoutes.get('/transcripts/:sessionId/:language', getTranscriptsBySession);

// User routes
apiRoutes.get('/user', getUser);

// Health & diagnostics routes
apiRoutes.get('/health', healthCheck);
apiRoutes.get('/diagnostics', getDiagnostics);
apiRoutes.get('/diagnostics/export', exportDiagnostics);

// Classroom routes
apiRoutes.get('/join/:classCode', joinClassroom);

// Test routes
apiRoutes.get('/test', testEndpoint);

// ============================================================================
// Error Handling Middleware
// ============================================================================

/**
 * Global error handler for API routes
 */
export const apiErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('API Error:', error);
  
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      error: error.message
    });
  } else {
    // Check for specific error messages
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Special handling for diagnostics errors
    if (req.path === '/diagnostics' && errorMessage.includes('Metrics service failed')) {
      res.status(500).json({
        error: 'Failed to get diagnostics'
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  }
};




















