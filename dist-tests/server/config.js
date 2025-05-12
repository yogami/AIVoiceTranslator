import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var rootDir = path.resolve(__dirname, '..');
// Directly read the .env file
try {
    var envFile = path.join(rootDir, '.env');
    if (fs.existsSync(envFile)) {
        console.log('Loading environment variables from .env file');
        var envConfig = fs.readFileSync(envFile, 'utf8')
            .split('\n')
            .filter(function (line) { return line.trim() && !line.startsWith('#'); })
            .reduce(function (acc, line) {
            var _a = line.split('='), key = _a[0], value = _a[1];
            if (key && value) {
                acc[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
            }
            return acc;
        }, {});
        // Apply to process.env
        Object.entries(envConfig).forEach(function (_a) {
            var key = _a[0], value = _a[1];
            process.env[key] = value;
        });
    }
}
catch (error) {
    console.error('Error loading .env file:', error);
}
export var OPENAI_API_KEY = process.env.OPENAI_API_KEY;
//# sourceMappingURL=config.js.map