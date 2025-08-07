# Communication Protocol Configuration

This document explains how to configure the communication protocol for the AIVoiceTranslator application.

## Environment Variable

The communication protocol is controlled by the `COMMUNICATION_PROTOCOL` environment variable.

### Available Options

- **`websocket`** (default) - Traditional WebSocket communication
  - ✅ Production ready
  - ✅ Full feature support
  - ✅ Reliable and tested
  - 🎯 **Recommended for production**

- **`webrtc`** (experimental) - WebRTC peer-to-peer communication
  - ⚠️ Placeholder implementation
  - 🚧 Future feature for direct connections
  - 📝 Not ready for production use

### Configuration Files

The protocol is configured in the following environment files:

#### Development (`.env`)
```bash
COMMUNICATION_PROTOCOL=websocket
```

#### Testing (`.env.test`)
```bash
COMMUNICATION_PROTOCOL=websocket
```

#### Production (`.env.production`)
```bash
# Set this in Railway dashboard environment variables
COMMUNICATION_PROTOCOL=$COMMUNICATION_PROTOCOL
```

#### Example (`.env.example`)
```bash
# Communication Protocol for real-time communication
# Options: 'websocket' (default), 'webrtc' (experimental)
# websocket: Traditional WebSocket communication (recommended for production)
# webrtc: WebRTC peer-to-peer communication (for future direct connection features)
# Default: websocket
COMMUNICATION_PROTOCOL=websocket
```

## Railway Deployment Configuration

For production deployment on Railway, you need to set the environment variable in the Railway dashboard:

1. Go to your Railway project dashboard
2. Navigate to the **Variables** tab
3. Add a new environment variable:
   - **Key**: `COMMUNICATION_PROTOCOL`
   - **Value**: `websocket`

## Runtime Protocol Switching

The application supports runtime protocol switching through the `CommunicationProtocolFactory`:

```typescript
// Environment-based creation (recommended)
const protocol = CommunicationProtocolFactory.createFromEnvironment();

// Direct protocol creation
const websocketProtocol = CommunicationProtocolFactory.create('websocket');
const webrtcProtocol = CommunicationProtocolFactory.create('webrtc');

// Runtime switching (advanced usage)
await communicationService.switchProtocol(newProtocol);
```

## Architecture Benefits

The protocol abstraction provides:

- **🔄 Seamless switching** between WebSocket and WebRTC
- **🏗️ Clean architecture** with SOLID principles
- **🔒 Backward compatibility** with existing WebSocket tests
- **🚀 Future-ready** for WebRTC implementation
- **⚡ Runtime flexibility** for different deployment scenarios

## Testing

The protocol factory includes comprehensive unit tests covering:

- Environment variable validation
- Default fallback behavior
- Protocol creation and switching
- Error handling for invalid configurations

Run tests with:
```bash
npm test -- tests/unit/CommunicationProtocolFactory.test.ts
```

## Migration Path

### Current State (WebSocket)
- ✅ Fully implemented and production-ready
- ✅ All integration tests passing
- ✅ Complete feature support

### Future State (WebRTC)
- 📝 Interface ready for implementation
- 🏗️ Placeholder protocol created
- 🔧 Seamless switching capability prepared
- 🎯 Direct peer-to-peer connections planned

The architecture is designed for seamless migration when WebRTC implementation is ready.
