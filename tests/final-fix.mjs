import fs from 'fs';

// Fix all remaining TypeScript errors
const fixes = [
  {
    file: 'src/store/discProfiles.test.ts',
    replacements: [
      // Fix double bang patterns
      { from: /(\w+)\.data!!\.id!/g, to: '$1.data.id' },
      { from: /(\w+)\.data!\.id/g, to: '$1.data.id' },
      { from: /result\.data\?\./g, to: 'result.data.' },
      { from: /created\.data\?\./g, to: 'created.data.' },
      { from: /first\.data\?\./g, to: 'first.data.' },
      { from: /second\.data\?\./g, to: 'second.data.' },
    ]
  },
  {
    file: 'src/store/categories.test.ts',
    replacements: [
      { from: /result\.data\[0\]\.children/g, to: 'result.data[0]?.children' },
    ]
  },
  {
    file: 'src/store/charities.test.ts',
    replacements: [
      { from: /targetCharity!\.id/g, to: 'targetCharity.id' },
    ]
  },
];

fixes.forEach(({ file, replacements }) => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    replacements.forEach(({ from, to }) => {
      const before = content;
      content = content.replace(from, to);
      if (content !== before) {
        changed = true;
        console.log(`✓ Applied fix in ${file}: ${from.toString()}`);
      }
    });

    if (changed) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`✓✓ Saved ${file}`);
    }
  } catch (error) {
    console.error(`Error fixing ${file}:`, error.message);
  }
});

// Handle discProfiles special cases - need to add type guards
const discFile = 'src/store/discProfiles.test.ts';
try {
  let content = fs.readFileSync(discFile, 'utf8');

  // Add type guard checks before .data access in function calls
  content = content.replace(
    /(const created = await createDISCProfile\([^)]+\);)\s*\n\s*(const result = await \w+\(created\.data\.id)/g,
    '$1\n      if (!created.success) throw new Error(\'Profile creation failed\');\n      $2'
  );

  // Add type guard for second profile
  content = content.replace(
    /(const second = await createDISCProfile\([^)]+\);)\s*\n\s*\n\s*(expect\(result\.success\))/g,
    '$1\n      if (!second.success) throw new Error(\'Profile creation failed\');\n\n      $2'
  );

  fs.writeFileSync(discFile, content, 'utf8');
  console.log(`✓✓ Applied special fixes to ${discFile}`);
} catch (error) {
  console.error(`Error in special fixes:`, error.message);
}

console.log('\n✅ All fixes applied! Run "npm run type-check" to verify.');
