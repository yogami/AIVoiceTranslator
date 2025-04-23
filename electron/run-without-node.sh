#!/bin/bash

# Simple script to run the Benedictaitor tests without requiring Node.js installation
# This script downloads a portable Node.js binary and uses it directly

echo "Benedictaitor Test Runner - No Installation Required"
echo "=================================================="
echo ""

# Make sure we're in the right directory
cd "$(dirname "$0")"

# Create a temp directory for Node.js
TMP_DIR="./tmp_nodejs"
mkdir -p "$TMP_DIR"

# Check if we're on a Mac
if [[ "$(uname)" != "Darwin" ]]; then
  echo "❌ Error: This script is designed to run on macOS only."
  echo "If you're on Windows or Linux, please see the documentation for platform-specific instructions."
  exit 1
fi

# Function to download and extract Node.js
function setup_nodejs() {
  echo "⚙️ Setting up portable Node.js (no installation required)..."
  
  # Download Node.js binary for macOS
  NODE_VERSION="18.18.0"
  NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-x64.tar.gz"
  NODE_TAR="$TMP_DIR/node.tar.gz"
  
  echo "📥 Downloading Node.js ${NODE_VERSION}..."
  curl -# -L "$NODE_URL" -o "$NODE_TAR"
  
  echo "📦 Extracting Node.js..."
  tar -xzf "$NODE_TAR" -C "$TMP_DIR" --strip-components=1
  
  # Clean up
  rm "$NODE_TAR"
  
  echo "✅ Node.js setup complete!"
}

# Check if Node.js is already set up
if [[ ! -f "$TMP_DIR/bin/node" ]]; then
  setup_nodejs
fi

# Add Node.js to PATH
export PATH="$PWD/$TMP_DIR/bin:$PATH"

# Verify Node.js works
echo "🔍 Verifying Node.js installation..."
if ! command -v node &> /dev/null; then
  echo "❌ Error: Node.js setup failed. Please try again or install Node.js manually."
  exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Using Node.js $NODE_VERSION"

# Install dependencies
echo "📦 Installing app dependencies (this may take a minute)..."
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