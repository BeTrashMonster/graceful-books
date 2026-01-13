const fs = require('fs');

function fixDatabaseResultPatterns(filepath) {
  console.log(`\nProcessing ${filepath}...`);
  let content = fs.readFileSync(filepath, 'utf8');

  // Pattern 1: Fix .data! after success check
  content = content.replace(
    /(expect\((\w+)\.success\)\.toBe\(true\);)\n(\s+)(expect\(\2\.data!\.(\w+)\))/g,
    (match, successLine, varName, indent, expectLine, field) => {
      return `${successLine}\n${indent}if (${varName}.success) {\n${indent}  ${expectLine.replace('.data!', '.data')}\n${indent}}`;
    }
  );

  // Pattern 2: Fix multiple .data! lines after success
  const lines = content.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detect success assertion
    const successMatch = line.match(/expect\((\w+)\.success\)\.toBe\(true\)/);
    if (successMatch) {
      result.push(line);
      const varName = successMatch[1];
      const indent = line.match(/^\s*/)[0];

      // Collect following lines with .data!
      const dataLines = [];
      let j = i + 1;
      while (j < lines.length && lines[j].includes(`.data!`)) {
        dataLines.push(lines[j]);
        j++;
      }

      if (dataLines.length > 0) {
        result.push(`${indent}if (${varName}.success) {`);
        dataLines.forEach(dl => {
          result.push(dl.replace(/\.data!/g, '.data').replace(new RegExp(`^${indent}`), `${indent}  `));
        });
        result.push(`${indent}}`);
        i = j;
        continue;
      }
    }

    // Detect false assertion followed by error!
    const falseMatch = line.match(/expect\((\w+)\.success\)\.toBe\(false\)/);
    if (falseMatch && i + 1 < lines.length && lines[i + 1].includes('.error!')) {
      const varName = falseMatch[1];
      const indent = lines[i + 1].match(/^\s*/)[0];
      result.push(line);
      result.push(`${indent}if (!${varName}.success) {`);
      result.push(lines[i + 1].replace(/\.error!/g, '.error'));
      result.push(`${indent}}`);
      i += 2;
      continue;
    }

    // Fix standalone .data! -> .data (after type guard)
    result.push(line.replace(/(\w+)\.data!\.(\w+)/g, '$1.data.$2'));
    i++;
  }

  const fixed = result.join('\n');

  // Additional cleanup
  const final = fixed
    .replace(/\.data!\?/g, '.data')
    .replace(/\.error!\?/g, '.error');

  if (final !== content) {
    fs.writeFileSync(filepath, final, 'utf8');
    console.log(`✓ Fixed ${filepath}`);
    return true;
  } else {
    console.log(`- No changes needed for ${filepath}`);
    return false;
  }
}

// Run fixes
const files = [
  'src/store/discProfiles.test.ts',
  'src/utils/metricsCalculation.test.ts',
];

let fixedCount = 0;
files.forEach(f => {
  try {
    if (fixDatabaseResultPatterns(f)) {
      fixedCount++;
    }
  } catch (error) {
    console.error(`Error fixing ${f}:`, error.message);
  }
});

console.log(`\n${fixedCount}/${files.length} files fixed`);
console.log('\nRun "npm run type-check" to verify fixes');
