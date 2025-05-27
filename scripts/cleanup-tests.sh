#!/bin/bash

# Remove redundant test files after consolidation
rm -f tests/unit/websocket.test.ts
rm -f tests/unit/services/WebSocketServer.test.ts
rm -f tests/unit/services/TranslationService.test.ts
rm -f tests/unit/services/OpenAITranslationService.test.ts
rm -f tests/unit/services/OpenAITranscriptionService.test.ts

# Rename consolidated files
mv tests/unit/services/websocket-consolidated.test.ts tests/unit/services/websocket.test.ts
mv tests/unit/services/TranslationService-consolidated.test.ts tests/unit/services/TranslationService.test.ts

echo "Test cleanup complete!"
