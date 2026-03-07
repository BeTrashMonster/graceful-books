import { createInterface } from 'readline';
import { createReadStream, writeFileSync } from 'fs';

const conversationFile = 'C:\\Users\\Admin\\.claude\\projects\\C--Users-Admin-graceful-books\\8e3ec30c-6463-48f2-be71-70f2d1e5d9b0.jsonl';

// Focus on the larger edits that likely contain the full implementations
const targetLines = [
  5643,  // 16259 chars - likely a big feature add
  5662,  // 11648 chars
  6650,  // 8317 chars
  6670,  // 7386 chars
  6686,  // 20619 chars - LARGEST, probably has everything
  6690,  // 13696 chars
  7079   // 4126 chars - last edit before destruction
];

const extractedEdits = [];
let lineNum = 0;

const rl = createInterface({
  input: createReadStream(conversationFile),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  lineNum++;

  if (targetLines.includes(lineNum)) {
    try {
      const data = JSON.parse(line);
      const message = data.message || {};
      const content = message.content || [];

      for (const item of content) {
        if (item.type === 'tool_use' && item.name === 'Edit') {
          const toolInput = item.input || {};
          const filePath = toolInput.file_path || '';

          if (filePath.includes('CPUTracker.tsx')) {
            extractedEdits.push({
              line: lineNum,
              timestamp: data.timestamp,
              filePath: filePath,
              oldString: toolInput.old_string || '',
              newString: toolInput.new_string || ''
            });
          }
        }
      }
    } catch (e) {
      console.error(`Error parsing line ${lineNum}:`, e.message);
    }
  }
});

rl.on('close', () => {
  console.log(`Extracted ${extractedEdits.length} CPUTracker edits\n`);

  let output = `Cost Intelligence Code - Extracted from CPUTracker.tsx Edits\n`;
  output += `Total edits extracted: ${extractedEdits.length}\n`;
  output += '='.repeat(120) + '\n\n';

  for (let i = 0; i < extractedEdits.length; i++) {
    const edit = extractedEdits[i];
    output += `\n\n=========== EDIT #${i + 1} ===========\n`;
    output += `Line ${edit.line} | ${edit.timestamp}\n`;
    output += `File: ${edit.filePath}\n`;
    output += `Old String Length: ${edit.oldString.length} chars\n`;
    output += `New String Length: ${edit.newString.length} chars\n`;
    output += '='.repeat(120) + '\n\n';

    output += '--- OLD CODE ---\n';
    output += edit.oldString + '\n\n';
    output += '--- NEW CODE ---\n';
    output += edit.newString + '\n\n';
    output += '='.repeat(120) + '\n';
  }

  writeFileSync('cpu_tracker_cost_intelligence_code.txt', output);
  console.log('Code extraction complete! Saved to cpu_tracker_cost_intelligence_code.txt');

  // Also create a file with JUST the new code from the largest edit (likely the complete implementation)
  if (extractedEdits.length > 0) {
    const largestEdit = extractedEdits.reduce((max, edit) =>
      edit.newString.length > max.newString.length ? edit : max
    );

    writeFileSync('largest_cost_intelligence_implementation.txt',
      `Largest Implementation from Line ${largestEdit.line} (${largestEdit.timestamp})\n` +
      `Length: ${largestEdit.newString.length} chars\n\n` +
      '='.repeat(120) + '\n\n' +
      largestEdit.newString
    );
    console.log(`Largest implementation (${largestEdit.newString.length} chars) saved separately`);
  }
});
