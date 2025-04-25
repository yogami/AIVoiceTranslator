
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

// Get platform-specific command
const platform = os.platform();
let packageCommand;

switch (platform) {
  case 'win32':
    packageCommand = 'npx electron-packager . BenedictaitorTestRunner --platform=win32 --arch=x64 --overwrite --asar --out=dist --icon=assets/icon.ico';
    break;
  case 'darwin':
    packageCommand = 'npx electron-packager . BenedictaitorTestRunner --platform=darwin --arch=x64 --overwrite --asar --out=dist --icon=assets/icon.icns';
    break;
  case 'linux':
    packageCommand = 'npx electron-packager . BenedictaitorTestRunner --platform=linux --arch=x64 --overwrite --asar --out=dist --icon=assets/icon.png';
    break;
  default:
    console.error(`Unsupported platform: ${platform}`);
    process.exit(1);
}

console.log('Building single executable...');
console.log(`Command: ${packageCommand}`);

try {
  execSync(packageCommand, {
    cwd: __dirname,
    stdio: 'inherit'
  });
  
  console.log('Build completed successfully!');
  console.log('Executable can be found in the dist directory');
} catch (error) {
  console.error('Build failed:');
  console.error(error.message);
  process.exit(1);
}
  