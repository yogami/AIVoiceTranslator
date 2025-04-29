#!/bin/bash
# Run tests with --experimental-vm-modules to support ES modules
node --experimental-vm-modules node_modules/.bin/jest tests/unit/WebSocketServer.test.ts