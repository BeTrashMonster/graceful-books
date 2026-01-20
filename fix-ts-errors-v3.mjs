#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

console.log('Reverting enum type assertions...');

function findTSFiles(dir, files = []) {
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory() && !item.includes('node_modules') && item !== '.git') {
        findTSFiles(fullPath, files);
      } else if ((item.endsWith('.ts') || item.endsWith('.tsx')) && !item.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    } catch (e) {
      // Skip files we can't read
    }
  }
  return files;
}

const tsFiles = findTSFiles('src');
console.log(`Found ${tsFiles.length} TypeScript files`);

let totalFixed = 0;

for (const file of tsFiles) {
  let content = readFileSync(file, 'utf8');
  const original = content;

  // Revert enum type assertions
  content = content.replace(/ as CharityStatus/g, '');
  content = content.replace(/ as CharityCategory/g, '');
  content = content.replace(/ as RecurrenceFrequency/g, '');
  content = content.replace(/ as RecurrenceEndType/g, '');

  if (content !== original) {
    writeFileSync(file, content, 'utf8');
    totalFixed++;
  }
}

console.log(`Reverted enum assertions in ${totalFixed} files`);
