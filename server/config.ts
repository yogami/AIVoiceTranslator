// import * as fs from 'fs'; // fs is no longer used
// import * as path from 'path'; // No longer used
// import { fileURLToPath } from 'url'; // No longer used

// const __filename = fileURLToPath(import.meta.url); // No longer used
// const __dirname = path.dirname(__filename); // No longer used
// const rootDir = path.resolve(__dirname, '..'); // No longer used

// Directly read the .env file - THIS ENTIRE TRY-CATCH BLOCK (manual parsing) IS REMOVED
// try {
//   const envFile = path.join(rootDir, '.env');
//   if (fs.existsSync(envFile)) {
//     console.log('Loading environment variables from .env file');
//     const envConfig = fs.readFileSync(envFile, 'utf8')
//       .split('\n')
//       .filter(line => line.trim() && !line.startsWith('#'))
//       .reduce((acc, line) => {
//         const [key, value] = line.split('=');
//         if (key && value) {
//           acc[key.trim()] = value.trim().replace(/^[\"\']|[\"\']$/g, '');
//         }
//         return acc;
//       }, {} as Record<string, string>);
//     
//     // Apply to process.env
//     Object.entries(envConfig).forEach(([key, value]) => {
//       process.env[key] = value;
//     });
//   }
// } catch (error) {
//   console.error('Error loading .env file:', error);
// }

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Remove the entire PATHS object as it seems unused
// export const PATHS = { ... };