#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

console.log('Starting batch TypeScript error fixes...');

// Recursively find all .test.ts files
function findTestFiles(dir, files = []) {
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    if (stat.isDirectory() && !item.includes('node_modules')) {
      findTestFiles(fullPath, files);
    } else if (item.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

const testFiles = findTestFiles('src');
console.log(`Found ${testFiles.length} test files`);

let totalFixed = 0;

for (const file of testFiles) {
  let content = readFileSync(file, 'utf8');
  const original = content;

  // Fix 1: Cast db mock methods as any
  content = content.replace(/(\s+)(db\.\w+\.(where|add|get|put|update|delete|toArray))\.mock(ReturnValue|ResolvedValue|Implementation)/g, '$1($2 as any).mock$4');

  // Fix 2: DatabaseResult.data access patterns
  content = content.replace(/(\s+)expect\(result\.data\?\./g, '$1expect((result as any).data.');
  content = content.replace(/(\s+)expect\(result\.error\?\./g, '$1expect((result as any).error.');
  content = content.replace(/(\s+)expect\(result\.data\)/g, '$1expect((result as any).data)');
  content = content.replace(/(\s+)expect\(result\.error\)/g, '$1expect((result as any).error)');

  // Fix 3: result.data used in function calls
  content = content.replace(/db\.\w+\.(get|put|update|delete)\(result\.data!/g, 'db.$1.((result as any).data');

  // Fix 4: Fix array access syntax errors
  content = content.replace(/\.data\.\[/g, '.data[');
  content = content.replace(/\.error\.\[/g, '.error[');

  // Fix 5: EncryptionService casts
  content = content.replace(/(encryptionService:\s*mockEncryptionService)(,|\s*\})/g, '$1 as any$2');

  // Fix 6: Remove unused imports - Bill, DatabaseResult in test files
  content = content.replace(/import type \{ Bill, /g, 'import type { ');
  content = content.replace(/, Bill \}/g, ' }');
  content = content.replace(/import type \{ DatabaseResult,?/g, 'import type {');
  content = content.replace(/, DatabaseResult \}/g, ' }');
  content = content.replace(/import type \{ \}/g, ''); // Remove empty imports

  if (content !== original) {
    writeFileSync(file, content, 'utf8');
    totalFixed++;
  }
}

console.log(`Fixed ${totalFixed} test files`);
console.log('Batch fixes complete!');
