import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { TranslationWebSocketServer } from "./websocket";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Initialize WebSocket server
  const wss = new TranslationWebSocketServer(httpServer);
  
  // API Routes
  
  // Get available languages
  app.get('/api/languages', async (_req, res) => {
    try {
      const languages = await storage.getLanguages();
      res.json(languages);
    } catch (error) {
      console.error('Error fetching languages:', error);
      res.status(500).json({ message: 'Failed to fetch languages' });
    }
  });
  
  // Get active languages
  app.get('/api/languages/active', async (_req, res) => {
    try {
      const languages = await storage.getActiveLanguages();
      res.json(languages);
    } catch (error) {
      console.error('Error fetching active languages:', error);
      res.status(500).json({ message: 'Failed to fetch active languages' });
    }
  });
  
  // Get language by code
  app.get('/api/languages/:code', async (req, res) => {
    try {
      const { code } = req.params;
      const language = await storage.getLanguageByCode(code);
      
      if (!language) {
        return res.status(404).json({ message: 'Language not found' });
      }
      
      res.json(language);
    } catch (error) {
      console.error('Error fetching language:', error);
      res.status(500).json({ message: 'Failed to fetch language' });
    }
  });
  
  // Update language status
  app.patch('/api/languages/:code', async (req, res) => {
    try {
      const { code } = req.params;
      const schema = z.object({
        isActive: z.boolean()
      });
      
      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: 'Invalid request body' });
      }
      
      const { isActive } = validationResult.data;
      const language = await storage.updateLanguageStatus(code, isActive);
      
      if (!language) {
        return res.status(404).json({ message: 'Language not found' });
      }
      
      res.json(language);
    } catch (error) {
      console.error('Error updating language:', error);
      res.status(500).json({ message: 'Failed to update language' });
    }
  });
  
  // Get translations by language
  app.get('/api/translations/:language', async (req, res) => {
    try {
      const { language } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      const translations = await storage.getTranslationsByLanguage(language, limit);
      res.json(translations);
    } catch (error) {
      console.error('Error fetching translations:', error);
      res.status(500).json({ message: 'Failed to fetch translations' });
    }
  });
  
  // Get transcripts by session and language
  app.get('/api/transcripts/:sessionId/:language', async (req, res) => {
    try {
      const { sessionId, language } = req.params;
      const transcripts = await storage.getTranscriptsBySession(sessionId, language);
      res.json(transcripts);
    } catch (error) {
      console.error('Error fetching transcripts:', error);
      res.status(500).json({ message: 'Failed to fetch transcripts' });
    }
  });
  
  // Get WebSocket server stats
  app.get('/api/stats', async (_req, res) => {
    try {
      const stats = wss.getStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ message: 'Failed to fetch stats' });
    }
  });

  return httpServer;
}
