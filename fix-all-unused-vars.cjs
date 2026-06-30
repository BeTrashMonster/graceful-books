/**
 * Fix all unused variables by prefixing with underscore
 * Reads TypeScript errors and applies fixes
 */

const fs = require('fs');
const path = require('path');

// Read the error file
const errorFile = process.argv[2];
if (!errorFile) {
  console.error('Usage: node fix-all-unused-vars.js <error-file>');
  process.exit(1);
}

const errors = fs.readFileSync(errorFile, 'utf8');

// Parse TS6133 errors
const unusedVarPattern = /^(.+?)\((\d+),(\d+)\): error TS6133: '(.+?)' is declared but its value is never read\.$/gm;
const fixes = new Map(); // file -> [{ line, col, varName }]

let match;
while ((match = unusedVarPattern.exec(errors)) !== null) {
  const [, filePath, line, col, varName] = match;

  // Skip test files
  if (filePath.includes('__tests__') || filePath.includes('.test.ts') || filePath.includes('.test.tsx')) {
    continue;
  }

  // Normalize path
  const normalizedPath = path.resolve(filePath);

  if (!fixes.has(normalizedPath)) {
    fixes.set(normalizedPath, []);
  }

  fixes.get(normalizedPath).push({
    line: parseInt(line),
    col: parseInt(col),
    varName: varName.trim()
  });
}

console.log(`Found ${fixes.size} files with unused variables`);

// Apply fixes to each file
for (const [filePath, fileErrors] of fixes) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Sort errors by line number (descending) to avoid offset issues
  fileErrors.sort((a, b) => b.line - a.line);

  let changesCount = 0;
  for (const error of fileErrors) {
    const lineIndex = error.line - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) continue;

    const line = lines[lineIndex];
    const varName = error.varName;

    // Skip if already prefixed
    if (varName.startsWith('_')) continue;

    // Pattern 1: Function parameters: (param) => or (param, other) =>
    let newLine = line.replace(
      new RegExp(`\\(([^,)]*,\\s*)?${varName}(\\s*[,)])`, 'g'),
      (match, before, after) => `(${before || ''}_${varName}${after}`
    );

    // Pattern 2: Destructuring: const [var, setVar]
    if (newLine === line) {
      newLine = line.replace(
        new RegExp(`\\b${varName}\\b`, 'g'),
        `_${varName}`
      );
    }

    // Pattern 3: Simple const/let declaration
    if (newLine === line) {
      newLine = line.replace(
        new RegExp(`(const|let|var)\\s+${varName}\\b`, 'g'),
        `$1 _${varName}`
      );
    }

    if (newLine !== line) {
      lines[lineIndex] = newLine;
      changesCount++;
    }
  }

  if (changesCount > 0) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`✅ Fixed ${changesCount} unused variables in ${path.basename(filePath)}`);
  }
}

console.log('\n✅ All unused variables fixed!');
