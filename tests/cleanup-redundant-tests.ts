/**
 * Automated Test Cleanup Tool
 * 
 * Uses the redundancy analysis to safely remove or merge redundant tests
 */

import fs from 'fs';
import path from 'path';
import { TestRedundancyAnalyzer } from './analyze-test-redundancy';

class TestCleanupTool {
  private analyzer: TestRedundancyAnalyzer;
  private dryRun: boolean;

  constructor(dryRun: boolean = true) {
    this.analyzer = new TestRedundancyAnalyzer();
    this.dryRun = dryRun;
  }

  async cleanupRedundantTests(): Promise<void> {
    console.log(`🧹 Starting test cleanup ${this.dryRun ? '(DRY RUN)' : '(LIVE)'}...`);
    
    const report = await this.analyzer.analyzeRedundancy();
    
    for (const recommendation of report.recommendations) {
      switch (recommendation.action) {
        case 'remove':
          await this.handleRemoveRecommendation(recommendation);
          break;
        case 'merge':
          await this.handleMergeRecommendation(recommendation);
          break;
        case 'refactor':
          console.log(`ℹ️  REFACTOR: ${recommendation.reason}`);
          recommendation.tests.forEach(test => {
            console.log(`   - ${test.filePath}: "${test.testName}"`);
          });
          break;
      }
    }
    
    if (this.dryRun) {
      console.log('\n✨ Dry run complete. Run with --live to apply changes.');
    } else {
      console.log('\n✅ Cleanup complete!');
    }
  }

  private async handleRemoveRecommendation(recommendation: any): Promise<void> {
    console.log(`🗑️  REMOVING redundant tests: ${recommendation.reason}`);
    
    for (const test of recommendation.tests) {
      console.log(`   - ${test.filePath}:${test.lineNumbers.start}-${test.lineNumbers.end}`);
      
      if (!this.dryRun) {
        await this.removeTestFromFile(test);
      }
    }
  }

  private async handleMergeRecommendation(recommendation: any): Promise<void> {
    console.log(`🔄 MERGE recommendation: ${recommendation.reason}`);
    recommendation.tests.forEach((test: any) => {
      console.log(`   - ${test.filePath}: "${test.testName}"`);
    });
    console.log('   (Manual merge required - tests are similar but not identical)');
  }

  private async removeTestFromFile(test: any): Promise<void> {
    const content = fs.readFileSync(test.filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Remove the test lines
    lines.splice(test.lineNumbers.start - 1, test.lineNumbers.end - test.lineNumbers.start + 1);
    
    const newContent = lines.join('\n');
    fs.writeFileSync(test.filePath, newContent);
    
    console.log(`   ✅ Removed from ${test.filePath}`);
  }
}

// Command line interface
const args = process.argv.slice(2);
const isLive = args.includes('--live');

const cleaner = new TestCleanupTool(!isLive);
cleaner.cleanupRedundantTests().catch(console.error);
