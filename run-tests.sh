#!/bin/bash
# Run tests with --experimental-vm-modules to support ES modules
echo "Running WebSocketServer tests..."
node --experimental-vm-modules node_modules/.bin/jest tests/unit/WebSocketServer.test.ts

echo "Running TranslationService tests..."
node --experimental-vm-modules node_modules/.bin/jest tests/unit/TranslationService.test.ts