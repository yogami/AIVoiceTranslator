/**
 * Database Test Server
 * 
 * This script tests the database connection and storage implementation
 */
import express from 'express';
import { storage } from './storage';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// API routes for testing
app.get('/api/languages', async (req, res) => {
  try {
    const languages = await storage.getLanguages();
    res.json(languages);
  } catch (error) {
    console.error('Error fetching languages:', error);
    res.status(500).json({ error: 'Failed to retrieve languages' });
  }
});

app.get('/api/languages/active', async (req, res) => {
  try {
    const activeLanguages = await storage.getActiveLanguages();
    res.json(activeLanguages);
  } catch (error) {
    console.error('Error fetching active languages:', error);
    res.status(500).json({ error: 'Failed to retrieve active languages' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Database test server running on port ${PORT}`);
  console.log(`Try accessing: http://localhost:${PORT}/api/languages`);
});