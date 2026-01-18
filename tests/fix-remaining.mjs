import fs from 'fs';

function fixDatabaseResultPatterns(filepath) {
  console.log(`\nProcessing ${filepath}...`);
  let content = fs.readFileSync(filepath, 'utf8');

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
          const fixedLine = dl.replace(/\.data!/g, '.data');
          const currentIndent = dl.match(/^\s*/)[0];
          result.push(`${currentIndent}  ${dl.trim().replace(/\.data!/g, '.data')}`);
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
      result.push(`${indent}  ${lines[i + 1].trim().replace(/\.error!/g, '.error')}`);
      result.push(`${indent}}`);
      i += 2;
      continue;
    }

    result.push(line);
    i++;
  }

  let fixed = result.join('\n');

  // Additional cleanup patterns
  fixed = fixed.replace(/(\w+Result)\.data!\.(\w+)/g, (match, p1, p2) => {
    // Check if we're already in a success block
    return `${p1}.data.${p2}`;
  });

  if (fixed !== content) {
    fs.writeFileSync(filepath, fixed, 'utf8');
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
