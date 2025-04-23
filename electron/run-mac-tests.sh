#!/bin/bash

# Simple script to run the Benedictaitor tests on Mac without manual steps

echo "Benedictaitor Test Runner - Mac Setup"
echo "===================================="
echo ""

# Make sure we're in the right directory
cd "$(dirname "$0")"

# Check if we're on a Mac
if [[ "$(uname)" != "Darwin" ]]; then
  echo "❌ Error: This script is designed to run on macOS only."
  echo "If you're on Windows or Linux, please see the documentation for platform-specific instructions."
  exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  echo "⚠️ npm not found. Installing Node.js and npm..."
  
  # Try to use homebrew if available
  if command -v brew &> /dev/null; then
    brew install node
  else
    echo "❌ Error: Homebrew not found. Please install Node.js manually."
    echo "Visit https://nodejs.org/ to download and install it."
    exit 1
  fi
fi

# Install dependencies
echo "📦 Installing dependencies (this may take a minute)..."
npm install

# Build the app
echo "🔨 Building the Mac app..."
npm run package

# Check if app was created
if [[ -d "./dist/BenedictaitorTestRunner-darwin-x64/BenedictaitorTestRunner.app" ]]; then
  echo "✅ App built successfully!"
  echo ""
  echo "📱 To run the app, open:"
  echo "   $(pwd)/dist/BenedictaitorTestRunner-darwin-x64/BenedictaitorTestRunner.app"
  echo ""
  echo "🚀 Starting app automatically..."
  echo ""
  open "./dist/BenedictaitorTestRunner-darwin-x64/BenedictaitorTestRunner.app"
else
  echo "❌ Error: App build failed. Please check the output for errors."
  exit 1
fi