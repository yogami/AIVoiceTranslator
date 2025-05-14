#!/usr/bin/env node

/**
 * Test Coverage Checker
 * 
 * This script analyzes test coverage reports from both Jest and Vitest 
 * and provides a consolidated report on test coverage.
 * 
 * It helps ensure we're meeting our coverage target of 90%.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Print a styled header
function printHeader(text) {
  const line = '='.repeat(text.length + 8);
  console.log(`\n${colors.cyan}${line}${colors.reset}`);
  console.log(`${colors.cyan}===${colors.reset} ${colors.white}${text}${colors.reset} ${colors.cyan}===${colors.reset}`);
  console.log(`${colors.cyan}${line}${colors.reset}\n`);
}

// Check if a file exists
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
}

// Read and parse Jest coverage report
function readJestCoverage() {
  const jestCoverageFile = path.resolve(process.cwd(), 'coverage/jest/coverage-summary.json');
  
  if (!fileExists(jestCoverageFile)) {
    console.log(`${colors.yellow}Warning: Jest coverage report not found at ${jestCoverageFile}${colors.reset}`);
    console.log(`${colors.blue}Run Jest tests with coverage first: node test-scripts/run-websocket-tests.js${colors.reset}`);
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(jestCoverageFile, 'utf8'));
  } catch (error) {
    console.error(`${colors.red}Error reading Jest coverage: ${error.message}${colors.reset}`);
    return null;
  }
}

// Read and parse Vitest coverage report
function readVitestCoverage() {
  const vitestCoverageFile = path.resolve(process.cwd(), 'coverage/vitest/coverage-summary.json');
  
  if (!fileExists(vitestCoverageFile)) {
    console.log(`${colors.yellow}Warning: Vitest coverage report not found at ${vitestCoverageFile}${colors.reset}`);
    console.log(`${colors.blue}Run Vitest tests with coverage first: node test-scripts/run-translation-tests.mjs${colors.reset}`);
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(vitestCoverageFile, 'utf8'));
  } catch (error) {
    console.error(`${colors.red}Error reading Vitest coverage: ${error.message}${colors.reset}`);
    return null;
  }
}

// Calculate combined coverage
function calculateCombinedCoverage(jestCoverage, vitestCoverage) {
  if (!jestCoverage && !vitestCoverage) {
    console.error(`${colors.red}Error: No coverage reports found. Run tests with coverage first.${colors.reset}`);
    process.exit(1);
  }
  
  // If one report is missing, return the other
  if (!jestCoverage) return vitestCoverage;
  if (!vitestCoverage) return jestCoverage;
  
  // Initialize combined totals
  const combined = {
    total: {
      lines: { total: 0, covered: 0, pct: 0 },
      statements: { total: 0, covered: 0, pct: 0 },
      functions: { total: 0, covered: 0, pct: 0 },
      branches: { total: 0, covered: 0, pct: 0 }
    }
  };
  
  // Combine metrics
  for (const metric of ['lines', 'statements', 'functions', 'branches']) {
    combined.total[metric].total = jestCoverage.total[metric].total + vitestCoverage.total[metric].total;
    combined.total[metric].covered = jestCoverage.total[metric].covered + vitestCoverage.total[metric].covered;
    combined.total[metric].pct = combined.total[metric].total > 0 
      ? (combined.total[metric].covered / combined.total[metric].total) * 100 
      : 0;
  }
  
  return combined;
}

// Format coverage percentage with color
function formatCoverage(pct, target = 90) {
  const color = pct >= target ? colors.green : (pct >= target * 0.8 ? colors.yellow : colors.red);
  return `${color}${pct.toFixed(2)}%${colors.reset}`;
}

// Main function
function checkCoverage() {
  printHeader("AIVoiceTranslator Coverage Checker");
  
  const jestCoverage = readJestCoverage();
  const vitestCoverage = readVitestCoverage();
  
  if (jestCoverage) {
    console.log(`${colors.blue}Jest Coverage:${colors.reset}`);
    console.log(`  Lines: ${formatCoverage(jestCoverage.total.lines.pct)}`);
    console.log(`  Statements: ${formatCoverage(jestCoverage.total.statements.pct)}`);
    console.log(`  Functions: ${formatCoverage(jestCoverage.total.functions.pct)}`);
    console.log(`  Branches: ${formatCoverage(jestCoverage.total.branches.pct)}`);
    console.log();
  }
  
  if (vitestCoverage) {
    console.log(`${colors.blue}Vitest Coverage:${colors.reset}`);
    console.log(`  Lines: ${formatCoverage(vitestCoverage.total.lines.pct)}`);
    console.log(`  Statements: ${formatCoverage(vitestCoverage.total.statements.pct)}`);
    console.log(`  Functions: ${formatCoverage(vitestCoverage.total.functions.pct)}`);
    console.log(`  Branches: ${formatCoverage(vitestCoverage.total.branches.pct)}`);
    console.log();
  }
  
  const combined = calculateCombinedCoverage(jestCoverage, vitestCoverage);
  
  printHeader("Combined Coverage");
  console.log(`${colors.white}Lines:${colors.reset}      ${formatCoverage(combined.total.lines.pct)} (${combined.total.lines.covered}/${combined.total.lines.total})`);
  console.log(`${colors.white}Statements:${colors.reset} ${formatCoverage(combined.total.statements.pct)} (${combined.total.statements.covered}/${combined.total.statements.total})`);
  console.log(`${colors.white}Functions:${colors.reset}  ${formatCoverage(combined.total.functions.pct)} (${combined.total.functions.covered}/${combined.total.functions.total})`);
  console.log(`${colors.white}Branches:${colors.reset}   ${formatCoverage(combined.total.branches.pct)} (${combined.total.branches.covered}/${combined.total.branches.total})`);
  console.log();
  
  // Check if we meet our targets
  const target = 90;
  const meetingTarget = 
    combined.total.lines.pct >= target &&
    combined.total.statements.pct >= target &&
    combined.total.functions.pct >= target &&
    combined.total.branches.pct >= 85; // Lower target for branches
  
  if (meetingTarget) {
    console.log(`${colors.green}✓ Coverage targets met! (≥90% for most metrics, ≥85% for branches)${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Coverage targets not met. Target is ≥90% for most metrics, ≥85% for branches.${colors.reset}`);
    console.log(`${colors.yellow}Tip: Run test-scripts/run-tests.sh to execute all tests with coverage.${colors.reset}`);
  }
}

// Run the main function
checkCoverage();