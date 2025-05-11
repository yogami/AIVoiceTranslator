import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Directly read the .env file
try {
  const envFile = path.join(rootDir, '.env');
  if (fs.existsSync(envFile)) {
    console.log('Loading environment variables from .env file');
    const envConfig = fs.readFileSync(envFile, 'utf8')
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .reduce((acc, line) => {
        const [key, value] = line.split('=');
        if (key && value) {
          acc[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
        }
        return acc;
      }, {} as Record<string, string>);
    
    // Apply to process.env
    Object.entries(envConfig).forEach(([key, value]) => {
      process.env[key] = value;
    });
  }
} catch (error) {
  console.error('Error loading .env file:', error);
}

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;