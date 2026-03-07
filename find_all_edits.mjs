import { createInterface } from 'readline';
import { createReadStream, writeFileSync } from 'fs';

const conversationFile = 'C:\\Users\\Admin\\.claude\\projects\\C--Users-Admin-graceful-books\\8e3ec30c-6463-48f2-be71-70f2d1e5d9b0.jsonl';

// Lines that contain Edit/Write operations related to Cost Intelligence
const targetLines = [
  5637, 5643, 5662, 5728, 5731, 5755, 5767, 5779, 5809,
  6626, 6650, 6670, 6674, 6686, 6690,
  7079
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

          extractedEdits.push({
            line: lineNum,
            timestamp: data.timestamp,
            tool: item.name,
            filePath: filePath,
            codeLength: (toolInput.new_string || toolInput.content || '').length
          });
        }
      }
    } catch (e) {
      // Skip
    }
  }
});

rl.on('close', () => {
  console.log(`Found ${extractedEdits.length} edits at target lines\n`);

  let output = 'Edit Operations at Target Lines:\n\n';

  for (const edit of extractedEdits) {
    output += `Line ${edit.line} | ${edit.timestamp}\n`;
    output += `  Tool: ${edit.tool}\n`;
    output += `  File: ${edit.filePath}\n`;
    output += `  Code Length: ${edit.codeLength} chars\n\n`;
  }

  writeFileSync('edit_file_list.txt', output);
  console.log('File list saved to edit_file_list.txt');
});
