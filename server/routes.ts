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
import { 
  getAllMetrics, 
  refreshMetrics, 
  CoverageMetrics, 
  ComplexityMetrics,
  CodeSmellsMetrics,
  DuplicationMetrics,
  DependenciesMetrics,
  TestResultsMetrics
} from './metrics';

export const apiRoutes = Router();

// SOLID: Single Responsibility - Each handler has one specific task
// Each route is explicitly typed for better code safety

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
 * Get all code metrics
 * Returns all code quality metrics for the project
 */
apiRoutes.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await getAllMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve metrics',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Get code coverage metrics
 * Returns test coverage metrics for the project
 */
apiRoutes.get('/metrics/coverage', async (req: Request, res: Response) => {
  try {
    const metrics = await getAllMetrics();
    res.json(metrics.coverage);
  } catch (error) {
    console.error('Error fetching coverage metrics:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve coverage metrics',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Get code complexity metrics
 * Returns complexity metrics for the project
 */
apiRoutes.get('/metrics/complexity', async (req: Request, res: Response) => {
  try {
    const metrics = await getAllMetrics();
    res.json(metrics.complexity);
  } catch (error) {
    console.error('Error fetching complexity metrics:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve complexity metrics',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Get code smells metrics
 * Returns code smells metrics for the project
 */
apiRoutes.get('/metrics/code-smells', async (req: Request, res: Response) => {
  try {
    const metrics = await getAllMetrics();
    res.json(metrics.codeSmells);
  } catch (error) {
    console.error('Error fetching code smells metrics:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve code smells metrics',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Get code duplication metrics
 * Returns duplication metrics for the project
 */
apiRoutes.get('/metrics/duplication', async (req: Request, res: Response) => {
  try {
    const metrics = await getAllMetrics();
    res.json(metrics.duplication);
  } catch (error) {
    console.error('Error fetching duplication metrics:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve duplication metrics',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Get dependencies metrics
 * Returns dependencies metrics for the project
 */
apiRoutes.get('/metrics/dependencies', async (req: Request, res: Response) => {
  try {
    const metrics = await getAllMetrics();
    res.json(metrics.dependencies);
  } catch (error) {
    console.error('Error fetching dependencies metrics:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve dependencies metrics',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Get test results metrics
 * Returns test results metrics for the project
 */
apiRoutes.get('/metrics/test-results', async (req: Request, res: Response) => {
  try {
    const metrics = await getAllMetrics();
    res.json(metrics.testResults);
  } catch (error) {
    console.error('Error fetching test results metrics:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve test results metrics',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Get CI/CD workflow metrics
 * Returns GitHub Actions workflow metrics
 */
apiRoutes.get('/metrics/ci-cd', async (req: Request, res: Response) => {
  try {
    const metrics = await getAllMetrics();
    res.json({
      cicd: metrics.testResults.cicd,
      audio: metrics.testResults.audio
    });
  } catch (error) {
    console.error('Error fetching CI/CD metrics:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve CI/CD metrics',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Get audio test metrics
 * Returns metrics specifically for audio tests
 */
apiRoutes.get('/metrics/audio-tests', async (req: Request, res: Response) => {
  try {
    const metrics = await getAllMetrics();
    res.json(metrics.testResults.audio);
  } catch (error) {
    console.error('Error fetching audio test metrics:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve audio test metrics',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Refresh all metrics
 * Forces a recalculation of all metrics
 */
apiRoutes.post('/metrics/refresh', async (req: Request, res: Response) => {
  try {
    const metrics = await refreshMetrics();
    res.json({ success: true, metrics });
  } catch (error) {
    console.error('Error refreshing metrics:', error);
    res.status(500).json({ 
      error: 'Failed to refresh metrics',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});