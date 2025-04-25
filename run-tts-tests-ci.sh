#!/bin/bash

# Script to manually trigger the TTS Selection Tests workflow on GitHub using curl
# Requires GITHUB_TOKEN to be set in your environment

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Config - modify these to match your repository
GITHUB_USERNAME="your-username"
REPO_NAME="AIVoiceTranslator"
WORKFLOW_ID="tts-autoplay-verification.yml"

echo -e "${YELLOW}Triggering TTS Selection Tests on GitHub...${NC}"

# Check if GITHUB_TOKEN is set
if [ -z "$GITHUB_TOKEN" ]; then
  # Try to get it from Replit secrets
  GITHUB_TOKEN=$(grep -A1 "GITHUB_TOKEN" .replit.nix | tail -n 1 | cut -d '"' -f 2 || echo "")
  
  if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}Error: GITHUB_TOKEN environment variable is not set.${NC}" >&2
    echo "Please set it in your environment or Replit secrets."
    exit 1
  fi
fi

# Push latest changes to GitHub first
echo -e "${YELLOW}Pushing latest changes to GitHub...${NC}"
git add server/services/WebSocketServer.ts
git commit -m "Fix TTS service selection defaults: Default to 'browser' instead of 'openai'"
git push

if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to push changes to GitHub. Please check your git configuration.${NC}"
  exit 1
fi

# Trigger the workflow via GitHub API
echo -e "${YELLOW}Triggering workflow: $WORKFLOW_ID...${NC}"

RESPONSE=$(curl -s -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$GITHUB_USERNAME/$REPO_NAME/actions/workflows/$WORKFLOW_ID/dispatches" \
  -d '{"ref":"main"}')

# Check if there was an error (GitHub API returns empty response on success)
if [[ $RESPONSE == *"message"* ]]; then
  echo -e "${RED}Error triggering workflow:${NC}"
  echo $RESPONSE
  exit 1
else
  echo -e "${GREEN}✓ Successfully triggered TTS Selection Tests workflow${NC}"
  echo -e "Check the Actions tab on GitHub to monitor progress: ${YELLOW}https://github.com/$GITHUB_USERNAME/$REPO_NAME/actions${NC}"
fi

echo -e "\n${YELLOW}What this test verifies:${NC}"
echo "1. Browser TTS selection is correctly respected"
echo "2. TTS service preference is properly propagated to all translations"
echo "3. Audio autoplay works for both OpenAI and Browser TTS"
echo "4. No more defaults to 'openai' when 'browser' is selected"

echo -e "\n${YELLOW}Test logs will be available in the GitHub Actions interface${NC}"