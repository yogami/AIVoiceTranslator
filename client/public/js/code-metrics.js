/**
 * Code Metrics Collector
 * 
 * This utility collects and calculates various code quality metrics for the Benedictaitor project.
 * It follows the metrics outlined in the code quality cheatsheet and provides real-time updates.
 */

class CodeMetricsCollector {
  constructor() {
    this.metrics = {
      coverage: {
        overall: 0,
        line: 0,
        branch: 0,
        function: 0,
        byModule: {}
      },
      complexity: {
        average: 0,
        max: 0,
        functions: [],
        nesting: {
          max: 0,
          average: 0
        },
        functionLength: {
          average: 0,
          distribution: {
            "1-10": 0,
            "11-20": 0,
            "21-40": 0,
            "41+": 0
          }
        }
      },
      codeSmells: {
        total: 0,
        types: {}
      },
      duplication: {
        percentage: 0,
        instances: []
      },
      dependencies: {
        modules: [],
        circular: []
      },
      testResults: {
        unit: { total: 0, passed: 0, failed: 0 },
        integration: { total: 0, passed: 0, failed: 0 },
        e2e: { total: 0, passed: 0, failed: 0 }
      }
    };
  }

  /**
   * Update test coverage metrics
   * @param {Object} coverageData - Test coverage information
   */
  updateCoverageMetrics(coverageData) {
    this.metrics.coverage = {
      ...this.metrics.coverage,
      ...coverageData
    };
    this.updateDOM();
  }

  /**
   * Update code complexity metrics
   * @param {Object} complexityData - Code complexity information
   */
  updateComplexityMetrics(complexityData) {
    this.metrics.complexity = {
      ...this.metrics.complexity,
      ...complexityData
    };
    this.updateDOM();
  }

  /**
   * Update code smells metrics
   * @param {Object} smellsData - Code smells information
   */
  updateCodeSmellsMetrics(smellsData) {
    this.metrics.codeSmells = {
      ...this.metrics.codeSmells,
      ...smellsData
    };
    this.updateDOM();
  }

  /**
   * Update code duplication metrics
   * @param {Object} duplicationData - Code duplication information
   */
  updateDuplicationMetrics(duplicationData) {
    this.metrics.duplication = {
      ...this.metrics.duplication,
      ...duplicationData
    };
    this.updateDOM();
  }

  /**
   * Update dependencies metrics
   * @param {Object} dependenciesData - Dependencies information
   */
  updateDependenciesMetrics(dependenciesData) {
    this.metrics.dependencies = {
      ...this.metrics.dependencies,
      ...dependenciesData
    };
    this.updateDOM();
  }

  /**
   * Update test results metrics
   * @param {Object} testResultsData - Test results information
   */
  updateTestResultsMetrics(testResultsData) {
    this.metrics.testResults = {
      ...this.metrics.testResults,
      ...testResultsData
    };
    this.updateDOM();
  }

  /**
   * Update all DOM elements with current metrics
   */
  updateDOM() {
    // Update coverage metrics in DOM
    this.updateCoverageDOM();
    
    // Update complexity metrics in DOM
    this.updateComplexityDOM();
    
    // Update code smells in DOM
    this.updateCodeSmellsDOM();
    
    // Update test results in DOM
    this.updateTestResultsDOM();
    
    // Update summary metrics
    this.updateSummaryDOM();
  }

  /**
   * Update coverage-related DOM elements
   */
  updateCoverageDOM() {
    // Update overall coverage
    const overallCoverage = document.getElementById('overall-coverage-value');
    if (overallCoverage) {
      overallCoverage.textContent = `${this.metrics.coverage.overall}%`;
    }
    
    const overallCoverageBar = document.getElementById('overall-coverage-bar');
    if (overallCoverageBar) {
      overallCoverageBar.style.width = `${this.metrics.coverage.overall}%`;
      this.updateBarColor(overallCoverageBar, this.metrics.coverage.overall, 80, 60);
    }
    
    // Update line coverage
    const lineCoverage = document.getElementById('line-coverage-value');
    if (lineCoverage) {
      lineCoverage.textContent = `${this.metrics.coverage.line}%`;
    }
    
    const lineCoverageBar = document.getElementById('line-coverage-bar');
    if (lineCoverageBar) {
      lineCoverageBar.style.width = `${this.metrics.coverage.line}%`;
      this.updateBarColor(lineCoverageBar, this.metrics.coverage.line, 80, 60);
    }
    
    // Update branch coverage
    const branchCoverage = document.getElementById('branch-coverage-value');
    if (branchCoverage) {
      branchCoverage.textContent = `${this.metrics.coverage.branch}%`;
    }
    
    const branchCoverageBar = document.getElementById('branch-coverage-bar');
    if (branchCoverageBar) {
      branchCoverageBar.style.width = `${this.metrics.coverage.branch}%`;
      this.updateBarColor(branchCoverageBar, this.metrics.coverage.branch, 80, 60);
    }
    
    // Update function coverage
    const functionCoverage = document.getElementById('function-coverage-value');
    if (functionCoverage) {
      functionCoverage.textContent = `${this.metrics.coverage.function}%`;
    }
    
    const functionCoverageBar = document.getElementById('function-coverage-bar');
    if (functionCoverageBar) {
      functionCoverageBar.style.width = `${this.metrics.coverage.function}%`;
      this.updateBarColor(functionCoverageBar, this.metrics.coverage.function, 80, 60);
    }
    
    // Update module coverage table
    this.updateCoverageTable();
  }

  /**
   * Update complexity-related DOM elements
   */
  updateComplexityDOM() {
    // Update average cyclomatic complexity
    const avgComplexity = document.getElementById('avg-complexity-value');
    if (avgComplexity) {
      avgComplexity.textContent = this.metrics.complexity.average;
    }
    
    const avgComplexityBar = document.getElementById('avg-complexity-bar');
    if (avgComplexityBar) {
      // For complexity, we use a reverse scale (lower is better)
      const complexityPercentage = Math.min(100, (this.metrics.complexity.average / 10) * 100);
      avgComplexityBar.style.width = `${complexityPercentage}%`;
      // Reverse the thresholds for complexity (lower is better)
      this.updateBarColor(avgComplexityBar, this.metrics.complexity.average, 5, 7, true);
    }
    
    // Update max nesting depth
    const maxNesting = document.getElementById('max-nesting-value');
    if (maxNesting) {
      maxNesting.textContent = this.metrics.complexity.nesting.max;
    }
    
    const maxNestingBar = document.getElementById('max-nesting-bar');
    if (maxNestingBar) {
      // For nesting, we use a reverse scale (lower is better)
      const nestingPercentage = Math.min(100, (this.metrics.complexity.nesting.max / 5) * 100);
      maxNestingBar.style.width = `${nestingPercentage}%`;
      // Reverse the thresholds for nesting (lower is better)
      this.updateBarColor(maxNestingBar, this.metrics.complexity.nesting.max, 3, 4, true);
    }
    
    // Update average function length
    const avgFunctionLength = document.getElementById('avg-function-length-value');
    if (avgFunctionLength) {
      avgFunctionLength.textContent = `${this.metrics.complexity.functionLength.average} lines`;
    }
    
    const avgFunctionLengthBar = document.getElementById('avg-function-length-bar');
    if (avgFunctionLengthBar) {
      // For function length, we use a reverse scale (lower is better)
      const lengthPercentage = Math.min(100, (this.metrics.complexity.functionLength.average / 40) * 100);
      avgFunctionLengthBar.style.width = `${lengthPercentage}%`;
      // Reverse the thresholds for function length (lower is better)
      this.updateBarColor(avgFunctionLengthBar, this.metrics.complexity.functionLength.average, 20, 30, true);
    }
    
    // Update high complexity functions table
    this.updateComplexityTable();
  }

  /**
   * Update code smells-related DOM elements
   */
  updateCodeSmellsDOM() {
    // Update code smells table
    const codeSmellsTable = document.getElementById('code-smells-table');
    if (codeSmellsTable && codeSmellsTable.tBodies[0]) {
      const tbody = codeSmellsTable.tBodies[0];
      tbody.innerHTML = '';
      
      Object.entries(this.metrics.codeSmells.types).forEach(([type, data]) => {
        const row = document.createElement('tr');
        
        const typeCell = document.createElement('td');
        typeCell.textContent = type;
        row.appendChild(typeCell);
        
        const countCell = document.createElement('td');
        countCell.textContent = data.count;
        row.appendChild(countCell);
        
        const severityCell = document.createElement('td');
        const indicator = document.createElement('span');
        indicator.className = `status-indicator ${data.severity}`;
        severityCell.appendChild(indicator);
        severityCell.appendChild(document.createTextNode(this.capitalizeFirstLetter(data.severity)));
        row.appendChild(severityCell);
        
        tbody.appendChild(row);
      });
    }
  }

  /**
   * Update test results-related DOM elements
   */
  updateTestResultsDOM() {
    // Update test results table
    const testResultsTable = document.getElementById('test-results-table');
    if (testResultsTable && testResultsTable.tBodies[0]) {
      const tbody = testResultsTable.tBodies[0];
      tbody.innerHTML = '';
      
      // Unit tests row
      const unitRow = document.createElement('tr');
      
      const unitTypeCell = document.createElement('td');
      unitTypeCell.textContent = 'Unit Tests';
      unitRow.appendChild(unitTypeCell);
      
      const unitTotalCell = document.createElement('td');
      unitTotalCell.textContent = this.metrics.testResults.unit.total;
      unitRow.appendChild(unitTotalCell);
      
      const unitPassedCell = document.createElement('td');
      unitPassedCell.textContent = this.metrics.testResults.unit.passed;
      unitRow.appendChild(unitPassedCell);
      
      const unitFailedCell = document.createElement('td');
      unitFailedCell.textContent = this.metrics.testResults.unit.failed;
      unitRow.appendChild(unitFailedCell);
      
      tbody.appendChild(unitRow);
      
      // Integration tests row
      const integrationRow = document.createElement('tr');
      
      const integrationTypeCell = document.createElement('td');
      integrationTypeCell.textContent = 'Integration Tests';
      integrationRow.appendChild(integrationTypeCell);
      
      const integrationTotalCell = document.createElement('td');
      integrationTotalCell.textContent = this.metrics.testResults.integration.total;
      integrationRow.appendChild(integrationTotalCell);
      
      const integrationPassedCell = document.createElement('td');
      integrationPassedCell.textContent = this.metrics.testResults.integration.passed;
      integrationRow.appendChild(integrationPassedCell);
      
      const integrationFailedCell = document.createElement('td');
      integrationFailedCell.textContent = this.metrics.testResults.integration.failed;
      integrationRow.appendChild(integrationFailedCell);
      
      tbody.appendChild(integrationRow);
      
      // E2E tests row
      const e2eRow = document.createElement('tr');
      
      const e2eTypeCell = document.createElement('td');
      e2eTypeCell.textContent = 'E2E Tests';
      e2eRow.appendChild(e2eTypeCell);
      
      const e2eTotalCell = document.createElement('td');
      e2eTotalCell.textContent = this.metrics.testResults.e2e.total;
      e2eRow.appendChild(e2eTotalCell);
      
      const e2ePassedCell = document.createElement('td');
      e2ePassedCell.textContent = this.metrics.testResults.e2e.passed;
      e2eRow.appendChild(e2ePassedCell);
      
      const e2eFailedCell = document.createElement('td');
      e2eFailedCell.textContent = this.metrics.testResults.e2e.failed;
      e2eRow.appendChild(e2eFailedCell);
      
      tbody.appendChild(e2eRow);
    }
  }

  /**
   * Update summary metrics in DOM
   */
  updateSummaryDOM() {
    // Update coverage summary
    const coverageSummary = document.getElementById('coverage-summary');
    if (coverageSummary) {
      coverageSummary.textContent = `${this.metrics.coverage.overall}%`;
      this.updateSummaryColor(coverageSummary, this.metrics.coverage.overall, 80, 60);
    }
    
    // Update complexity summary
    const complexitySummary = document.getElementById('complexity-summary');
    if (complexitySummary) {
      complexitySummary.textContent = this.metrics.complexity.average;
      this.updateSummaryColor(complexitySummary, this.metrics.complexity.average, 5, 7, true);
    }
    
    // Update duplication summary
    const duplicationSummary = document.getElementById('duplication-summary');
    if (duplicationSummary) {
      duplicationSummary.textContent = this.metrics.duplication.instances.length;
      this.updateSummaryColor(duplicationSummary, this.metrics.duplication.instances.length, 3, 7, true);
    }
    
    // Update code smells summary
    const codeSmellsSummary = document.getElementById('code-smells-summary');
    if (codeSmellsSummary) {
      codeSmellsSummary.textContent = this.metrics.codeSmells.total;
      this.updateSummaryColor(codeSmellsSummary, this.metrics.codeSmells.total, 5, 10, true);
    }
  }

  /**
   * Update the coverage table with module-specific data
   */
  updateCoverageTable() {
    const coverageTable = document.getElementById('coverage-by-module-table');
    if (coverageTable && coverageTable.tBodies[0] && this.metrics.coverage.byModule) {
      const tbody = coverageTable.tBodies[0];
      tbody.innerHTML = '';
      
      Object.entries(this.metrics.coverage.byModule).forEach(([module, data]) => {
        const row = document.createElement('tr');
        
        const moduleCell = document.createElement('td');
        moduleCell.textContent = module;
        row.appendChild(moduleCell);
        
        const lineCell = document.createElement('td');
        lineCell.textContent = `${data.line}%`;
        row.appendChild(lineCell);
        
        const branchCell = document.createElement('td');
        branchCell.textContent = `${data.branch}%`;
        row.appendChild(branchCell);
        
        const functionCell = document.createElement('td');
        functionCell.textContent = `${data.function}%`;
        row.appendChild(functionCell);
        
        tbody.appendChild(row);
      });
    }
  }

  /**
   * Update the complexity table with high-complexity functions
   */
  updateComplexityTable() {
    const complexityTable = document.getElementById('high-complexity-table');
    if (complexityTable && complexityTable.tBodies[0] && this.metrics.complexity.functions) {
      const tbody = complexityTable.tBodies[0];
      tbody.innerHTML = '';
      
      // Sort functions by complexity descending
      const sortedFunctions = [...this.metrics.complexity.functions]
        .sort((a, b) => b.complexity - a.complexity)
        .slice(0, 5); // Show top 5 most complex functions
      
      sortedFunctions.forEach(func => {
        const row = document.createElement('tr');
        
        const nameCell = document.createElement('td');
        nameCell.textContent = func.name;
        row.appendChild(nameCell);
        
        const complexityCell = document.createElement('td');
        complexityCell.textContent = func.complexity;
        row.appendChild(complexityCell);
        
        const lengthCell = document.createElement('td');
        lengthCell.textContent = `${func.length} lines`;
        row.appendChild(lengthCell);
        
        const nestingCell = document.createElement('td');
        nestingCell.textContent = `${func.nesting} levels`;
        row.appendChild(nestingCell);
        
        tbody.appendChild(row);
      });
    }
  }

  /**
   * Update the color of a progress bar based on thresholds
   * @param {HTMLElement} element - The progress bar element
   * @param {number} value - The metric value
   * @param {number} goodThreshold - Threshold for "good" classification
   * @param {number} warningThreshold - Threshold for "warning" classification
   * @param {boolean} reverse - Whether lower values are better (default: false)
   */
  updateBarColor(element, value, goodThreshold, warningThreshold, reverse = false) {
    element.classList.remove('good', 'warning', 'poor');
    
    if (reverse) {
      // For metrics where lower is better
      if (value <= goodThreshold) {
        element.classList.add('good');
      } else if (value <= warningThreshold) {
        element.classList.add('warning');
      } else {
        element.classList.add('poor');
      }
    } else {
      // For metrics where higher is better
      if (value >= goodThreshold) {
        element.classList.add('good');
      } else if (value >= warningThreshold) {
        element.classList.add('warning');
      } else {
        element.classList.add('poor');
      }
    }
  }

  /**
   * Update the color of a summary number based on thresholds
   * @param {HTMLElement} element - The summary element
   * @param {number} value - The metric value
   * @param {number} goodThreshold - Threshold for "good" classification
   * @param {number} warningThreshold - Threshold for "warning" classification
   * @param {boolean} reverse - Whether lower values are better (default: false)
   */
  updateSummaryColor(element, value, goodThreshold, warningThreshold, reverse = false) {
    element.classList.remove('good-text', 'warning-text', 'poor-text');
    
    if (reverse) {
      // For metrics where lower is better
      if (value <= goodThreshold) {
        element.classList.add('good-text');
      } else if (value <= warningThreshold) {
        element.classList.add('warning-text');
      } else {
        element.classList.add('poor-text');
      }
    } else {
      // For metrics where higher is better
      if (value >= goodThreshold) {
        element.classList.add('good-text');
      } else if (value >= warningThreshold) {
        element.classList.add('warning-text');
      } else {
        element.classList.add('poor-text');
      }
    }
  }

  /**
   * Capitalize the first letter of a string
   * @param {string} string - The input string
   * @returns {string} The string with first letter capitalized
   */
  capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  /**
   * Load metrics data from API or run analysis in real-time
   * @param {string} projectRoot - The root path of the project to analyze
   * @returns {Promise<void>}
   */
  async loadMetrics(projectRoot = '.') {
    try {
      // In a real implementation, this would call the API endpoints
      // that gather metrics data from Jest, ESLint, etc.
      
      // For demo purposes, we'll use mock data
      this.updateCoverageMetrics({
        overall: 78,
        line: 82,
        branch: 69,
        function: 85,
        byModule: {
          'client/src/lib/websocket.ts': {
            line: 92,
            branch: 87,
            function: 95
          },
          'server/services/WebSocketServer.ts': {
            line: 85,
            branch: 78,
            function: 90
          },
          'server/services/TranslationService.ts': {
            line: 75,
            branch: 65,
            function: 82
          },
          'server/openai.ts': {
            line: 67,
            branch: 55,
            function: 80
          },
          'server/openai-streaming.ts': {
            line: 61,
            branch: 52,
            function: 72
          }
        }
      });
      
      this.updateComplexityMetrics({
        average: 4.2,
        max: 12,
        nesting: {
          max: 3,
          average: 2.1
        },
        functionLength: {
          average: 28,
          distribution: {
            "1-10": 24,
            "11-20": 28,
            "21-40": 18,
            "41+": 4
          }
        },
        functions: [
          {
            name: 'processStreamingAudio',
            complexity: 12,
            length: 45,
            nesting: 4
          },
          {
            name: 'WebSocketClient.connect',
            complexity: 8,
            length: 65,
            nesting: 3
          },
          {
            name: 'TranslationService.translateText',
            complexity: 7,
            length: 38,
            nesting: 3
          },
          {
            name: 'finalizeStreamingSession',
            complexity: 6,
            length: 32,
            nesting: 2
          },
          {
            name: 'processAudioChunks',
            complexity: 5,
            length: 27,
            nesting: 2
          }
        ]
      });
      
      this.updateCodeSmellsMetrics({
        total: 10,
        types: {
          'Magic Numbers': {
            count: 4,
            severity: 'warning'
          },
          'Duplicate Code': {
            count: 3,
            severity: 'good'
          },
          'Long Methods': {
            count: 2,
            severity: 'warning'
          },
          'Circular Dependencies': {
            count: 1,
            severity: 'poor'
          }
        }
      });
      
      this.updateDuplicationMetrics({
        percentage: 2.5,
        instances: [
          {
            file1: 'server/openai.ts',
            file2: 'server/openai-streaming.ts',
            lines: 12
          },
          {
            file1: 'client/src/lib/websocket.ts',
            file2: 'tests/unit/client/websocket.test.ts',
            lines: 8
          },
          {
            file1: 'server/routes.ts',
            file2: 'server/services/WebSocketServer.ts',
            lines: 5
          }
        ]
      });
      
      this.updateTestResultsMetrics({
        unit: {
          total: 42,
          passed: 40,
          failed: 2
        },
        integration: {
          total: 18,
          passed: 17,
          failed: 1
        },
        e2e: {
          total: 5,
          passed: 4,
          failed: 1
        }
      });
      
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  }
}

// Initialize the metrics collector when the page loads
document.addEventListener('DOMContentLoaded', async () => {
  const metricsCollector = new CodeMetricsCollector();
  await metricsCollector.loadMetrics();
  
  // Set up the tab functionality
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs
      document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
      });
      
      // Add active class to clicked tab
      tab.classList.add('active');
      
      // Hide all tab content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      // Show content for active tab
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });
});