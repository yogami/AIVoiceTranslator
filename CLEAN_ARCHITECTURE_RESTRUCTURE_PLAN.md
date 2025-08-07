# Clean Architecture Restructuring Plan

## 🏗️ Proposed Clean Architecture Structure

Following Clean Architecture principles (Domain → Application → Infrastructure → Interface Adapters):

```
server/
├── domain/                     # Domain Layer (Core Business Logic)
│   ├── entities/              # Core business entities
│   │   ├── Session.ts
│   │   ├── Translation.ts
│   │   ├── Audio.ts
│   │   └── User.ts
│   ├── interfaces/            # Core domain interfaces (ports)
│   │   ├── repositories/      # Repository interfaces
│   │   │   ├── ISessionRepository.ts
│   │   │   ├── ITranslationRepository.ts
│   │   │   └── IUserRepository.ts
│   │   ├── services/          # Domain service interfaces
│   │   │   ├── ISTTService.ts
│   │   │   ├── ITranslationService.ts
│   │   │   └── ITTSService.ts
│   │   └── events/            # Domain events
│   │       ├── SessionCreated.ts
│   │       └── TranslationCompleted.ts
│   └── value-objects/         # Value objects
│       ├── Language.ts
│       ├── AudioBuffer.ts
│       └── TranslationResult.ts
│
├── application/               # Application Layer (Use Cases/Business Logic)
│   ├── use-cases/            # Application use cases
│   │   ├── session/
│   │   │   ├── CreateSessionUseCase.ts
│   │   │   ├── JoinSessionUseCase.ts
│   │   │   └── CleanupSessionUseCase.ts
│   │   ├── translation/
│   │   │   ├── ProcessTranslationUseCase.ts
│   │   │   └── GetTranslationHistoryUseCase.ts
│   │   └── analytics/
│   │       └── GenerateAnalyticsUseCase.ts
│   ├── services/             # Application services (orchestrators)
│   │   ├── SpeechPipelineOrchestrator.ts
│   │   ├── SessionOrchestrator.ts
│   │   └── AnalyticsOrchestrator.ts
│   └── dto/                  # Data Transfer Objects
│       ├── TranslationRequest.ts
│       ├── SessionResponse.ts
│       └── AnalyticsData.ts
│
├── infrastructure/           # Infrastructure Layer (External Adapters)
│   ├── persistence/          # Data persistence implementations
│   │   ├── repositories/     # Repository implementations
│   │   │   ├── PostgresSessionRepository.ts
│   │   │   ├── PostgresTranslationRepository.ts
│   │   │   └── PostgresUserRepository.ts
│   │   └── migrations/       # Database migrations
│   ├── external-services/    # External service implementations
│   │   ├── speech/
│   │   │   ├── OpenAISTTService.ts
│   │   │   ├── ElevenLabsSTTService.ts
│   │   │   └── WhisperCppSTTService.ts
│   │   ├── translation/
│   │   │   ├── OpenAITranslationService.ts
│   │   │   ├── DeepSeekTranslationService.ts
│   │   │   └── MyMemoryTranslationService.ts
│   │   └── tts/
│   │       ├── ElevenLabsTTSService.ts
│   │       ├── OpenAITTSService.ts
│   │       └── BrowserTTSService.ts
│   ├── factories/            # Service factories with fallback logic
│   │   ├── STTServiceFactory.ts
│   │   ├── TranslationServiceFactory.ts
│   │   └── TTSServiceFactory.ts
│   └── config/               # Configuration management
│       ├── DatabaseConfig.ts
│       ├── ServiceConfig.ts
│       └── EnvironmentConfig.ts
│
├── interface-adapters/       # Interface Adapters Layer
│   ├── web/                  # Web interface adapters
│   │   ├── controllers/      # HTTP controllers
│   │   │   ├── SessionController.ts
│   │   │   ├── TranslationController.ts
│   │   │   └── AnalyticsController.ts
│   │   ├── routes/           # Route definitions
│   │   │   ├── session.routes.ts
│   │   │   ├── translation.routes.ts
│   │   │   └── analytics.routes.ts
│   │   └── middleware/       # Web middleware
│   │       ├── AuthMiddleware.ts
│   │       ├── ValidationMiddleware.ts
│   │       └── ErrorMiddleware.ts
│   ├── websocket/            # WebSocket interface adapters
│   │   ├── WebSocketServer.ts
│   │   ├── handlers/         # Message handlers
│   │   │   ├── SessionHandlers.ts
│   │   │   ├── TranslationHandlers.ts
│   │   │   └── TTSHandlers.ts
│   │   └── connection/       # Connection management
│   │       ├── ConnectionManager.ts
│   │       ├── HealthManager.ts
│   │       └── LifecycleManager.ts
│   └── mappers/              # Data mappers between layers
│       ├── SessionMapper.ts
│       ├── TranslationMapper.ts
│       └── UserMapper.ts
│
├── shared/                   # Shared utilities across layers
│   ├── types/                # Shared type definitions
│   ├── utils/                # Utility functions
│   ├── constants/            # Application constants
│   └── errors/               # Custom error types
│
└── main/                     # Main application entry point
    ├── server.ts             # Server bootstrap
    ├── dependency-injection.ts # DI container setup
    └── app.ts                # Application factory
```

## 🚀 Key Architectural Improvements

### 1. **Dependency Direction**
- Domain: No external dependencies
- Application: Depends only on Domain
- Infrastructure: Implements Domain interfaces
- Interface Adapters: Depends on Application layer

### 2. **Separation of Concerns**
- **Domain**: Pure business logic and rules
- **Application**: Use cases and business orchestration
- **Infrastructure**: External service implementations
- **Interface Adapters**: HTTP/WebSocket/Database adapters

### 3. **Dependency Inversion**
- Domain defines interfaces (ports)
- Infrastructure implements them (adapters)
- Application layer orchestrates without knowing implementation details

### 4. **Clean Boundaries**
- No infrastructure leaking into domain
- Clear interfaces between layers
- Testable business logic in isolation

## 📦 Migration Strategy

### Phase 1: Domain Layer
1. Create domain entities and value objects
2. Define core domain interfaces
3. Move business rules to domain layer

### Phase 2: Application Layer  
1. Extract use cases from current services
2. Create application services as orchestrators
3. Define DTOs for layer communication

### Phase 3: Infrastructure Layer
1. Move external service implementations
2. Create repository implementations
3. Set up service factories with fallback logic

### Phase 4: Interface Adapters
1. Restructure controllers and routes
2. Refactor WebSocket handlers
3. Create proper data mappers

### Phase 5: Integration & Testing
1. Update dependency injection
2. Fix all import paths
3. Run integration tests to verify
4. Update client references

## 🧪 Testing Strategy

- **Domain**: Unit tests for business logic
- **Application**: Use case tests with mocked dependencies
- **Infrastructure**: Integration tests with real services
- **Interface Adapters**: Controller/handler tests
- **End-to-End**: Full integration tests as safety net
