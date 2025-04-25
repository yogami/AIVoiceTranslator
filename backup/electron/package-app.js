/**
 * Package Script for Benedictaitor Test Runner
 * 
 * This script sets up and packages the Electron app into an executable.
 * It:
 * 1. Installs dependencies
 * 2. Copies tests from the main app
 * 3. Builds the package for the current OS
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Paths
const rootDir = path.resolve(__dirname);
const mainAppDir = path.resolve(__dirname, '..');
const testsDir = path.join(rootDir, 'tests');

// Ensure tests directory exists
if (!fs.existsSync(testsDir)) {
  fs.mkdirSync(testsDir, { recursive: true });
  console.log('Created tests directory');
}

// Function to copy test files
function copyTestFiles() {
  console.log('Copying test files...');
  
  // Get all test files from main app
  const testFiles = [
    '../run-websocket-tests.js',
    '../e2e-selenium-test.js',
    '../speech-test.js',
    '../run-audio-utils-tests.js'
  ];
  
  // Copy test files to electron/tests directory
  for (const file of testFiles) {
    const sourcePath = path.join(mainAppDir, file);
    const fileName = path.basename(file);
    const destPath = path.join(testsDir, fileName.replace(/^run-/, ''));
    
    // Only copy if source file exists
    if (fs.existsSync(sourcePath)) {
      console.log(`Copying ${sourcePath} to ${destPath}`);
      fs.copyFileSync(sourcePath, destPath);
    } else {
      console.log(`Warning: Source file not found: ${sourcePath}`);
    }
  }
  
  console.log('Test files copied');
}

// Function to install dependencies
function installDependencies() {
  console.log('Installing dependencies...');
  
  try {
    // Run npm install in the electron directory
    execSync('npm install', {
      cwd: rootDir,
      stdio: 'inherit'
    });
    
    console.log('Dependencies installed successfully');
  } catch (error) {
    console.error('Failed to install dependencies:');
    console.error(error.message);
    process.exit(1);
  }
}

// Function to build the package
function buildPackage() {
  console.log('Building package...');
  
  try {
    // Run the build script
    execSync('node build.js', {
      cwd: rootDir,
      stdio: 'inherit'
    });
    
    console.log('Package built successfully');
  } catch (error) {
    console.error('Failed to build package:');
    console.error(error.message);
    process.exit(1);
  }
}

// Main function
async function main() {
  console.log('Starting Benedictaitor Test Runner packaging process...');
  
  try {
    copyTestFiles();
    installDependencies();
    buildPackage();
    
    console.log('\nPackaging completed successfully!');
    console.log(`Executable can be found in: ${path.join(rootDir, 'dist')}`);
  } catch (error) {
    console.error('Packaging failed:');
    console.error(error);
    process.exit(1);
  }
}

// Execute main function
main();