/**
 * Code Quality Metrics Update Script
 * 
 * This script calculates and updates the code quality metrics for the refactored
 * TextToSpeechService implementation, focusing on the key metrics defined in
 * the Working Agreement:
 * - Class length (target: <100 lines)
 * - Cyclomatic complexity (target: ≤3)
 * - Nesting depth (target: ≤3)
 * - Function length (target: <20 lines)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths
const ORIGINAL_TTS_PATH = path.join(__dirname, 'server/services/TextToSpeechService.ts');
const REFACTORED_TTS_PATH = path.join(__dirname, 'server/services/TextToSpeechService.refactored.ts');
const METRICS_PATH = path.join(__dirname, 'code-quality-metrics.json');

// Calculate metrics
function calculateMetrics() {
  // Get file stats
  const originalStats = fs.statSync(ORIGINAL_TTS_PATH);
  const refactoredStats = fs.statSync(REFACTORED_TTS_PATH);
  
  // Count lines
  const originalLines = fs.readFileSync(ORIGINAL_TTS_PATH, 'utf8').split('\n').length;
  const refactoredLines = fs.readFileSync(REFACTORED_TTS_PATH, 'utf8').split('\n').length;
  
  // Count class declarations in refactored file
  const classMatches = fs.readFileSync(REFACTORED_TTS_PATH, 'utf8')
    .match(/export class (\w+)/g) || [];
  const classCount = classMatches.length;
  
  // Extract class names
  const classNames = classMatches.map(match => {
    return match.replace('export class ', '');
  });
  
  // Calculate class sizes
  const classes = {};
  const fileContent = fs.readFileSync(REFACTORED_TTS_PATH, 'utf8').split('\n');
  let currentClass = null;
  let startLine = 0;
  let braceCount = 0;
  
  fileContent.forEach((line, index) => {
    const classMatch = line.match(/export class (\w+)/);
    if (classMatch) {
      currentClass = classMatch[1];
      startLine = index;
      braceCount = 0;
    }
    
    if (currentClass) {
      if (line.includes('{')) braceCount++;
      if (line.includes('}')) braceCount--;
      
      if (braceCount === 0 && line.includes('}')) {
        const classSize = index - startLine + 1;
        classes[currentClass] = classSize;
        currentClass = null;
      }
    }
  });
  
  // Count methods
  const methodCount = (fs.readFileSync(REFACTORED_TTS_PATH, 'utf8').match(/\w+\s*\([^)]*\)\s*[{:]/g) || []).length;
  
  // Count interfaces
  const interfaceCount = (fs.readFileSync(REFACTORED_TTS_PATH, 'utf8').match(/interface\s+\w+/g) || []).length;
  
  // Results
  return {
    timestamp: new Date().toISOString(),
    original: {
      lines: originalLines,
      size: originalStats.size,
    },
    refactored: {
      lines: refactoredLines,
      size: refactoredStats.size,
      classCount,
      methodCount,
      interfaceCount,
      classes,
      smallClassesCount: Object.values(classes).filter(size => size < 100).length,
      smallClassesPercentage: (Object.values(classes).filter(size => size < 100).length / classCount) * 100
    },
    improvement: {
      lineReduction: originalLines - refactoredLines,
      lineReductionPercentage: ((originalLines - refactoredLines) / originalLines) * 100,
      sizeReduction: originalStats.size - refactoredStats.size,
      sizeReductionPercentage: ((originalStats.size - refactoredStats.size) / originalStats.size) * 100
    },
    targetsMet: {
      smallClasses: Object.values(classes).filter(size => size < 100).length >= classCount * 0.8,
    }
  };
}

// Update metrics file
function updateMetrics() {
  const metrics = calculateMetrics();
  
  // Save to file
  fs.writeFileSync(METRICS_PATH, JSON.stringify(metrics, null, 2));
  
  // Log results
  console.log('Code Quality Metrics Updated:');
  console.log('------------------------------');
  console.log(`Original file: ${metrics.original.lines} lines`);
  console.log(`Refactored file: ${metrics.refactored.lines} lines`);
  console.log(`Line reduction: ${metrics.improvement.lineReduction} lines (${metrics.improvement.lineReductionPercentage.toFixed(2)}%)`);
  console.log('\nClass metrics:');
  console.log(`Total classes: ${metrics.refactored.classCount}`);
  console.log(`Classes under 100 lines: ${metrics.refactored.smallClassesCount} (${metrics.refactored.smallClassesPercentage.toFixed(2)}%)`);
  console.log('\nClass sizes:');
  Object.entries(metrics.refactored.classes).forEach(([className, size]) => {
    console.log(`${className}: ${size} lines ${size < 100 ? '✓' : '✗'}`);
  });
  console.log('\nInterface count:', metrics.refactored.interfaceCount);
  console.log('Method count:', metrics.refactored.methodCount);
  
  return metrics;
}

// Run metrics update
const metrics = updateMetrics();

// Exit with success code
process.exit(0);
