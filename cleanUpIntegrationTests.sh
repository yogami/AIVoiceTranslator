#!/bin/bash
# filepath: /Users/yamijala/gitprojects/AIVoiceTranslator/cleanup-redundant-tests.sh

echo "🧹 Cleaning up redundant integration test files..."

# Remove empty placeholder files
echo "Removing empty placeholder files..."
rm -f tests/integration/core/websocket-integration.test.ts
rm -f tests/integration/core/translation-integration.test.ts
rm -f tests/integration/core/audio-processing-integration.test.ts
rm -f tests/integration/api/routes-integration.test.ts

# Remove duplicate files (keeping the consolidated versions)
echo "Removing duplicate test files..."
rm -f tests/integration/websocket-server-integration.test.ts
rm -f tests/integration/connection-management-integration.test.ts
rm -f tests/integration/services/translation-tts-integration.test.ts
rm -f tests/integration/storage-integration.test.ts

# Remove the core directory if it's empty
rmdir tests/integration/core 2>/dev/null

echo "✅ Cleanup complete!"
echo ""
echo "📊 Summary of changes:"
echo "- Removed 4 empty placeholder files"
echo "- Removed 4 duplicate test files"
echo "- Consolidated connection management tests into websocket-connection-integration.test.ts"
echo ""
echo "🔍 Remaining integration test files:"
find tests/integration -name "*.test.ts" -o -name "*.spec.ts" | sort
