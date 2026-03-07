import { createInterface } from 'readline';
import { createReadStream, writeFileSync } from 'fs';

const conversationFile = 'C:\\Users\\Admin\\.claude\\projects\\C--Users-Admin-graceful-books\\8e3ec30c-6463-48f2-be71-70f2d1e5d9b0.jsonl';

// Lines that contain Edit/Write operations related to Cost Intelligence
const targetLines = [
  5637, 5643, 5662, 5728, 5731, 5755, 5767, 5779, 5809,  // March 3 evening builds
  6626, 6650, 6670, 6674, 6686, 6690,  // March 4 around 1 AM
  7079  // Last edit before destruction
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
        if (item.type === 'tool_use' && (item.name === 'Edit' || item.name === 'Write')) {
          const toolInput = item.input || {};
          const filePath = toolInput.file_path || '';

          if (filePath.includes('HistoricalAnalytics')) {
            extractedEdits.push({
              line: lineNum,
              timestamp: data.timestamp,
              tool: item.name,
              filePath: filePath,
              oldString: toolInput.old_string || '',
              newString: toolInput.new_string || toolInput.content || ''
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
  console.log(`Extracted ${extractedEdits.length} edits from target lines\n`);

  let output = `Cost Intelligence Code Edits - Extracted from Conversation History\n`;
  output += '='.repeat(120) + '\n\n';

  for (let i = 0; i < extractedEdits.length; i++) {
    const edit = extractedEdits[i];
    output += `\n\n[${ i + 1 }] Line ${edit.line} | ${edit.timestamp}\n`;
    output += `Tool: ${edit.tool} | File: ${edit.filePath}\n`;
    output += '='.repeat(120) + '\n\n';

    if (edit.tool === 'Edit' && edit.oldString) {
      output += '--- OLD CODE ---\n';
      output += edit.oldString + '\n\n';
      output += '--- NEW CODE ---\n';
      output += edit.newString + '\n\n';
    } else {
      output += '--- CODE ---\n';
      output += edit.newString + '\n\n';
    }

    output += '='.repeat(120) + '\n';
  }

  writeFileSync('cost_intelligence_actual_code.txt', output);
  console.log('Code extraction complete! Saved to cost_intelligence_actual_code.txt');
  console.log(`Total edits extracted: ${extractedEdits.length}`);
});
