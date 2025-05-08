#!/bin/bash

# Script to force push changes to GitHub, completely overriding the remote branch

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Preparing to force push all local changes to GitHub...${NC}"

# Check if git is configured
if [ -z "$(git config --get user.name)" ]; then
  echo -e "${YELLOW}Setting up git configuration...${NC}"
  git config --global user.name "AIVoiceTranslator App"
  git config --global user.email "app@example.com"
fi

# Create commit message
COMMIT_MESSAGE="Complete codebase override with latest version

- Force pushing all local changes to override remote main branch completely
- Latest code includes TTS autoplay fixes, classroom simulation load tests, and all current implementation"

# Add all changes - in case there are any uncommitted changes
echo -e "${YELLOW}Adding all changes...${NC}"
git add -A

# Commit changes
echo -e "${YELLOW}Committing any remaining changes...${NC}"
git commit -m "$COMMIT_MESSAGE" || true

# Force push to GitHub
echo -e "${RED}WARNING: Force pushing to override remote main branch...${NC}"
echo -e "${YELLOW}This will completely replace the remote main branch with your local code${NC}"
git push -f origin main

# Check result
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Successfully force pushed changes to GitHub${NC}"
  echo -e "${YELLOW}The remote main branch now exactly matches your local code${NC}"
else
  echo -e "${RED}✗ Failed to force push changes to GitHub${NC}"
  echo -e "${YELLOW}Tip: Make sure you have the right permissions and GITHUB_TOKEN is set.${NC}"
  exit 1
fi