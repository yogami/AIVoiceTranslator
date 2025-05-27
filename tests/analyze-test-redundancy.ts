/**
 * Test Redundancy Analysis Tool
 * 
 * Analyzes test files to identify:
 * - Tests that cover the same code branches
 * - Tests that test the same functionality
 * - Duplicate test logic with different names
 * - Overlapping coverage areas
 */

import fs from 'fs';
import path from 'path';

interface TestCase {
  filePath: string;
  testName: string;
  describe: string;
  imports: string[];
  mocks: string[];
  assertions: string[];
  testedFunctions: string[];
  codeLines: string[];
  lineNumbers: { start: number; end: number };
}

interface RedundancyReport {
  duplicateTests: TestCase[][];
  overlappingCoverage: {
    tests: TestCase[];
    sharedFunctions: string[];
    redundancyLevel: number;
  }[];
  recommendations: {
    action: 'merge' | 'remove' | 'refactor';
    tests: TestCase[];
    reason: string;
  }[];
}

class TestRedundancyAnalyzer {
  private testCases: TestCase[] = [];
  private testDirectory: string;

  constructor(testDirectory: string = 'tests/unit') {
    this.testDirectory = testDirectory;
  }

  async analyzeRedundancy(): Promise<RedundancyReport> {
    console.log('🔍 Analyzing test files for redundancy...');
    
    // Step 1: Parse all test files
    await this.parseAllTestFiles();
    
    // Step 2: Identify duplicate tests
    const duplicateTests = this.findDuplicateTests();
    
    // Step 3: Find overlapping coverage
    const overlappingCoverage = this.findOverlappingCoverage();
    
    // Step 4: Generate recommendations
    const recommendations = this.generateRecommendations(duplicateTests, overlappingCoverage);
    
    return {
      duplicateTests,
      overlappingCoverage,
      recommendations
    };
  }

  private async parseAllTestFiles(): Promise<void> {
    const testFiles = this.findTestFiles(this.testDirectory);
    
    for (const filePath of testFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const testCases = this.parseTestFile(filePath, content);
      this.testCases.push(...testCases);
    }
    
    console.log(`📊 Parsed ${this.testCases.length} test cases from ${testFiles.length} files`);
  }

  private findTestFiles(directory: string): string[] {
    const files: string[] = [];
    
    const traverse = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          traverse(fullPath);
        } else if (item.endsWith('.test.ts') || item.endsWith('.spec.ts')) {
          files.push(fullPath);
        }
      }
    };
    
    traverse(directory);
    return files;
  }

  private parseTestFile(filePath: string, content: string): TestCase[] {
    const testCases: TestCase[] = [];
    const lines = content.split('\n');
    
    try {
      // Extract imports using regex
      const imports = this.extractImports(content);
      
      // Extract mocks using regex
      const mocks = this.extractMocks(content);
      
      // Extract test cases using regex
      this.extractTestCases(content, lines, filePath, imports, mocks, testCases);
      
    } catch (error) {
      console.warn(`⚠️  Could not parse ${filePath}: ${error}`);
    }
    
    return testCases;
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+.*\s+from\s+['"`]([^'"`]+)['"`]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }

  private extractMocks(content: string): string[] {
    const mocks: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.includes('vi.mock(') || line.includes('jest.mock(')) {
        const match = line.match(/['"`]([^'"`]+)['"`]/);
        if (match) {
          mocks.push(match[1]);
        }
      }
    }
    
    return mocks;
  }

  private extractTestCases(content: string, lines: string[], filePath: string, imports: string[], mocks: string[], testCases: TestCase[]): void {
    let currentDescribe = '';
    let braceLevel = 0;
    let inDescribe = false;
    
    // Find describe blocks
    const describeRegex = /describe\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let describeMatch;
    
    while ((describeMatch = describeRegex.exec(content)) !== null) {
      currentDescribe = describeMatch[1];
    }
    
    // Find test cases
    const testRegex = /(it|test)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:async\s+)?\([^)]*\)\s*=>\s*\{/g;
    let testMatch;
    
    while ((testMatch = testRegex.exec(content)) !== null) {
      const testName = testMatch[2];
      const startIndex = testMatch.index;
      
      // Find the end of the test case by tracking braces
      const endIndex = this.findTestEnd(content, startIndex);
      
      const startLine = content.substring(0, startIndex).split('\n').length;
      const endLine = content.substring(0, endIndex).split('\n').length;
      
      const testCode = content.substring(startIndex, endIndex);
      const testLines = lines.slice(startLine - 1, endLine);
      
      testCases.push({
        filePath,
        testName,
        describe: currentDescribe,
        imports,
        mocks,
        assertions: this.extractAssertions(testCode),
        testedFunctions: this.extractTestedFunctions(testCode),
        codeLines: testLines,
        lineNumbers: { start: startLine, end: endLine }
      });
    }
  }

  private findTestEnd(content: string, startIndex: number): number {
    let braceCount = 0;
    let inTest = false;
    
    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];
      
      if (char === '{') {
        braceCount++;
        inTest = true;
      } else if (char === '}') {
        braceCount--;
        if (inTest && braceCount === 0) {
          return i + 1;
        }
      }
    }
    
    return content.length;
  }

  private extractAssertions(code: string): string[] {
    const assertions: string[] = [];
    const assertionPatterns = [
      /expect\([^)]+\)\.([a-zA-Z]+)/g,
      /assert\.[a-zA-Z]+/g,
      /\.toEqual\([^)]*\)/g,
      /\.toBe\([^)]*\)/g,
      /\.toHaveBeenCalled/g,
      /\.toHaveBeenCalledWith/g
    ];
    
    for (const pattern of assertionPatterns) {
      const matches = Array.from(code.matchAll(pattern));
      assertions.push(...matches.map(m => m[0]));
    }
    
    return [...new Set(assertions)];
  }

  private extractTestedFunctions(code: string): string[] {
    const functions: string[] = [];
    
    // Extract function calls that are likely being tested
    const patterns = [
      /(\w+)\s*\(/g,  // Function calls
      /\.(\w+)\s*\(/g, // Method calls
      /new\s+(\w+)/g // Constructor calls
    ];
    
    const excludeList = ['expect', 'describe', 'it', 'test', 'beforeEach', 'afterEach', 'vi', 'jest', 'console', 'JSON', 'Buffer', 'Set', 'Map', 'Array', 'Object'];
    
    for (const pattern of patterns) {
      const matches = Array.from(code.matchAll(pattern));
      for (const match of matches) {
        const funcName = match[1];
        if (funcName && !excludeList.includes(funcName) && funcName.length > 1) {
          functions.push(funcName);
        }
      }
    }
    
    return [...new Set(functions)];
  }

  private findDuplicateTests(): TestCase[][] {
    const duplicates: TestCase[][] = [];
    const processed = new Set<TestCase>();
    
    for (const testCase of this.testCases) {
      if (processed.has(testCase)) continue;
      
      const similar = this.testCases.filter(other => 
        other !== testCase && 
        !processed.has(other) &&
        this.calculateSimilarity(testCase, other) > 0.8
      );
      
      if (similar.length > 0) {
        const group = [testCase, ...similar];
        duplicates.push(group);
        group.forEach(tc => processed.add(tc));
      }
    }
    
    return duplicates;
  }

  private calculateSimilarity(test1: TestCase, test2: TestCase): number {
    let score = 0;
    
    // Test name similarity (30% weight)
    const nameSim = this.stringSimilarity(test1.testName, test2.testName);
    if (nameSim > 0.7) {
      score += 0.3;
    }
    
    // Tested functions similarity (40% weight)
    const functionOverlap = this.arrayOverlap(test1.testedFunctions, test2.testedFunctions);
    if (functionOverlap > 0.6) {
      score += 0.4;
    }
    
    // Assertions similarity (30% weight)
    const assertionOverlap = this.arrayOverlap(test1.assertions, test2.assertions);
    if (assertionOverlap > 0.5) {
      score += 0.3;
    }
    
    return score;
  }

  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private arrayOverlap(arr1: string[], arr2: string[]): number {
    if (arr1.length === 0 && arr2.length === 0) return 1;
    if (arr1.length === 0 || arr2.length === 0) return 0;
    
    const set1 = new Set(arr1);
    const set2 = new Set(arr2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private findOverlappingCoverage(): Array<{tests: TestCase[], sharedFunctions: string[], redundancyLevel: number}> {
    const overlapping: Array<{tests: TestCase[], sharedFunctions: string[], redundancyLevel: number}> = [];
    const processed = new Set<string>();
    
    for (const testCase of this.testCases) {
      const key = `${testCase.filePath}:${testCase.testName}`;
      if (processed.has(key)) continue;
      
      const overlappingTests = this.testCases.filter(other => {
        const otherKey = `${other.filePath}:${other.testName}`;
        return !processed.has(otherKey) && 
               other !== testCase &&
               this.arrayOverlap(testCase.testedFunctions, other.testedFunctions) > 0.4;
      });
      
      if (overlappingTests.length > 0) {
        const allTests = [testCase, ...overlappingTests];
        const sharedFunctions = this.findSharedFunctions(allTests);
        const redundancyLevel = this.calculateRedundancyLevel(allTests);
        
        overlapping.push({
          tests: allTests,
          sharedFunctions,
          redundancyLevel
        });
        
        allTests.forEach(tc => processed.add(`${tc.filePath}:${tc.testName}`));
      }
    }
    
    return overlapping.sort((a, b) => b.redundancyLevel - a.redundancyLevel);
  }

  private findSharedFunctions(tests: TestCase[]): string[] {
    if (tests.length === 0) return [];
    
    let shared = new Set(tests[0].testedFunctions);
    
    for (let i = 1; i < tests.length; i++) {
      const current = new Set(tests[i].testedFunctions);
      shared = new Set([...shared].filter(x => current.has(x)));
    }
    
    return Array.from(shared);
  }

  private calculateRedundancyLevel(tests: TestCase[]): number {
    if (tests.length < 2) return 0;
    
    const sharedFunctions = this.findSharedFunctions(tests);
    const totalUniqueFunctions = new Set(tests.flatMap(t => t.testedFunctions)).size;
    
    if (totalUniqueFunctions === 0) return 0;
    
    return (sharedFunctions.length / totalUniqueFunctions) * tests.length;
  }

  private generateRecommendations(
    duplicateTests: TestCase[][],
    overlappingCoverage: Array<{tests: TestCase[], sharedFunctions: string[], redundancyLevel: number}>
  ): Array<{action: 'merge' | 'remove' | 'refactor', tests: TestCase[], reason: string}> {
    const recommendations: Array<{action: 'merge' | 'remove' | 'refactor', tests: TestCase[], reason: string}> = [];
    
    // Handle duplicate tests
    for (const duplicateGroup of duplicateTests) {
      if (duplicateGroup.length > 1) {
        recommendations.push({
          action: 'remove',
          tests: duplicateGroup.slice(1), // Keep first, remove others
          reason: `These tests are ${(this.calculateSimilarity(duplicateGroup[0], duplicateGroup[1]) * 100).toFixed(1)}% similar and test the same functionality`
        });
      }
    }
    
    // Handle overlapping coverage
    for (const overlap of overlappingCoverage) {
      if (overlap.redundancyLevel > 2 && overlap.tests.length > 2) {
        recommendations.push({
          action: 'merge',
          tests: overlap.tests,
          reason: `These ${overlap.tests.length} tests have ${overlap.redundancyLevel.toFixed(1)} redundancy level, testing shared functions: ${overlap.sharedFunctions.join(', ')}`
        });
      } else if (overlap.redundancyLevel > 1.5) {
        recommendations.push({
          action: 'refactor',
          tests: overlap.tests,
          reason: `Consider refactoring these tests to reduce overlap in testing: ${overlap.sharedFunctions.join(', ')}`
        });
      }
    }
    
    return recommendations;
  }

  async generateReport(): Promise<void> {
    const report = await this.analyzeRedundancy();
    
    console.log('\n📋 TEST REDUNDANCY ANALYSIS REPORT');
    console.log('=====================================\n');
    
    console.log(`📊 SUMMARY:`);
    console.log(`  - Total test cases analyzed: ${this.testCases.length}`);
    console.log(`  - Duplicate test groups found: ${report.duplicateTests.length}`);
    console.log(`  - Overlapping coverage groups: ${report.overlappingCoverage.length}`);
    console.log(`  - Recommendations: ${report.recommendations.length}\n`);
    
    // Duplicate tests
    if (report.duplicateTests.length > 0) {
      console.log('🔄 DUPLICATE TESTS:');
      report.duplicateTests.forEach((group, index) => {
        console.log(`\n  Group ${index + 1}:`);
        group.forEach(test => {
          console.log(`    - ${test.filePath}:${test.lineNumbers.start}-${test.lineNumbers.end}`);
          console.log(`      "${test.describe} > ${test.testName}"`);
        });
      });
      console.log();
    }
    
    // Overlapping coverage
    if (report.overlappingCoverage.length > 0) {
      console.log('🔀 OVERLAPPING COVERAGE:');
      report.overlappingCoverage.slice(0, 5).forEach((overlap, index) => {
        console.log(`\n  ${index + 1}. Redundancy Level: ${overlap.redundancyLevel.toFixed(2)}`);
        console.log(`     Shared Functions: ${overlap.sharedFunctions.join(', ')}`);
        overlap.tests.forEach(test => {
          console.log(`     - ${path.basename(test.filePath)}: "${test.testName}"`);
        });
      });
      console.log();
    }
    
    // Recommendations
    console.log('💡 RECOMMENDATIONS:');
    report.recommendations.forEach((rec, index) => {
      console.log(`\n  ${index + 1}. ${rec.action.toUpperCase()}:`);
      console.log(`     Reason: ${rec.reason}`);
      rec.tests.forEach(test => {
        console.log(`     - ${path.basename(test.filePath)}: "${test.testName}"`);
      });
    });
    
    // Save detailed report
    const reportPath = 'tests/redundancy-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Run the analysis
if (require.main === module) {
  const analyzer = new TestRedundancyAnalyzer();
  analyzer.generateReport().catch(console.error);
}

export { TestRedundancyAnalyzer };
