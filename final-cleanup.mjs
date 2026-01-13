import fs from 'fs';

// Fix remaining test issues
const fixes = [
  {
    file: 'src/store/disc Profiles.test.ts',
    patterns: [
      // Add type guards before data access in function calls
      { find: /(\n\s+)(const \w+ = await \w+DISCProfile\([^)]+\);)\n\s+(const result = await \w+\(\w+\.data\.id)/g,
        replace: '$1$2$1if (!$2.match(/const (\\w+)/)[1].success) throw new Error(\'Operation failed\');$1$3' },
      // Mark unused variables with underscore
      { find: /const second = /g, replace: 'const _second = ' },
    ]
  },
  {
    file: 'src/store/categories.test.ts',
    patterns: [
      // Fix array access
      { find: /result\.data\[0\]\.children/g, replace: 'result.data[0]?.children' },
    ]
  },
  {
    file: 'src/store/charities.test.ts',
    patterns: [
      // Already fixed
    ]
  },
];

// Apply simple pattern fixes
fixes.forEach(({ file, patterns }) => {
  if (!patterns || patterns.length === 0) return;

  try {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    patterns.forEach(({ find, replace }) => {
      const before = content;
      content = content.replace(find, replace);
      if (content !== before) {
        changed = true;
        console.log(`✓ Applied fix in ${file}`);
      }
    });

    if (changed) {
      fs.writeFileSync(file, content, 'utf8');
    }
  } catch (error) {
    // File might not exist or already fixed
  }
});

// Manual fixes for disc profiles - add type guards
const discFile = 'src/store/discProfiles.test.ts';
try {
  let content = fs.readFileSync(discFile, 'utf8');

  // Pattern: find lines with created.data.id and add guard before them
  const lines = content.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if this line uses .data.id without a guard
    if (line.includes('.data.id') && i > 0 && !lines[i-1].includes('if (')) {
      // Look back for the variable assignment
      let j = i - 1;
      while (j >= 0 && !lines[j].includes('const created =') && !lines[j].includes('const first =') && !lines[j].includes('const second =')) {
        j--;
      }

      if (j >= 0) {
        const varMatch = lines[j].match(/const (\\w+) =/);
        if (varMatch) {
          const varName = varMatch[1];
          const indent = line.match(/^\\s*/)[0];
          result.push(`${indent}if (!${varName}.success) throw new Error('Profile creation failed');`);
        }
      }
    }

    result.push(line);
    i++;
  }

  fs.writeFileSync(discFile, result.join('\n'), 'utf8');
  console.log(`✓ Applied comprehensive fixes to ${discFile}`);
} catch (error) {
  console.error(`Error fixing ${discFile}:`, error.message);
}

console.log('\n✅ Cleanup complete!');
