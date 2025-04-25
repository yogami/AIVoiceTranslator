/**
 * Test runner for core modules with coverage report
 */
import { execSync } from 'child_process';

// Run unit tests for core functionality
try {
  console.log('Testing core modules with coverage reporting...');
  console.log('==============================================');
  
  // Execute Jest with coverage on our core files
  const output = execSync('npx jest --testMatch="**/__tests__/unit/lib/*.test.ts" --coverage', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      // Add any needed environment variables
      NODE_OPTIONS: '--experimental-vm-modules'
    }
  });
  
  console.log('\nCore module tests completed!');
} catch (error) {
  console.error('Error running tests:', error.message);
  process.exit(1);
}