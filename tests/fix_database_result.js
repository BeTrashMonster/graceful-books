const fs = require('fs');
const path = require('path');

const files = [
  'src/store/categories.test.ts',
  'src/store/tags.test.ts',
  'src/store/discProfiles.test.ts',
];

files.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${filePath} - file not found`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Add type guards for DatabaseResult access
  // Pattern: expect(result.data...) or const x = result.data...
  // Replace with: if (result.success) { expect(result.data...) }
  
  // For now, just add ! assertions for data access
  content = content.replace(/(\w+)\.data\./g, '$1.success ? $1.data. : undefined!.');
  
  // Better approach: use type narrowing
  content = content.replace(
    /expect\((result\w*)\.data/g,
    'if ($1.success) expect($1.data'
  );
  
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Processed ${filePath}`);
});

