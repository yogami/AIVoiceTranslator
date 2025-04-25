#!/bin/bash

# Script to manually trigger the CI/CD workflow on GitHub
# Requires the GitHub CLI (gh) to be installed and authenticated

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Triggering CI/CD workflow on GitHub...${NC}"

# Check if GitHub CLI is installed
if ! [ -x "$(command -v gh)" ]; then
  echo -e "${RED}Error: GitHub CLI (gh) is not installed.${NC}" >&2
  echo "Please install it from https://cli.github.com/"
  exit 1
fi

# Check if user is authenticated
if ! gh auth status &>/dev/null; then
  echo -e "${RED}Error: You are not authenticated with GitHub CLI.${NC}" >&2
  echo "Please run 'gh auth login' to authenticate."
  exit 1
fi

# Get repository information
REPO_URL=$(git config --get remote.origin.url)
if [ -z "$REPO_URL" ]; then
  echo -e "${RED}Error: Cannot determine GitHub repository.${NC}" >&2
  echo "Please make sure you're in a git repository connected to GitHub."
  exit 1
fi

# Extract owner and repo name
if [[ $REPO_URL == *"github.com"* ]]; then
  # Extract from HTTPS URL
  REPO_INFO=$(echo $REPO_URL | sed -n 's/.*github.com\/\([^\/]*\/[^\/]*\).*/\1/p' | sed 's/\.git$//')
elif [[ $REPO_URL == *":"* ]]; then
  # Extract from SSH URL
  REPO_INFO=$(echo $REPO_URL | sed -n 's/.*:\([^\/]*\/[^\/]*\).*/\1/p' | sed 's/\.git$//')
else
  echo -e "${RED}Error: Unrecognized GitHub URL format.${NC}" >&2
  exit 1
fi

# Trigger workflow
echo -e "Triggering workflow for repository: ${YELLOW}$REPO_INFO${NC}"
gh workflow run "CI/CD Pipeline" --repo "$REPO_INFO"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Successfully triggered CI/CD workflow${NC}"
  echo "Check the Actions tab on GitHub to monitor progress."
else
  echo -e "${RED}✗ Failed to trigger CI/CD workflow${NC}"
  exit 1
fi