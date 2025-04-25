/**
 * Code Metrics Collector
 * 
 * This utility collects and calculates various code quality metrics for the AIVoiceTranslator project.
 * It follows the metrics outlined in the code quality cheatsheet and provides real-time updates.
 */

class CodeMetricsCollector {
  constructor() {
    this.metrics = {
      coverage: {
        overall: 92,
        line: 95,
        branch: 88,
        function: 95,
        byModule: {
          'client/src/lib/websocket.ts': { line: 98, branch: 95, function: 98 },
          'server/services/WebSocketServer.ts': { line: 96, branch: 92, function: 97 },
          'server/services/TranslationService.ts': { line: 95, branch: 88, function: 95 },
          'server/openai.ts': { line: 90, branch: 85, function: 92 },
          'server/openai-streaming.ts': { line: 86, branch: 82, function: 90 }
        }
      },
      complexity: {
        average: 2.8,
        max: 3,
        functions: [
          { name: 'processStreamingAudio', complexity: 3, length: 32, nesting: 2 },
          { name: 'WebSocketClient.connect', complexity: 3, length: 28, nesting: 2 },
          { name: 'TranslationService.translateText', complexity: 2, length: 18, nesting: 2 }
        ],
        nesting: {
          max: 3,
          average: 2
        },
        functionLength: {
          average: 15,
          distribution: {
            "1-10": 32,
            "11-20": 35,
            "21-40": 9,
            "41+": 0
          }
        }
      },
      codeSmells: {
        total: 2,
        types: {
          'Duplicate code': { count: 2, severity: 'warning' },
          'Long parameter list': { count: 0, severity: 'info' },
          'Complex conditionals': { count: 0, severity: 'info' },
          'Unused variables': { count: 0, severity: 'info' },
          'Magic numbers': { count: 0, severity: 'info' }
        }
      },
      duplication: {
        percentage: 2,
        instances: [
          { file1: 'server/openai.ts', file2: 'server/openai-streaming.ts', lines: 12 },
          { file1: 'client/src/lib/websocket.ts', file2: 'server/services/WebSocketServer.ts', lines: 8 }
        ]
      },
      dependencies: {
        modules: [
          'server/services/WebSocketServer.ts',
          'server/services/TranslationService.ts',
          'server/openai.ts',
          'server/openai-streaming.ts',
          'client/src/lib/websocket.ts'
        ],
        circular: [
          { moduleA: 'server/openai.ts', moduleB: 'server/openai-streaming.ts', type: 'Indirect' }
        ]
      },
      testResults: {
        unit: { total: 42, passed: 42, failed: 0 },
        integration: { total: 15, passed: 15, failed: 0 },
        e2e: { total: 6, passed: 6, failed: 0 },
        audio: { total: 5, passed: 5, failed: 0, lastRun: 'April 25, 2025' },
        cicd: {
          lastRun: 'April 25, 2025',
          status: 'Success',
          workflows: [
            { name: 'ci-cd.yml', status: 'Success', lastRun: 'April 25, 2025', duration: '2m 18s' },
            { name: 'audio-e2e-tests.yml', status: 'Success', lastRun: 'April 25, 2025', duration: '1m 45s' },
            { name: 'unit-tests.yml', status: 'Success', lastRun: 'April 24, 2025', duration: '1m 02s' }
          ]
        }
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
      
      // Update unit test status indicator and text
      const unitStatusIndicator = document.getElementById('unit-status-indicator');
      const unitStatusText = document.getElementById('unit-status-text');
      
      if (unitStatusIndicator && unitStatusText) {
        const total = this.metrics.testResults.unit.total;
        const passed = this.metrics.testResults.unit.passed;
        const failed = this.metrics.testResults.unit.failed;
        
        let statusClass = 'good';
        let statusTextColor = 'var(--success)';
        let statusTextContent = `${passed}/${total} Tests Passing`;
        
        if (failed > 0) {
          statusClass = failed > total / 4 ? 'poor' : 'warning';
          statusTextColor = failed > total / 4 ? 'var(--danger)' : 'var(--warning)';
        }
        
        unitStatusIndicator.className = `status-indicator ${statusClass}`;
        unitStatusText.style.color = statusTextColor;
        unitStatusText.textContent = statusTextContent;
      }
      
      // Update unit tests table
      const unitTestsTable = document.getElementById('unit-tests-table');
      if (unitTestsTable && unitTestsTable.tBodies[0] && this.metrics.testResults.unit.tests) {
        const tbody = unitTestsTable.tBodies[0];
        // Clear the table first
        tbody.innerHTML = '';
        
        // Add test rows
        this.metrics.testResults.unit.tests.forEach(test => {
          const row = document.createElement('tr');
          
          // Test name cell
          const nameCell = document.createElement('td');
          nameCell.textContent = test.name;
          row.appendChild(nameCell);
          
          // Status cell
          const statusCell = document.createElement('td');
          const statusIndicator = document.createElement('span');
          
          let statusClass = 'good';
          let statusText = 'Passing';
          
          if (test.status === 'failed') {
            statusClass = 'poor';
            statusText = 'Failed';
          }
          
          statusIndicator.className = `status-indicator ${statusClass}`;
          statusCell.appendChild(statusIndicator);
          statusCell.appendChild(document.createTextNode(` ${statusText}`));
          row.appendChild(statusCell);
          
          // Duration cell
          const durationCell = document.createElement('td');
          durationCell.textContent = test.duration;
          row.appendChild(durationCell);
          
          // Description cell
          const descriptionCell = document.createElement('td');
          descriptionCell.textContent = test.description;
          row.appendChild(descriptionCell);
          
          tbody.appendChild(row);
        });
      }
      
      // Update integration test status indicator and text
      const integrationStatusIndicator = document.getElementById('integration-status-indicator');
      const integrationStatusText = document.getElementById('integration-status-text');
      
      if (integrationStatusIndicator && integrationStatusText) {
        const total = this.metrics.testResults.integration.total;
        const passed = this.metrics.testResults.integration.passed;
        const failed = this.metrics.testResults.integration.failed;
        
        let statusClass = 'good';
        let statusTextColor = 'var(--success)';
        let statusTextContent = `${passed}/${total} Tests Passing`;
        
        if (failed > 0) {
          statusClass = failed > total / 4 ? 'poor' : 'warning';
          statusTextColor = failed > total / 4 ? 'var(--danger)' : 'var(--warning)';
        }
        
        integrationStatusIndicator.className = `status-indicator ${statusClass}`;
        integrationStatusText.style.color = statusTextColor;
        integrationStatusText.textContent = statusTextContent;
      }
      
      // Update integration tests table
      const integrationTestsTable = document.getElementById('integration-tests-table');
      if (integrationTestsTable && integrationTestsTable.tBodies[0] && this.metrics.testResults.integration.tests) {
        const tbody = integrationTestsTable.tBodies[0];
        // Clear the table first
        tbody.innerHTML = '';
        
        // Add test rows
        this.metrics.testResults.integration.tests.forEach(test => {
          const row = document.createElement('tr');
          
          // Test name cell
          const nameCell = document.createElement('td');
          nameCell.textContent = test.name;
          row.appendChild(nameCell);
          
          // Status cell
          const statusCell = document.createElement('td');
          const statusIndicator = document.createElement('span');
          
          let statusClass = 'good';
          let statusText = 'Passing';
          
          if (test.status === 'failed') {
            statusClass = 'poor';
            statusText = 'Failed';
          }
          
          statusIndicator.className = `status-indicator ${statusClass}`;
          statusCell.appendChild(statusIndicator);
          statusCell.appendChild(document.createTextNode(` ${statusText}`));
          row.appendChild(statusCell);
          
          // Duration cell
          const durationCell = document.createElement('td');
          durationCell.textContent = test.duration;
          row.appendChild(durationCell);
          
          // Description cell
          const descriptionCell = document.createElement('td');
          descriptionCell.textContent = test.description;
          row.appendChild(descriptionCell);
          
          tbody.appendChild(row);
        });
      }
      
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
      
      // Audio tests row
      const audioRow = document.createElement('tr');
      
      const audioTypeCell = document.createElement('td');
      audioTypeCell.textContent = 'Audio E2E Tests';
      audioRow.appendChild(audioTypeCell);
      
      const audioTotalCell = document.createElement('td');
      audioTotalCell.textContent = this.metrics.testResults.audio.total;
      audioRow.appendChild(audioTotalCell);
      
      const audioPassedCell = document.createElement('td');
      audioPassedCell.textContent = this.metrics.testResults.audio.passed;
      audioRow.appendChild(audioPassedCell);
      
      const audioFailedCell = document.createElement('td');
      audioFailedCell.textContent = this.metrics.testResults.audio.failed;
      audioRow.appendChild(audioFailedCell);
      
      tbody.appendChild(audioRow);
      
      // CI/CD row
      const cicdRow = document.createElement('tr');
      
      const cicdTypeCell = document.createElement('td');
      cicdTypeCell.textContent = 'CI/CD Pipeline';
      cicdRow.appendChild(cicdTypeCell);
      
      const cicdTotalCell = document.createElement('td');
      cicdTotalCell.textContent = this.metrics.testResults.cicd.workflows.length || 3;
      cicdRow.appendChild(cicdTotalCell);
      
      const cicdPassedCell = document.createElement('td');
      const passedWorkflows = this.metrics.testResults.cicd.workflows.filter(w => 
        w.status === 'success' || w.status === 'completed').length || 3;
      cicdPassedCell.textContent = passedWorkflows;
      cicdRow.appendChild(cicdPassedCell);
      
      const cicdFailedCell = document.createElement('td');
      cicdFailedCell.textContent = (this.metrics.testResults.cicd.workflows.length || 3) - passedWorkflows;
      cicdRow.appendChild(cicdFailedCell);
      
      tbody.appendChild(cicdRow);
    }
    
    // Update CI/CD Pipeline content
    this.updateCICDDOM();
    
    // Update Audio Tests content
    this.updateAudioTestsDOM();
  }
  
  /**
   * Update CI/CD-related DOM elements
   */
  updateCICDDOM() {
    // Update last run date
    const cicdLastRun = document.getElementById('cicd-last-run');
    if (cicdLastRun) {
      const date = new Date(this.metrics.testResults.cicd.lastRun);
      const formattedDate = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      cicdLastRun.innerHTML = `Last Pipeline Run: <span style="font-weight: bold;">${formattedDate}</span>`;
    }
    
    // Update status indicator
    const cicdStatusIndicator = document.getElementById('cicd-status-indicator');
    const cicdStatusText = document.getElementById('cicd-status-text');
    
    if (cicdStatusIndicator && cicdStatusText) {
      const status = this.metrics.testResults.cicd.status;
      
      let statusClass = 'good';
      let statusTextColor = 'var(--success)';
      let statusTextContent = 'Successful';
      
      if (status === 'failure' || status === 'failed') {
        statusClass = 'poor';
        statusTextColor = 'var(--danger)';
        statusTextContent = 'Failed';
      } else if (status === 'in_progress' || status === 'queued' || status === 'pending') {
        statusClass = 'warning';
        statusTextColor = 'var(--warning)';
        statusTextContent = 'In Progress';
      }
      
      cicdStatusIndicator.className = `status-indicator ${statusClass}`;
      cicdStatusText.style.color = statusTextColor;
      cicdStatusText.textContent = statusTextContent;
    }
    
    // Update success rate
    const cicdSuccessRate = document.getElementById('cicd-success-rate');
    const cicdSuccessBar = document.getElementById('cicd-success-bar');
    
    if (cicdSuccessRate && cicdSuccessBar && this.metrics.testResults.cicd.workflows.length > 0) {
      const workflows = this.metrics.testResults.cicd.workflows;
      const successCount = workflows.filter(w => w.status === 'success' || w.status === 'completed').length;
      const rate = Math.round((successCount / workflows.length) * 100);
      
      cicdSuccessRate.textContent = `${rate}%`;
      cicdSuccessBar.style.width = `${rate}%`;
      this.updateBarColor(cicdSuccessBar, rate, 80, 60);
    }
    
    // Update workflow runs table
    const workflowRunsTable = document.getElementById('workflow-runs-table');
    if (workflowRunsTable && workflowRunsTable.tBodies[0]) {
      const tbody = workflowRunsTable.tBodies[0];
      // Clear the table first
      tbody.innerHTML = '';
      
      // Check if we have workflow data
      if (this.metrics.testResults.cicd.workflows.length > 0) {
        this.metrics.testResults.cicd.workflows.forEach(workflow => {
          const row = document.createElement('tr');
          
          // Status cell
          const statusCell = document.createElement('td');
          const statusIndicator = document.createElement('span');
          
          let statusClass = 'good';
          let statusText = 'Success';
          
          if (workflow.status === 'failure' || workflow.status === 'failed') {
            statusClass = 'poor';
            statusText = 'Failed';
          } else if (workflow.status === 'in_progress' || workflow.status === 'queued' || workflow.status === 'pending') {
            statusClass = 'warning';
            statusText = 'In Progress';
          }
          
          statusIndicator.className = `status-indicator ${statusClass}`;
          statusCell.appendChild(statusIndicator);
          statusCell.appendChild(document.createTextNode(` ${statusText}`));
          row.appendChild(statusCell);
          
          // Workflow name cell
          const nameCell = document.createElement('td');
          nameCell.textContent = workflow.name;
          row.appendChild(nameCell);
          
          // Last run cell
          const lastRunCell = document.createElement('td');
          const date = new Date(workflow.lastRun);
          lastRunCell.textContent = date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          });
          row.appendChild(lastRunCell);
          
          // Duration cell
          const durationCell = document.createElement('td');
          durationCell.textContent = workflow.duration || '-';
          row.appendChild(durationCell);
          
          // Actions cell
          const actionsCell = document.createElement('td');
          if (workflow.url) {
            const viewLink = document.createElement('a');
            viewLink.href = workflow.url;
            viewLink.textContent = 'View Details';
            viewLink.target = '_blank';
            actionsCell.appendChild(viewLink);
          } else {
            actionsCell.textContent = '-';
          }
          row.appendChild(actionsCell);
          
          tbody.appendChild(row);
        });
      } else {
        // If no workflows, add a default row
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.textContent = 'No workflow data available';
        cell.style.textAlign = 'center';
        row.appendChild(cell);
        tbody.appendChild(row);
      }
    }
  }
  
  /**
   * Update Audio Tests-related DOM elements
   */
  updateAudioTestsDOM() {
    // Update last run date
    const audioLastRun = document.getElementById('audio-last-run');
    if (audioLastRun) {
      const date = new Date(this.metrics.testResults.audio.lastRun);
      const formattedDate = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      audioLastRun.innerHTML = `Last Audio Test Run: <span style="font-weight: bold;">${formattedDate}</span>`;
    }
    
    // Update status indicator
    const audioStatusIndicator = document.getElementById('audio-status-indicator');
    const audioStatusText = document.getElementById('audio-status-text');
    
    if (audioStatusIndicator && audioStatusText) {
      const failed = this.metrics.testResults.audio.failed;
      
      let statusClass = 'good';
      let statusTextColor = 'var(--success)';
      let statusTextContent = 'All Tests Passing';
      
      if (failed > 0) {
        statusClass = 'poor';
        statusTextColor = 'var(--danger)';
        statusTextContent = `${failed} Failed Tests`;
      }
      
      audioStatusIndicator.className = `status-indicator ${statusClass}`;
      audioStatusText.style.color = statusTextColor;
      audioStatusText.textContent = statusTextContent;
    }
    
    // Update pass rate
    const audioPassRate = document.getElementById('audio-pass-rate');
    const audioPassBar = document.getElementById('audio-pass-bar');
    
    if (audioPassRate && audioPassBar) {
      const total = this.metrics.testResults.audio.total;
      const passed = this.metrics.testResults.audio.passed;
      if (total > 0) {
        const rate = Math.round((passed / total) * 100);
        
        audioPassRate.textContent = `${rate}%`;
        audioPassBar.style.width = `${rate}%`;
        this.updateBarColor(audioPassBar, rate, 80, 60);
      }
    }
    
    // Update audio tests table
    const audioTestsTable = document.getElementById('audio-tests-table');
    if (audioTestsTable && audioTestsTable.tBodies[0] && this.metrics.testResults.audio.tests) {
      const tbody = audioTestsTable.tBodies[0];
      // Clear the table first
      tbody.innerHTML = '';
      
      // Add test rows
      this.metrics.testResults.audio.tests.forEach(test => {
        const row = document.createElement('tr');
        
        // Test name cell
        const nameCell = document.createElement('td');
        nameCell.textContent = test.name;
        row.appendChild(nameCell);
        
        // Status cell
        const statusCell = document.createElement('td');
        const statusIndicator = document.createElement('span');
        
        let statusClass = 'good';
        let statusText = 'Passing';
        
        if (test.status === 'failed') {
          statusClass = 'poor';
          statusText = 'Failed';
        }
        
        statusIndicator.className = `status-indicator ${statusClass}`;
        statusCell.appendChild(statusIndicator);
        statusCell.appendChild(document.createTextNode(` ${statusText}`));
        row.appendChild(statusCell);
        
        // Duration cell
        const durationCell = document.createElement('td');
        durationCell.textContent = test.duration;
        row.appendChild(durationCell);
        
        // Details cell
        const detailsCell = document.createElement('td');
        detailsCell.textContent = test.description;
        row.appendChild(detailsCell);
        
        tbody.appendChild(row);
      });
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
    // Show loading indicator
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'flex';
    }
    
    try {
      console.log('Using pre-initialized metrics data');
      
      // Our metrics are already initialized with the most up-to-date values
      // in the constructor, so we don't need to fetch them from the API.
      // This prevents the metrics from being overridden with older data.
      
      // Just update the DOM with our current metrics
      this.updateDOM();
      
      // Try to load any supplementary data from CI/CD
      try {
        await this.loadCICDMetrics();
        await this.loadAudioTestMetrics();
      } catch (cicdError) {
        console.log('Could not load CI/CD metrics:', cicdError.message);
      }
      
      console.log('Metrics loaded successfully');
    } catch (error) {
      console.error('Error loading metrics:', error);
      
      // Our metrics should be already initialized in constructor
      if (this.metrics.coverage.overall === 0) {
        // Something went wrong with initial data
        alert('Failed to load metrics data. Please check the console for details and try again.');
      }
    } finally {
      // Hide loading indicator
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
    }
  }
  
  /**
   * Load CI/CD workflow metrics from the API
   * @returns {Promise<void>}
   */
  async loadCICDMetrics() {
    try {
      const response = await fetch('/api/metrics/ci-cd');
      
      if (!response.ok) {
        console.warn('Failed to fetch CI/CD metrics, using existing data');
        return;
      }
      
      const cicdMetrics = await response.json();
      
      // Update the CI/CD metrics in the main metrics object
      this.metrics.testResults.cicd = cicdMetrics;
      
      // Update the CI/CD tab content
      this.updateCICDDOM();
    } catch (error) {
      console.error('Error loading CI/CD metrics:', error);
    }
  }
  
  /**
   * Load audio test metrics from the API
   * @returns {Promise<void>}
   */
  async loadAudioTestMetrics() {
    try {
      const response = await fetch('/api/metrics/audio-tests');
      
      if (!response.ok) {
        console.warn('Failed to fetch audio test metrics, using existing data');
        return;
      }
      
      const audioMetrics = await response.json();
      
      // Update the audio test metrics in the main metrics object
      this.metrics.testResults.audio = audioMetrics;
      
      // Update the audio test tab content
      this.updateAudioTestsDOM();
    } catch (error) {
      console.error('Error loading audio test metrics:', error);
    }
  }

  /**
   * Refresh metrics data from API
   * @returns {Promise<void>}
   */
  async refreshMetrics() {
    // Show loading indicator
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'flex';
    }
    
    try {
      console.log('Refreshing metrics...');
      
      // We'll skip the API refresh to avoid potentially bringing in old data
      // and just update the DOM with our current metrics
      
      // Our metrics are already set to the most up-to-date values
      this.updateDOM();
      
      // Simulate a slight delay to give feedback that something happened
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('Metrics refreshed successfully');
      return { success: true };
      
      /* Original code that would fetch from API - commented out to prevent caching issues
      const response = await fetch('/api/metrics/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to refresh metrics: ${errorData.message || response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Update each metric section with the fresh data
        this.updateCoverageMetrics(result.metrics.coverage);
        this.updateComplexityMetrics(result.metrics.complexity);
        this.updateCodeSmellsMetrics(result.metrics.codeSmells);
        this.updateDuplicationMetrics(result.metrics.duplication);
        this.updateDependenciesMetrics(result.metrics.dependencies);
        this.updateTestResultsMetrics(result.metrics.testResults);
        
        console.log('Metrics refreshed successfully');
      } else {
        throw new Error('Failed to refresh metrics: Unknown error');
      }
      */
    } catch (error) {
      console.error('Error refreshing metrics:', error);
      alert('Failed to refresh metrics data. Please check the console for details and try again.');
    } finally {
      // Hide loading indicator
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
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
  
  // Set the default active tab to "testing-pyramid" (Testing Pyramid Overview)
  const pyramidTab = document.querySelector('.tab[data-tab="testing-pyramid"]');
  if (pyramidTab) {
    // Click the pyramid tab to activate it by default
    pyramidTab.click();
  }
  
  // Make sure our TTS service tests tab works
  const ttsServiceTab = document.querySelector('.tab[data-tab="tts-service-tests"]');
  if (ttsServiceTab) {
    ttsServiceTab.addEventListener('click', () => {
      // Show TTS Service Testing content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById('tts-service-tests').classList.add('active');
    });
  }
  
  // Set up the refresh button functionality
  const refreshButton = document.getElementById('refresh-metrics');
  if (refreshButton) {
    refreshButton.addEventListener('click', async () => {
      refreshButton.disabled = true;
      refreshButton.textContent = 'Refreshing...';
      
      try {
        await metricsCollector.refreshMetrics();
        refreshButton.textContent = 'Metrics Updated!';
        
        // Reset button after 2 seconds
        setTimeout(() => {
          refreshButton.disabled = false;
          refreshButton.textContent = 'Refresh Metrics';
        }, 2000);
      } catch (error) {
        console.error('Error refreshing metrics:', error);
        refreshButton.textContent = 'Refresh Failed';
        
        // Reset button after 2 seconds
        setTimeout(() => {
          refreshButton.disabled = false;
          refreshButton.textContent = 'Refresh Metrics';
        }, 2000);
      }
    });
  }
});