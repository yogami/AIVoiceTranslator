# Routes.ts Refactoring Plan

## Current Problem
- Single 557-line file violates SOLID principles
- Mixed responsibilities: routing, business logic, database queries, OpenAI integration
- Hard to test, maintain, and extend

## Proposed Structure

```
server/
├── routes/
│   ├── index.ts              # Main router assembly
│   ├── analytics.routes.ts   # Analytics endpoints
│   ├── languages.routes.ts   # Language management
│   ├── translations.routes.ts # Translation endpoints  
│   ├── transcripts.routes.ts # Transcript endpoints
│   ├── health.routes.ts      # Health & diagnostics
│   ├── classroom.routes.ts   # Classroom joining
│   └── auth.routes.ts        # Already exists
├── services/
│   ├── AnalyticsService.ts   # OpenAI + database analytics logic
│   ├── LanguageService.ts    # Language business logic
│   ├── TranslationService.ts # Translation business logic
│   └── TranscriptService.ts  # Transcript business logic
├── controllers/
│   ├── AnalyticsController.ts
│   ├── LanguagesController.ts
│   ├── TranslationsController.ts
│   └── TranscriptsController.ts
└── middleware/
    ├── validation.middleware.ts # Input validation
    ├── error-handler.middleware.ts # Centralized error handling
    └── analytics-security.ts    # Already exists
```

## Benefits
1. **Single Responsibility**: Each file has one clear purpose
2. **Easier Testing**: Isolated units can be tested independently  
3. **Better Maintainability**: Changes affect only relevant modules
4. **Improved Readability**: Smaller, focused files
5. **Flexible Scaling**: Easy to add new routes/services

## Migration Strategy
1. Extract services first (business logic)
2. Create route modules (HTTP handling)  
3. Update main routes/index.ts to assemble everything
4. Test each module individually
5. Remove old routes.ts after validation

## Priority Order
1. AnalyticsService (most complex, with OpenAI integration)
2. Health routes (simplest, good starting point)
3. Language/Translation services
4. Transcript services
5. Centralized error handling
