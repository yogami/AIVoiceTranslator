/**
 * Build script for Benedictaitor Test Runner
 * 
 * This script builds the Electron app into executable installers
 * for Windows, macOS, and Linux.
 */

const builder = require('electron-builder');
const path = require('path');
const fs = require('fs');

// Create assets directory if it doesn't exist
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Create a simple icon if it doesn't exist
const iconPath = path.join(assetsDir, 'icon.png');
if (!fs.existsSync(iconPath)) {
  // Generate a simple blue square icon (1x1 pixel blue PNG)
  const blueSquarePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  fs.writeFileSync(iconPath, blueSquarePng);
  console.log('Created placeholder icon');
}

// Build configuration
const buildConfig = {
  appId: 'com.benedictaitor.testrunner',
  productName: 'Benedictaitor Test Runner',
  directories: {
    output: path.join(__dirname, 'dist')
  },
  files: [
    'main.js',
    'preload.js',
    'index.html',
    'package.json',
    'assets/**/*'
  ],
  extraResources: [
    {
      from: 'tests',
      to: 'tests',
      filter: ['**/*']
    }
  ],
  win: {
    target: 'portable', // Can be changed to nsis for installer
    icon: 'assets/icon.png'
  },
  mac: {
    target: 'dmg',
    icon: 'assets/icon.png'
  },
  linux: {
    target: 'AppImage',
    icon: 'assets/icon.png'
  }
};

// Build for current platform
async function buildApp() {
  console.log('Building Benedictaitor Test Runner...');
  console.log(`Platform: ${process.platform}`);
  
  try {
    const result = await builder.build({
      targets: builder.Platform.current().createTarget(),
      config: buildConfig
    });
    
    console.log('Build completed successfully!');
    console.log('Output files:');
    for (const file of result) {
      console.log(`- ${file}`);
    }
  } catch (error) {
    console.error('Build failed:');
    console.error(error);
    process.exit(1);
  }
}

// Execute build
buildApp();