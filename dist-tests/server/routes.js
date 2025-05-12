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
import { Router } from 'express';
import { storage } from './storage';
export var apiRoutes = Router();
// SOLID: Single Responsibility - Each handler has one specific task
// Each route is explicitly typed for better code safety
/**
 * Get available languages
 * Returns a list of supported languages from the storage
 */
apiRoutes.get('/languages', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var languages, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, storage.getLanguages()];
            case 1:
                languages = _a.sent();
                res.json(languages);
                return [3 /*break*/, 3];
            case 2:
                error_1 = _a.sent();
                console.error('Error fetching languages:', error_1);
                res.status(500).json({
                    error: 'Failed to retrieve languages',
                    message: error_1 instanceof Error ? error_1.message : 'Unknown error'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * Get active languages
 * Returns only languages that are marked as active
 */
apiRoutes.get('/languages/active', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var activeLanguages, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, storage.getActiveLanguages()];
            case 1:
                activeLanguages = _a.sent();
                res.json(activeLanguages);
                return [3 /*break*/, 3];
            case 2:
                error_2 = _a.sent();
                console.error('Error fetching active languages:', error_2);
                res.status(500).json({
                    error: 'Failed to retrieve active languages',
                    message: error_2 instanceof Error ? error_2.message : 'Unknown error'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * Health check endpoint
 * Returns basic server health information
 */
apiRoutes.get('/health', function (req, res) {
    try {
        // API versioning as a constant - Single source of truth
        var API_VERSION = '1.0.0';
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: API_VERSION,
            database: 'connected', // We're using in-memory storage, so it's always connected
            environment: process.env.NODE_ENV || 'development'
        });
    }
    catch (error) {
        console.error('Error in health check:', error);
        res.status(500).json({ error: 'Health check failed' });
    }
});
/**
 * Get user information
 * In a real app, this would be authenticated
 */
apiRoutes.get('/user', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var user, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, storage.getUser(1)];
            case 1:
                user = _a.sent();
                if (!user) {
                    return [2 /*return*/, res.status(404).json({ error: 'User not found' })];
                }
                res.json(user);
                return [3 /*break*/, 3];
            case 2:
                error_3 = _a.sent();
                console.error('Error fetching user:', error_3);
                res.status(500).json({
                    error: 'Failed to retrieve user',
                    message: error_3 instanceof Error ? error_3.message : 'Unknown error'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
//# sourceMappingURL=routes.js.map