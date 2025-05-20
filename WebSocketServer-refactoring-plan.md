# WebSocketServer Refactoring Plan

## Issues Identified
- Class has too many responsibilities (Single Responsibility Principle violation)
- Excessive use of Maps for state tracking creates cognitive overhead
- Complex methods with high cyclomatic complexity
- Excessive nesting in conditional logic
- Error handling lacks consistent patterns

## Refactoring Strategy

### 1. Extract Client State Management
Create a `WebSocketClientManager` class to:
- Track client connections
- Manage client state (role, language, settings)
- Provide clean APIs for querying clients by role, language, etc.

### 2. Extract Message Handlers
Create a `WebSocketMessageRouter` class to:
- Process incoming messages
- Route to appropriate handler based on message type
- Standardize error handling

### 3. Extract Service-Specific Handlers
Create specialized handler classes:
- `TranscriptionMessageHandler` - Process transcription messages
- `TTSMessageHandler` - Process text-to-speech requests
- `AudioMessageHandler` - Process audio stream messages
- `RegistrationMessageHandler` - Process client registration

### 4. Simplify Main WebSocket Class
Refactor WebSocketServer to:
- Focus solely on core WebSocket lifecycle management
- Delegate message handling to specialized classes
- Improve error handling and logging

### 5. Create Unified Client Model
Replace multiple Maps with a unified client model:
```typescript
interface WebSocketClientState {
  connection: WebSocketClient;
  role?: string;
  language?: string;
  sessionId: string;
  settings: {
    ttsServiceType?: string;
    [key: string]: any;
  };
  isAlive: boolean;
}
```

## Benefits
- Improved testability through smaller, focused classes
- Reduced cognitive complexity
- Better separation of concerns
- Cleaner error handling
- More maintainable code