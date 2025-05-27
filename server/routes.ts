/**
 * API Routes
 * 
 * Express routes for the API
 * Follows Clean Code principles:
 * - Single Responsibility Principle: Each handler does one thing
 * - DRY: Constants are defined once and reused
 * - Explicit error handling with try/catch
 * 
 * Also provides routes for code metrics collection and analysis
 */
import { Router, Request, Response } from 'express';
import { storage } from './storage';
import { DiagnosticsService } from './services/DiagnosticsService.js';

export const apiRoutes = Router();

// Initialize diagnostics service
const diagnosticsService = new DiagnosticsService();

// Export diagnostics service for use in other parts of the application
export { diagnosticsService };

/**
 * Get available languages
 * Returns a list of supported languages from the storage
 */
apiRoutes.get('/languages', async (req: Request, res: Response) => {
  try {
    // Retrieve languages from the storage service
    const languages = await storage.getLanguages();
    
    res.json(languages);
  } catch (error) {
    console.error('Error fetching languages:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve languages',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Get active languages
 * Returns only languages that are marked as active
 */
apiRoutes.get('/languages/active', async (req: Request, res: Response) => {
  try {
    // Retrieve only active languages
    const activeLanguages = await storage.getActiveLanguages();
    
    res.json(activeLanguages);
  } catch (error) {
    console.error('Error fetching active languages:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve active languages',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Health check endpoint
 * Returns basic server health information
 */
apiRoutes.get('/health', (req: Request, res: Response) => {
  try {
    // API versioning as a constant - Single source of truth
    const API_VERSION = '1.0.0';
    
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: API_VERSION,
      database: 'connected', // We're using in-memory storage, so it's always connected
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Error in health check:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

/**
 * Get user information
 * In a real app, this would be authenticated
 */
apiRoutes.get('/user', async (req: Request, res: Response) => {
  try {
    // In a real application, we would retrieve the user ID from the auth token
    // For now, just retrieve user #1 for testing
    const user = await storage.getUser(1);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve user',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Save translation
 * POST /api/translations
 */
apiRoutes.post('/translations', async (req: Request, res: Response) => {
  try {
    const { sourceLanguage, targetLanguage, originalText, translatedText, latency } = req.body;
    
    // Validate required fields
    if (!sourceLanguage || !targetLanguage || !originalText || !translatedText) {
      return res.status(400).json({ 
        error: 'Missing required fields: sourceLanguage, targetLanguage, originalText, translatedText' 
      });
    }
    
    const translation = await storage.addTranslation({
      sourceLanguage,
      targetLanguage,
      originalText,
      translatedText,
      latency: latency || 0
    });
    
    res.status(201).json(translation);
  } catch (error) {
    console.error('Error saving translation:', error);
    res.status(500).json({ 
      error: 'Failed to save translation',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Get translations by language
 * GET /api/translations/:language
 */
apiRoutes.get('/translations/:language', async (req: Request, res: Response) => {
  try {
    const { language } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    
    const translations = await storage.getTranslationsByLanguage(language, limit);
    
    res.json(translations);
  } catch (error) {
    console.error('Error fetching translations:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve translations',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Save transcript
 * POST /api/transcripts
 */
apiRoutes.post('/transcripts', async (req: Request, res: Response) => {
  try {
    const { sessionId, language, text } = req.body;
    
    // Validate required fields
    if (!sessionId || !language || !text) {
      return res.status(400).json({ 
        error: 'Missing required fields: sessionId, language, text' 
      });
    }
    
    const transcript = await storage.addTranscript({
      sessionId,
      language,
      text
    });
    
    res.status(201).json(transcript);
  } catch (error) {
    console.error('Error saving transcript:', error);
    res.status(500).json({ 
      error: 'Failed to save transcript',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Get transcripts by session and language
 * GET /api/transcripts/:sessionId/:language
 */
apiRoutes.get('/transcripts/:sessionId/:language', async (req: Request, res: Response) => {
  try {
    const { sessionId, language } = req.params;
    
    const transcripts = await storage.getTranscriptsBySession(sessionId, language);
    
    res.json(transcripts);
  } catch (error) {
    console.error('Error fetching transcripts:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve transcripts',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Update language status
 * PUT /api/languages/:code/status
 */
apiRoutes.put('/languages/:code/status', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ 
        error: 'isActive must be a boolean value' 
      });
    }
    
    const updatedLanguage = await storage.updateLanguageStatus(code, isActive);
    
    if (!updatedLanguage) {
      return res.status(404).json({ 
        error: 'Language not found' 
      });
    }
    
    res.json(updatedLanguage);
  } catch (error) {
    console.error('Error updating language status:', error);
    res.status(500).json({ 
      error: 'Failed to update language status',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Get application diagnostics
 * GET /api/diagnostics
 * Returns comprehensive application metrics in user-friendly format
 */
apiRoutes.get('/diagnostics', async (req: Request, res: Response) => {
  try {
    const metrics = diagnosticsService.getMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error retrieving diagnostics:', error);
    res.status(500).json({ 
      error: 'Unable to retrieve diagnostics data',
      message: 'Diagnostics service is temporarily unavailable. Please try again later.'
    });
  }
});

/**
 * Export diagnostics data
 * GET /api/diagnostics/export
 * Returns diagnostics data as downloadable JSON file
 */
apiRoutes.get('/diagnostics/export', async (req: Request, res: Response) => {
  try {
    const exportData = diagnosticsService.getExportData();
    const filename = `diagnostics-${new Date().toISOString().split('T')[0]}.json`;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting diagnostics:', error);
    res.status(500).json({ 
      error: 'Unable to export diagnostics data',
      message: 'Export service is temporarily unavailable. Please try again later.'
    });
  }
});




















