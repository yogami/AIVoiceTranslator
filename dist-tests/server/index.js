var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
/**
 * AIVoiceTranslator Server
 *
 * Main server entry point with Express and WebSocket setup
 */
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from './services/WebSocketServer';
import { apiRoutes } from './routes';
import './config';
// SOLID: Single Responsibility - CORS middleware has one job
var configureCorsMiddleware = function (app) {
    app.use(function (req, res, next) {
        // Allow requests from any origin
        res.header('Access-Control-Allow-Origin', '*');
        // Allow these HTTP methods
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        // Allow these headers
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        // Allow credentials
        res.header('Access-Control-Allow-Credentials', 'true');
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            res.sendStatus(200);
        }
        else {
            next();
        }
    });
    console.log('CORS middleware configured successfully');
};
function startServer() {
    return __awaiter(this, void 0, void 0, function () {
        var app, httpServer, wss, port;
        return __generator(this, function (_a) {
            // Check for OpenAI API key
            if (!process.env.OPENAI_API_KEY) {
                console.warn('⚠️ No OPENAI_API_KEY found in environment variables');
                console.warn('Translation functionality will be limited');
            }
            else {
                console.log('OpenAI API key status: Present');
                console.log('OpenAI client initialized successfully');
                console.log('OpenAI Streaming - API key status: Present');
                console.log('OpenAI Streaming - client initialized successfully');
            }
            app = express();
            // Apply CORS middleware (Open/Closed Principle - extending functionality without modifying existing code)
            configureCorsMiddleware(app);
            // Parse JSON in request body
            app.use(express.json());
            // Add API routes
            app.use('/api', apiRoutes);
            httpServer = createServer(app);
            wss = new WebSocketServer(httpServer);
            // Serve static files from client/public directory
            app.use(express.static('client/public'));
            // Route for student page
            app.get('/student', function (req, res) {
                res.sendFile('simple-student.html', { root: 'client/public' });
            });
            // Route for teacher page
            app.get('/teacher', function (req, res) {
                // Find the teacher HTML file
                if (req.query.demo === 'true') {
                    res.sendFile('simple-speech-test.html', { root: 'client/public' });
                }
                else {
                    res.sendFile('simple-speech-test.html', { root: 'client/public' });
                }
            });
            // Route for metrics dashboard
            app.get('/metrics', function (req, res) {
                res.sendFile('metrics-dashboard.html', { root: 'client/public' });
            });
            // Route for feature tests dashboard
            app.get('/tests', function (req, res) {
                res.sendFile('feature-tests-dashboard.html', { root: 'client/public' });
            });
            // Serve index.html for root route
            app.get('/', function (req, res) {
                res.sendFile('index.html', { root: 'client' });
            });
            // Catch-all route for any other routes
            app.get('*', function (req, res) {
                res.sendFile('index.html', { root: 'client' });
            });
            port = process.env.PORT || 5000;
            httpServer.listen(port, function () {
                console.log("".concat(new Date().toLocaleTimeString(), " [express] serving on port ").concat(port));
            });
            return [2 /*return*/];
        });
    });
}
// Start the server
startServer().catch(function (error) {
    console.error('Error starting server:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map