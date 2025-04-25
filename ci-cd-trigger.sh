#!/bin/bash
# CI/CD Trigger Script for AIVoiceTranslator
# This script triggers the GitHub Actions workflow from Replit

# Requires GITHUB_TOKEN environment variable to be set

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: GITHUB_TOKEN environment variable is not set."
  echo "Please set it to a valid GitHub token with the 'repo' scope."
  exit 1
fi

# GitHub repository information
REPO_OWNER="your-github-username"
REPO_NAME="AIVoiceTranslator"
EVENT_TYPE="run-tests"

# Current git commit SHA for reference
COMMIT_SHA=$(git rev-parse HEAD)
COMMIT_MESSAGE=$(git log -1 --pretty=format:"%s")

# API endpoint for repository dispatch
API_URL="https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/dispatches"

# Callback URL for receiving test results (optional - could be a webhook endpoint)
CALLBACK_URL="https://your-callback-url.example.com/webhook"

echo "===== CI/CD Pipeline Trigger ====="
echo "Repository: $REPO_OWNER/$REPO_NAME"
echo "Event Type: $EVENT_TYPE"
echo "Commit: $COMMIT_SHA"
echo "Commit Message: $COMMIT_MESSAGE"
echo "=================================="

# Create JSON payload
PAYLOAD=$(cat << EOF
{
  "event_type": "$EVENT_TYPE",
  "client_payload": {
    "commit_sha": "$COMMIT_SHA",
    "commit_message": "$COMMIT_MESSAGE",
    "callback_url": "$CALLBACK_URL",
    "triggered_from": "replit",
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  }
}
EOF
)

# Trigger the repository dispatch event
echo "Triggering GitHub Actions workflow..."
RESPONSE=$(curl -s -X POST $API_URL \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d "$PAYLOAD")

# Check for errors
if [[ $RESPONSE == *"message"* ]]; then
  echo "Error: $RESPONSE"
  exit 1
else
  echo "✅ GitHub Actions workflow triggered successfully!"
  echo "Check your GitHub repository for the workflow run status."
fi