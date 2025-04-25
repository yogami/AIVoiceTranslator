#!/bin/bash

# Colors for better output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Benedictaitor CI/CD Pipeline${NC}"
echo -e "${YELLOW}===========================${NC}"

# Check if GitHub token is set
if [ -z "$GITHUB_TOKEN" ]; then
  echo -e "${RED}Error: GITHUB_TOKEN is not set.${NC}"
  echo -e "Please set the GITHUB_TOKEN secret in Replit."
  echo -e "See the README.md for instructions."
  exit 1
fi

# GitHub repository information
# Replace these with your actual GitHub username and repository name
GITHUB_USERNAME="your-username"
REPO_NAME="benedictaitor"

# Callback URL (for future use with webhook responses)
CALLBACK_URL="https://example.com/webhook"

# First, commit and push changes to GitHub
echo -e "\n${YELLOW}Pushing code changes to GitHub...${NC}"

# Configure git if not already done
if ! git config --get user.email > /dev/null; then
  git config --global user.email "ci-bot@example.com"
  git config --global user.name "CI Bot"
fi

# Add all files, commit, and push
git add .
git commit -m "Automated push from Replit [$(date)]"
git push origin main

if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to push to GitHub.${NC}"
  echo -e "Please check your repository settings and try again."
  exit 1
fi

echo -e "${GREEN}Successfully pushed to GitHub!${NC}"

# Trigger GitHub Actions workflow
echo -e "\n${YELLOW}Triggering CI/CD pipeline...${NC}"

# Construct API request to trigger the workflow
curl -X POST "https://api.github.com/repos/$GITHUB_USERNAME/$REPO_NAME/dispatches" \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token $GITHUB_TOKEN" \
  -d "{\"event_type\": \"run-tests\", \"client_payload\": {\"callback_url\": \"$CALLBACK_URL\"}}"

if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to trigger GitHub Actions workflow.${NC}"
  echo -e "Please check your GitHub token and repository settings."
  exit 1
fi

echo -e "${GREEN}Successfully triggered CI/CD pipeline!${NC}"
echo -e "\n${YELLOW}View results at:${NC} https://github.com/$GITHUB_USERNAME/$REPO_NAME/actions"
echo -e "Tests are now running on GitHub. Check the link above for results."