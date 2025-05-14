#!/usr/bin/env node

/**
 * Test Coverage Checker
 * 
 * This script analyzes test coverage reports and provides
 * a consolidated report on test coverage.
 * 
 * It helps ensure we're meeting our coverage target of 90%.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Read coverage report
function readCoverageReport() {
  const coverageFile = path.resolve(process.cwd(), 'coverage/coverage-summary.json');
  
  if (!fileExists(coverageFile)) {
    console.log(`${colors.yellow}Warning: Coverage report not found at ${coverageFile}${colors.reset}`);
    console.log(`${colors.blue}Run tests with coverage first: ./test-scripts/run-tests.sh${colors.reset}`);
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
  } catch (error) {
    console.error(`${colors.red}Error reading coverage report: ${error.message}${colors.reset}`);
    return null;
  }
}

// Calculate coverage percentages
function validateCoverage(coverage) {
  if (!coverage) {
    console.error(`${colors.red}Error: No coverage report found. Run tests with coverage first.${colors.reset}`);
    process.exit(1);
  }
  
  return coverage;
}

// Format coverage percentage with color
function formatCoverage(pct, target = 90) {
  const color = pct >= target ? colors.green : (pct >= target * 0.8 ? colors.yellow : colors.red);
  return `${color}${pct.toFixed(2)}%${colors.reset}`;
}

// Main function
function checkCoverage() {
  printHeader("AIVoiceTranslator Coverage Checker");
  
  const coverage = readCoverageReport();
  const validCoverage = validateCoverage(coverage);
  
  printHeader("Test Coverage");
  console.log(`${colors.white}Lines:${colors.reset}      ${formatCoverage(validCoverage.total.lines.pct)} (${validCoverage.total.lines.covered}/${validCoverage.total.lines.total})`);
  console.log(`${colors.white}Statements:${colors.reset} ${formatCoverage(validCoverage.total.statements.pct)} (${validCoverage.total.statements.covered}/${validCoverage.total.statements.total})`);
  console.log(`${colors.white}Functions:${colors.reset}  ${formatCoverage(validCoverage.total.functions.pct)} (${validCoverage.total.functions.covered}/${validCoverage.total.functions.total})`);
  console.log(`${colors.white}Branches:${colors.reset}   ${formatCoverage(validCoverage.total.branches.pct)} (${validCoverage.total.branches.covered}/${validCoverage.total.branches.total})`);
  console.log();
  
  // Check if we meet our targets
  const target = 90;
  const meetingTarget = 
    validCoverage.total.lines.pct >= target &&
    validCoverage.total.statements.pct >= target &&
    validCoverage.total.functions.pct >= target &&
    validCoverage.total.branches.pct >= 85; // Lower target for branches
  
  if (meetingTarget) {
    console.log(`${colors.green}✓ Coverage targets met! (≥90% for most metrics, ≥85% for branches)${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Coverage targets not met. Target is ≥90% for most metrics, ≥85% for branches.${colors.reset}`);
    console.log(`${colors.yellow}Tip: Run test-scripts/run-tests.sh to execute all tests with coverage.${colors.reset}`);
  }
}

// Run the main function
checkCoverage();