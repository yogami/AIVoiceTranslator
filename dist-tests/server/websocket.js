var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
/**
 * WebSocket Utilities
 *
 * This module provides a clean, object-oriented approach to WebSocket handling
 * following SOLID principles:
 * - Single Responsibility: Each class has one job
 * - Open/Closed: Extend functionality through decorators or strategy pattern
 * - Liskov Substitution: Subtypes are substitutable for their base types
 * - Interface Segregation: Clients use only what they need
 * - Dependency Inversion: High-level modules depend on abstractions
 */
import { WebSocketServer as WSServer } from 'ws';
// WebSocket connection states
export var WebSocketState = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
};
/**
 * WebSocketService class - Encapsulates WebSocket server operations
 * Following Single Responsibility Principle: one class, one responsibility
 */
var WebSocketService = /** @class */ (function () {
    /**
     * Creates a new WebSocketService
     */
    function WebSocketService(server, config) {
        if (config === void 0) { config = {}; }
        this.server = server;
        this.heartbeatInterval = null;
        this.messageHandlers = new Map();
        this.connectionHandlers = [];
        this.closeHandlers = [];
        // Merge provided config with defaults
        this.config = __assign(__assign({}, WebSocketService.DEFAULT_CONFIG), config);
        // Initialize WebSocket server
        this.wss = new WSServer({
            server: this.server,
            path: this.config.path
        });
        this.log('info', "WebSocket server initialized and listening on path: ".concat(this.config.path));
        // Setup the core event handlers
        this.setupEventHandlers();
        // Setup heartbeat mechanism
        this.setupHeartbeat();
    }
    /**
     * Set up core WebSocket event handlers
     */
    WebSocketService.prototype.setupEventHandlers = function () {
        var _this = this;
        // Handle new connections
        this.wss.on('connection', function (ws, request) {
            // Log the headers for debugging
            _this.log('debug', 'WebSocket connection verification, headers:', request.headers);
            var extendedWs = ws;
            extendedWs.isAlive = true;
            // Generate a unique session ID
            extendedWs.sessionId = "session_".concat(Date.now(), "_").concat(Math.floor(Math.random() * 100));
            _this.log('info', "New WebSocket connection from ".concat(request.socket.remoteAddress, " path: ").concat(request.url));
            _this.log('debug', 'Headers:', request.headers);
            // Handle pong messages for heartbeat
            extendedWs.on('pong', function () {
                extendedWs.isAlive = true;
            });
            // Handle incoming messages and route to appropriate handlers
            extendedWs.on('message', function (rawData) {
                try {
                    // Parse message
                    var data = rawData.toString();
                    var message_1 = JSON.parse(data);
                    _this.log('debug', "Received message type=".concat(message_1.type || 'unknown'));
                    // Process message by type
                    if (message_1.type === 'register') {
                        _this.log('info', "Processing message type=".concat(message_1.type, " from connection: role=").concat(message_1.role, ", languageCode=").concat(message_1.languageCode));
                        // If role is changing, log it
                        if (extendedWs.role !== message_1.role) {
                            _this.log('info', "Changing connection role from ".concat(extendedWs.role, " to ").concat(message_1.role));
                        }
                        // Update connection properties
                        extendedWs.role = message_1.role;
                        extendedWs.languageCode = message_1.languageCode;
                        _this.log('info', "Updated connection: role=".concat(extendedWs.role, ", languageCode=").concat(extendedWs.languageCode));
                    }
                    // Find and execute all registered handlers for this message type
                    var handlers = _this.messageHandlers.get(message_1.type) || [];
                    handlers.forEach(function (handler) {
                        try {
                            handler(extendedWs, message_1);
                        }
                        catch (handlerError) {
                            _this.log('error', "Error in message handler for type ".concat(message_1.type, ":"), handlerError);
                        }
                    });
                }
                catch (error) {
                    _this.log('error', 'Error processing message:', error);
                }
            });
            // Handle connection close
            extendedWs.on('close', function (code, reason) {
                _this.log('info', "WebSocket disconnected, sessionId: ".concat(extendedWs.sessionId));
                // Execute close handlers
                _this.closeHandlers.forEach(function (handler) {
                    try {
                        handler(extendedWs, code, reason);
                    }
                    catch (handlerError) {
                        _this.log('error', 'Error in close handler:', handlerError);
                    }
                });
            });
            // Send connection confirmation
            _this.sendToClient(extendedWs, {
                type: 'connection',
                sessionId: extendedWs.sessionId,
                status: 'connected',
                timestamp: Date.now()
            });
            _this.log('info', "Sending connection confirmation with sessionId: ".concat(extendedWs.sessionId));
            _this.log('info', 'Connection confirmation sent successfully');
            // Execute connection handlers
            _this.connectionHandlers.forEach(function (handler) {
                try {
                    handler(extendedWs, request);
                }
                catch (handlerError) {
                    _this.log('error', 'Error in connection handler:', handlerError);
                }
            });
        });
        // Handle server close
        this.wss.on('close', function () {
            _this.log('info', 'WebSocket server closed');
            _this.cleanup();
        });
    };
    /**
     * Set up heartbeat mechanism to detect dead connections
     */
    WebSocketService.prototype.setupHeartbeat = function () {
        var _this = this;
        this.heartbeatInterval = setInterval(function () {
            _this.wss.clients.forEach(function (ws) {
                var extendedWs = ws;
                if (extendedWs.isAlive === false) {
                    _this.log('debug', "Terminating inactive connection: ".concat(extendedWs.sessionId));
                    return extendedWs.terminate();
                }
                extendedWs.isAlive = false;
                extendedWs.ping();
            });
        }, this.config.heartbeatInterval);
    };
    /**
     * Clean up resources
     */
    WebSocketService.prototype.cleanup = function () {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    };
    /**
     * Register a message handler for a specific message type
     */
    WebSocketService.prototype.onMessage = function (type, handler) {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, []);
        }
        this.messageHandlers.get(type).push(handler);
    };
    /**
     * Register a connection handler
     */
    WebSocketService.prototype.onConnection = function (handler) {
        this.connectionHandlers.push(handler);
    };
    /**
     * Register a close handler
     */
    WebSocketService.prototype.onClose = function (handler) {
        this.closeHandlers.push(handler);
    };
    /**
     * Broadcast a message to all connected clients
     */
    WebSocketService.prototype.broadcast = function (message) {
        this.wss.clients.forEach(function (client) {
            if (client.readyState === WebSocketState.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    };
    /**
     * Broadcast a message to all connected clients with a specific role
     */
    WebSocketService.prototype.broadcastToRole = function (role, message) {
        this.wss.clients.forEach(function (client) {
            var extendedClient = client;
            if (extendedClient.readyState === WebSocketState.OPEN && extendedClient.role === role) {
                client.send(JSON.stringify(message));
            }
        });
    };
    /**
     * Send a message to a specific client
     */
    WebSocketService.prototype.sendToClient = function (client, message) {
        if (client.readyState === WebSocketState.OPEN) {
            client.send(JSON.stringify(message));
        }
    };
    /**
     * Get all connected clients
     */
    WebSocketService.prototype.getClients = function () {
        return this.wss.clients;
    };
    /**
     * Get the WebSocket server instance
     */
    WebSocketService.prototype.getServer = function () {
        return this.wss;
    };
    /**
     * Get clients with a specific role
     */
    WebSocketService.prototype.getClientsByRole = function (role) {
        var clients = [];
        this.wss.clients.forEach(function (client) {
            var extendedClient = client;
            if (extendedClient.role === role) {
                clients.push(extendedClient);
            }
        });
        return clients;
    };
    /**
     * Simple logging utility that respects the configured log level
     */
    WebSocketService.prototype.log = function (level, message) {
        var args = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            args[_i - 2] = arguments[_i];
        }
        var logLevels = {
            'none': 0,
            'error': 1,
            'warn': 2,
            'info': 3,
            'debug': 4
        };
        if (logLevels[level] <= logLevels[this.config.logLevel]) {
            switch (level) {
                case 'debug':
                    console.log.apply(console, __spreadArray([message], args, false));
                    break;
                case 'info':
                    console.log.apply(console, __spreadArray([message], args, false));
                    break;
                case 'warn':
                    console.warn.apply(console, __spreadArray([message], args, false));
                    break;
                case 'error':
                    console.error.apply(console, __spreadArray([message], args, false));
                    break;
            }
        }
    };
    // Default configuration
    WebSocketService.DEFAULT_CONFIG = {
        path: '/ws',
        heartbeatInterval: 30000,
        logLevel: 'info'
    };
    return WebSocketService;
}());
export { WebSocketService };
/**
 * Factory function for backward compatibility
 */
export function createWebSocketServer(server, path) {
    if (path === void 0) { path = '/ws'; }
    return new WebSocketService(server, { path: path });
}
/**
 * Broadcast function for backward compatibility
 */
export function broadcastMessage(wss, message) {
    if (wss instanceof WebSocketService) {
        wss.broadcast(message);
    }
    else {
        wss.clients.forEach(function (client) {
            if (client.readyState === WebSocketState.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
}
/**
 * SendToClient function for backward compatibility
 */
export function sendToClient(client, message) {
    if (client.readyState === WebSocketState.OPEN) {
        client.send(JSON.stringify(message));
    }
}
//# sourceMappingURL=websocket.js.map