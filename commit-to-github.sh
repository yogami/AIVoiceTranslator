#!/bin/bash

# Script to commit and push changes to GitHub

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Committing and pushing changes to GitHub...${NC}"

# Check if git is configured
if [ -z "$(git config --get user.name)" ]; then
  echo -e "${YELLOW}Setting up git configuration...${NC}"
  git config --global user.name "AIVoiceTranslator App"
  git config --global user.email "app@example.com"
fi

# Create commit message
COMMIT_MESSAGE="Add classroom simulation load test and fix TTS autoplay behavior

- Fixed browser TTS autoPlay flag to match OpenAI TTS behavior
- Fixed JSON parsing in WebSocketServer.ts for speech parameters
- Updated student interface to handle autoPlay flag consistently
- Added classroom simulation load test for 25+ simultaneous users
- Created documentation and GitHub workflow for load testing
- Added verification test page for TTS autoplay functionality"

# Add all changes
echo -e "${YELLOW}Adding changes...${NC}"
git add .

# Commit changes
echo -e "${YELLOW}Committing changes...${NC}"
git commit -m "$COMMIT_MESSAGE"

# Push to GitHub
echo -e "${YELLOW}Pushing to GitHub...${NC}"
git push origin main

# Check result
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Successfully pushed changes to GitHub${NC}"
else
  echo -e "${RED}✗ Failed to push changes to GitHub${NC}"
  echo -e "${YELLOW}Tip: Make sure you have the right permissions and GITHUB_TOKEN is set.${NC}"
  exit 1
fi