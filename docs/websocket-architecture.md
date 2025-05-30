# WebSocket Architecture Documentation

## Current Implementation Status

### ✅ ACTIVE Implementation
**File**: `server/services/WebSocketServer.ts`
**Class**: `WebSocketServer`
**Used by**: `server/server.ts`

This is the PRIMARY WebSocket server that handles all real-time communication in the application.

**Features**:
- Teacher/Student role management
- Real-time speech transcription
- OpenAI translation pipeline
- TTS (Text-to-Speech) audio generation
- Session tracking and heartbeat
- Connection state management

### 🚫 INACTIVE Implementation
**File**: `server/websocket-legacy.ts` (renamed from websocket.ts)
**Class**: `WebSocketServiceLegacy`
**Status**: Not used by the application

This is an alternative implementation kept for reference.

**Features**:
- Generic WebSocket service
- Classroom session management
- Event handler system
- Backward compatibility utilities

## Architecture Flow

