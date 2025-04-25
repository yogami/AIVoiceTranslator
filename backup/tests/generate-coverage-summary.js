/**
 * Generate a simple coverage summary for the test results
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to read the coverage summary
try {
  const coveragePath = path.join(__dirname, 'coverage', 'coverage-summary.json');
  
  if (!fs.existsSync(coveragePath)) {
    console.error('Coverage summary not found. Run Jest with --coverage first.');
    process.exit(1);
  }
  
  const coverageSummary = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  const total = coverageSummary.total;
  
  // Create a nicely formatted summary
  const summary = 
`COVERAGE SUMMARY:
-----------------
Statements : ${total.statements.pct.toFixed(2)}% (${total.statements.covered}/${total.statements.total})
Branches   : ${total.branches.pct.toFixed(2)}% (${total.branches.covered}/${total.branches.total})
Functions  : ${total.functions.pct.toFixed(2)}% (${total.functions.covered}/${total.functions.total})
Lines      : ${total.lines.pct.toFixed(2)}% (${total.lines.covered}/${total.lines.total})

COVERAGE BY FILE TYPE:
---------------------`;

  // Add file type summaries
  const fileTypes = [
    { pattern: /client\/src\/lib\//, name: 'Client Library Files' },
    { pattern: /client\/src\/components\//, name: 'React Components' },
    { pattern: /client\/src\/pages\//, name: 'React Pages' },
    { pattern: /server\//, name: 'Server Files' },
    { pattern: /shared\//, name: 'Shared Files' }
  ];
  
  let fileTypeSummary = '';
  
  for (const type of fileTypes) {
    const matchingFiles = Object.keys(coverageSummary)
      .filter(key => key !== 'total' && type.pattern.test(key));
    
    if (matchingFiles.length === 0) {
      fileTypeSummary += `\n${type.name}: No files found`;
      continue;
    }
    
    let statements = { total: 0, covered: 0 };
    let branches = { total: 0, covered: 0 };
    let functions = { total: 0, covered: 0 };
    let lines = { total: 0, covered: 0 };
    
    for (const file of matchingFiles) {
      const fileSummary = coverageSummary[file];
      statements.total += fileSummary.statements.total;
      statements.covered += fileSummary.statements.covered;
      branches.total += fileSummary.branches.total;
      branches.covered += fileSummary.branches.covered;
      functions.total += fileSummary.functions.total;
      functions.covered += fileSummary.functions.covered;
      lines.total += fileSummary.lines.total;
      lines.covered += fileSummary.lines.covered;
    }
    
    // Calculate percentages, handle division by zero
    const stmtPct = statements.total === 0 ? 0 : (statements.covered / statements.total) * 100;
    const branchPct = branches.total === 0 ? 0 : (branches.covered / branches.total) * 100;
    const funcPct = functions.total === 0 ? 0 : (functions.covered / functions.total) * 100;
    const linePct = lines.total === 0 ? 0 : (lines.covered / lines.total) * 100;
    
    fileTypeSummary += `\n${type.name}: ${stmtPct.toFixed(2)}% (${matchingFiles.length} files)`;
  }
  
  // Write the summary to a file
  fs.writeFileSync(
    path.join(__dirname, 'coverage', 'coverage-summary.txt'), 
    summary + fileTypeSummary
  );
  
  console.log(summary + fileTypeSummary);
  
} catch (error) {
  console.error('Error generating coverage summary:', error.message);
  process.exit(1);
}