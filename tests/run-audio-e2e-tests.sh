#!/bin/bash
# Audio End-to-End Test Runner Script
# This script sets up and runs the audio-based end-to-end Selenium tests
# It handles preparation of the audio environment and test execution

set -e  # Exit on any error

# Configuration
APP_URL=${APP_URL:-http://localhost:5000}
AUDIO_DIR=$(pwd)/tests/test-assets/audio
TEST_FILE=$(pwd)/tests/selenium/audio-e2e-test.js

# Print test configuration
echo "===== Audio E2E Test Configuration ====="
echo "App URL: $APP_URL"
echo "Audio assets directory: $AUDIO_DIR"
echo "Test file: $TEST_FILE"
echo "========================================"

# Check if in CI environment
if [ -n "$CI" ]; then
  echo "Running in CI environment"
  
  # Check for required software
  echo "Checking required software..."
  
  # Chrome browser
  if ! command -v google-chrome &> /dev/null; then
    echo "ERROR: Google Chrome is not installed"
    exit 1
  fi
  chrome_version=$(google-chrome --version)
  echo "Chrome version: $chrome_version"
  
  # ChromeDriver
  if ! command -v chromedriver &> /dev/null; then
    echo "ERROR: ChromeDriver is not installed"
    exit 1
  fi
  chromedriver_version=$(chromedriver --version)
  echo "ChromeDriver version: $chromedriver_version"
  
  # Audio support - check for ALSA
  if ! command -v aplay &> /dev/null; then
    echo "WARNING: ALSA audio tools not found, audio functionality may be limited"
  else
    echo "Audio support: Available (ALSA)"
    # List audio devices
    echo "Audio devices:"
    aplay -l || echo "No audio devices found or unable to list them"
  fi
  
  # Check for display server (Xvfb)
  if [ -z "$DISPLAY" ]; then
    echo "WARNING: DISPLAY environment variable not set, visual elements may not work"
  else
    echo "Display server: $DISPLAY"
  fi
fi

# Check if audio test files exist
echo "Checking for test audio files..."
mkdir -p "$AUDIO_DIR"

# Create short test audio if it doesn't exist (will be replaced later with real recordings)
if [ ! -f "$AUDIO_DIR/test-audio-english.mp3" ]; then
  echo "Creating placeholder test audio files..."
  
  # Skip creation in CI environment as it might not have ffmpeg
  if [ -z "$CI" ] && command -v ffmpeg &> /dev/null; then
    echo "Using ffmpeg to generate placeholder audio..."
    # Generate a silent 3-second audio file
    ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 3 -q:a 9 -acodec libmp3lame "$AUDIO_DIR/test-audio-english.mp3" -y
    echo "Placeholder audio created successfully"
  else
    echo "Unable to create placeholder audio. Tests will continue without audio playback."
    echo "This is expected in CI environment where audio files will be pre-created."
    touch "$AUDIO_DIR/test-audio-english.mp3"
  fi
fi

# Run the audio E2E tests
echo "Starting audio E2E tests..."
NODE_ENV=test npx mocha "$TEST_FILE" --timeout 60000

# Check exit status
if [ $? -eq 0 ]; then
  echo "✅ Audio E2E tests completed successfully!"
  exit 0
else
  echo "❌ Audio E2E tests failed"
  exit 1
fi