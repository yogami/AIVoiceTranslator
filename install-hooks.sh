#!/bin/bash

# Script to install git hooks for the project

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Installing git hooks..."

# Ensure hooks directory exists
mkdir -p .git/hooks

# Copy pre-commit hook
cp .github/hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Successfully installed pre-commit hook${NC}"
else
  echo -e "${RED}✗ Failed to install pre-commit hook${NC}"
  exit 1
fi

echo -e "${GREEN}All hooks installed successfully!${NC}"
echo "Run git hooks before each commit to ensure quality commits."