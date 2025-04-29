/**
 * Code Metrics Service
 * 
 * This service tracks code metrics to ensure compliance with the working agreement:
 * - Function length <20 lines
 * - Cyclomatic complexity ≤3
 * - >90% test coverage
 */
import fs from 'fs';
import path from 'path';

export interface CodeMetrics {
  fileName: string;
  totalLines: number;
  functionCount: number;
  functionsOverSizeLimit: number;
  largestFunctionSize: number;
  averageFunctionSize: number;
  testCoverage?: number;
}

export interface ProjectMetrics {
  date: string;
  overallCompliance: number; // percentage
  filesAnalyzed: number;
  functionsAnalyzed: number;
  avgFunctionSize: number;
  functionsOverSizeLimit: number;
  largestFunction: {
    file: string;
    name: string;
    size: number;
  };
  metrics: CodeMetrics[];
}

export class MetricsService {
  private static instance: MetricsService;
  private metricsHistory: ProjectMetrics[] = [];
  
  private constructor() {}
  
  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }
  
  /**
   * Analyze a single file for code metrics
   */
  public analyzeFile(filePath: string): CodeMetrics {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      // Simple function detection
      const functionSizes = this.getFunctionSizes(content);
      
      const metrics: CodeMetrics = {
        fileName: path.basename(filePath),
        totalLines: lines.length,
        functionCount: functionSizes.length,
        functionsOverSizeLimit: functionSizes.filter(size => size > 20).length,
        largestFunctionSize: Math.max(...(functionSizes.length > 0 ? functionSizes : [0])),
        averageFunctionSize: functionSizes.length > 0 
          ? functionSizes.reduce((sum, size) => sum + size, 0) / functionSizes.length 
          : 0
      };
      
      return metrics;
    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error);
      return {
        fileName: path.basename(filePath),
        totalLines: 0,
        functionCount: 0,
        functionsOverSizeLimit: 0,
        largestFunctionSize: 0,
        averageFunctionSize: 0
      };
    }
  }
  
  /**
   * Get function sizes from file content
   */
  private getFunctionSizes(content: string): number[] {
    const functionSizes: number[] = [];
    
    // Match function/method declarations
    const methodRegex = /((private|public|protected)\s+async\s+)?(\w+\s*\([^)]*\)\s*{)|((private|public|protected)\s+)?(\w+\s*=\s*\([^)]*\)\s*=>\s*{)|(function\s+\w+\s*\([^)]*\)\s*{)/g;
    
    let match;
    let lastIndex = 0;
    
    while ((match = methodRegex.exec(content)) !== null) {
      const startIndex = match.index;
      const openBraces = 1;
      let endIndex = startIndex + match[0].length;
      
      // Find the closing brace, accounting for nested braces
      let braceCount = openBraces;
      for (let i = endIndex; i < content.length; i++) {
        if (content[i] === '{') braceCount++;
        if (content[i] === '}') braceCount--;
        
        if (braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
      
      const functionContent = content.substring(startIndex, endIndex);
      const functionLines = functionContent.split('\n');
      
      // Filter out blank and comment-only lines
      const validLines = functionLines.filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('*');
      });
      
      functionSizes.push(validLines.length);
      lastIndex = endIndex;
    }
    
    return functionSizes;
  }
  
  /**
   * Analyze a directory of TypeScript files
   */
  public analyzeDirectory(dirPath: string, includePattern = /\.ts$/): ProjectMetrics {
    const metrics: CodeMetrics[] = [];
    
    // Get all TypeScript files recursively
    const files = this.getFilesRecursively(dirPath, includePattern);
    
    // Analyze each file
    files.forEach(file => {
      metrics.push(this.analyzeFile(file));
    });
    
    // Calculate project-wide metrics
    const totalFunctions = metrics.reduce((sum, file) => sum + file.functionCount, 0);
    const totalLinesOfCode = metrics.reduce((sum, file) => sum + file.totalLines, 0);
    const functionsOverLimit = metrics.reduce((sum, file) => sum + file.functionsOverSizeLimit, 0);
    
    // Find largest function
    let largestFunction = { file: '', name: '', size: 0 };
    metrics.forEach(file => {
      if (file.largestFunctionSize > largestFunction.size) {
        largestFunction = {
          file: file.fileName,
          name: 'unknown', // Would need more parsing to get function name
          size: file.largestFunctionSize
        };
      }
    });
    
    const avgFunctionSize = totalFunctions > 0 
      ? metrics.reduce((sum, file) => sum + (file.averageFunctionSize * file.functionCount), 0) / totalFunctions 
      : 0;
    
    // Calculate compliance percentage
    const complianceScore = totalFunctions > 0 
      ? 100 * (1 - (functionsOverLimit / totalFunctions)) 
      : 100;
    
    const projectMetrics: ProjectMetrics = {
      date: new Date().toISOString(),
      overallCompliance: parseFloat(complianceScore.toFixed(2)),
      filesAnalyzed: files.length,
      functionsAnalyzed: totalFunctions,
      avgFunctionSize: parseFloat(avgFunctionSize.toFixed(2)),
      functionsOverSizeLimit: functionsOverLimit,
      largestFunction,
      metrics
    };
    
    // Store in history
    this.metricsHistory.push(projectMetrics);
    
    return projectMetrics;
  }
  
  /**
   * Get all files recursively from a directory
   */
  private getFilesRecursively(dir: string, pattern: RegExp): string[] {
    let results: string[] = [];
    
    try {
      const list = fs.readdirSync(dir);
      
      for (const file of list) {
        // Skip node_modules and other non-relevant directories
        if (['node_modules', '.git', 'dist', 'coverage'].includes(file)) {
          continue;
        }
        
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          results = results.concat(this.getFilesRecursively(filePath, pattern));
        } else if (pattern.test(filePath)) {
          results.push(filePath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
    }
    
    return results;
  }
  
  /**
   * Get the latest metrics
   */
  public getLatestMetrics(): ProjectMetrics | null {
    if (this.metricsHistory.length === 0) {
      return null;
    }
    return this.metricsHistory[this.metricsHistory.length - 1];
  }
  
  /**
   * Generate a dashboard report
   */
  public generateReport(): string {
    const latest = this.getLatestMetrics();
    if (!latest) {
      return 'No metrics available yet.';
    }
    
    const report = `
    =======================================
    CODE METRICS DASHBOARD - ${new Date().toLocaleDateString()}
    =======================================
    
    Overall Compliance: ${latest.overallCompliance}%
    Files Analyzed: ${latest.filesAnalyzed}
    Functions Analyzed: ${latest.functionsAnalyzed}
    Average Function Size: ${latest.avgFunctionSize} lines
    Functions over 20-line limit: ${latest.functionsOverSizeLimit}
    Largest Function: ${latest.largestFunction.size} lines in ${latest.largestFunction.file}
    
    ---- Files Needing Attention ----
    ${latest.metrics
      .filter(file => file.functionsOverSizeLimit > 0)
      .sort((a, b) => b.largestFunctionSize - a.largestFunctionSize)
      .slice(0, 10)
      .map(file => `${file.fileName} - ${file.functionsOverSizeLimit} functions over limit, largest: ${file.largestFunctionSize} lines`)
      .join('\n    ')}
    
    =======================================
    Working Agreement Targets:
    - Function length <20 lines
    - Cyclomatic complexity ≤3
    - >90% test coverage
    =======================================
    `;
    
    return report;
  }
}

export const metricsService = MetricsService.getInstance();
