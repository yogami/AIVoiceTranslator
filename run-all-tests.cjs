/**
 * Test Runner for Benedictaitor
 * 
 * This script runs all the tests for the Benedictaitor application and generates a coverage report.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Define test categories
const testCategories = [
  {
    name: 'Unit Tests',
    command: 'npx',
    args: ['jest', '--config=jest.config.cjs', '__tests__/unit', '--coverage'],
    weight: 0.4 // 40% of total
  },
  {
    name: 'Integration Tests',
    command: 'npx',
    args: ['jest', '--config=jest.config.cjs', '__tests__/integration', '--coverage'],
    weight: 0.3 // 30% of total
  },
  {
    name: 'Selenium UI Tests',
    command: 'node',
    args: ['__tests__/selenium/ui.test.js'],
    weight: 0.3 // 30% of total
  }
];

// Helper function to run a command and capture output
function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    
    const process = spawn(command, args);
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(data.toString());
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(data.toString());
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject({ stdout, stderr, code });
      }
    });
  });
}

// Function to parse Jest coverage output
function parseJestCoverage(output) {
  const lines = output.split('\n');
  const coverageLine = lines.find(line => line.includes('All files') && line.includes('%'));
  
  if (coverageLine) {
    const columns = coverageLine.trim().split('|').map(col => col.trim());
    // Find the column with the percentage (should be statements or lines)
    const coveragePercentage = columns.find(col => col.endsWith('%'));
    if (coveragePercentage) {
      return parseFloat(coveragePercentage.replace('%', ''));
    }
  }
  
  return 0; // Default if we can't parse
}

// Function to parse Selenium test results
function parseSeleniumResults(output) {
  // Look for the overall result line
  const resultLine = output.split('\n').find(line => line.includes('Overall Result:'));
  
  if (resultLine) {
    // Count the number of PASS results
    const passCount = (output.match(/PASS/g) || []).length;
    // There are 5 tests in the Selenium suite plus the overall result
    // So we have at most 6 PASS strings
    return (passCount / 6) * 100;
  }
  
  return 0; // Default if we can't parse
}

// Generate a coverage summary report
function generateCoverageSummary(results) {
  let totalCoverage = 0;
  let totalWeight = 0;
  
  // Calculate weighted coverage
  for (const result of results) {
    if (result.coverage !== null) {
      totalCoverage += result.coverage * result.weight;
      totalWeight += result.weight;
    }
  }
  
  // Normalize for any missing tests
  const normalizedCoverage = totalWeight > 0 ? totalCoverage / totalWeight : 0;
  
  // Create report
  let report = '\n\n';
  report += '======================================\n';
  report += '       BENEDICTAITOR TEST REPORT     \n';
  report += '======================================\n\n';
  
  for (const result of results) {
    const status = result.success ? 'PASSED' : 'FAILED';
    const coverage = result.coverage !== null ? `${result.coverage.toFixed(2)}%` : 'N/A';
    report += `${result.name}: ${status}, Coverage: ${coverage}\n`;
  }
  
  report += '\n';
  report += `Overall Coverage: ${normalizedCoverage.toFixed(2)}%\n`;
  report += '======================================\n';
  
  // Save to file
  fs.writeFileSync('test-summary.txt', report);
  
  return report;
}

// Main function to run all tests
async function runAllTests() {
  console.log('Starting Benedictaitor Test Suite...');
  
  const results = [];
  
  for (const category of testCategories) {
    try {
      console.log(`\n\n=== Running ${category.name} ===\n`);
      
      const { stdout } = await runCommand(category.command, category.args);
      
      let coverage = null;
      if (category.name.includes('Unit') || category.name.includes('Integration')) {
        coverage = parseJestCoverage(stdout);
      } else if (category.name.includes('Selenium')) {
        coverage = parseSeleniumResults(stdout);
      }
      
      results.push({
        name: category.name,
        success: true,
        coverage,
        weight: category.weight
      });
      
      console.log(`✅ ${category.name} completed successfully`);
      
    } catch (error) {
      console.error(`❌ ${category.name} failed with code ${error.code}`);
      
      results.push({
        name: category.name,
        success: false,
        coverage: 0,
        weight: category.weight
      });
    }
  }
  
  // Generate and display summary report
  const report = generateCoverageSummary(results);
  console.log(report);
  
  // Determine overall success
  const allPassed = results.every(result => result.success);
  
  return allPassed ? 0 : 1;
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests()
    .then(exitCode => {
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('Error running tests:', error);
      process.exit(1);
    });
}

module.exports = {
  runAllTests
};