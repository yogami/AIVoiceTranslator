/**
 * API Routes
 * 
 * Express routes for the API
 */
import { Router } from 'express';

export const apiRoutes = Router();

// Get available languages
apiRoutes.get('/languages', (req, res) => {
  // Return a list of supported languages
  const languages = [
    { id: 1, code: 'en-US', name: 'English (US)', isActive: true },
    { id: 2, code: 'es-ES', name: 'Spanish (Spain)', isActive: true },
    { id: 3, code: 'fr-FR', name: 'French (France)', isActive: true },
    { id: 4, code: 'de-DE', name: 'German (Germany)', isActive: true },
    { id: 5, code: 'it-IT', name: 'Italian (Italy)', isActive: true },
    { id: 6, code: 'pt-BR', name: 'Portuguese (Brazil)', isActive: true },
    { id: 7, code: 'zh-CN', name: 'Chinese (Simplified)', isActive: true },
    { id: 8, code: 'ja-JP', name: 'Japanese (Japan)', isActive: true },
    { id: 9, code: 'ru-RU', name: 'Russian (Russia)', isActive: true },
    { id: 10, code: 'ar-SA', name: 'Arabic (Saudi Arabia)', isActive: true },
  ];
  
  res.json(languages);
});

// Health check endpoint
apiRoutes.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Basic user info for testing
apiRoutes.get('/user', (req, res) => {
  // This would normally be authenticated
  res.json({
    id: 1,
    name: 'Test User',
    role: 'teacher',
    settings: {
      preferredLanguage: 'en-US',
      theme: 'light'
    }
  });
});