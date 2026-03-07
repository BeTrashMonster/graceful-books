import { createInterface } from 'readline';
import { createReadStream, writeFileSync } from 'fs';

const conversationFile = 'C:\\Users\\Admin\\.claude\\projects\\C--Users-Admin-graceful-books\\8e3ec30c-6463-48f2-be71-70f2d1e5d9b0.jsonl';

const editMessages = [];
let lineNum = 0;

const rl = createInterface({
  input: createReadStream(conversationFile),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  lineNum++;
  try {
    const data = JSON.parse(line);
    if (data.type === 'assistant') {
      const message = data.message || {};
      const content = message.content || [];

      for (const item of content) {
        if (item.type === 'tool_use' && (item.name === 'Edit' || item.name === 'Write')) {
          const toolInput = item.input || {};
          const filePath = toolInput.file_path || '';

          if (filePath.includes('HistoricalAnalytics.tsx')) {
            const newString = toolInput.new_string || toolInput.content || '';

            // Check if this edit contains the key functions
            if (newString.includes('loadTrendData') ||
                newString.includes('loadVendorIntelData') ||
                newString.includes('generateSmartAlerts') ||
                newString.includes('intelligenceTab')) {

              editMessages.push({
                line: lineNum,
                uuid: data.uuid,
                timestamp: data.timestamp,
                tool: item.name,
                filePath: filePath,
                oldString: toolInput.old_string || '',
                newString: newString,
                contentLength: newString.length
              });
            }
          }
        }
      }
    }
  } catch (e) {
    // Skip malformed lines
  }
});

rl.on('close', () => {
  console.log(`Found ${editMessages.length} Edit/Write operations on HistoricalAnalytics.tsx with key functions\n`);

  // Sort by timestamp to see chronological order
  editMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  let output = `Found ${editMessages.length} relevant code edits\n\n`;
  output += '='.repeat(120) + '\n\n';

  // Show the last 30 edits to see what was built before destruction
  const recentEdits = editMessages.slice(-30);

  for (let i = 0; i < recentEdits.length; i++) {
    const msg = recentEdits[i];
    output += `\n[${ i + 1 }] Line: ${msg.line} | Timestamp: ${msg.timestamp}\n`;
    output += `UUID: ${msg.uuid}\n`;
    output += `Tool: ${msg.tool} | Content Length: ${msg.contentLength} chars\n`;
    output += '-'.repeat(120) + '\n\n';

    // For large edits that contain full implementations, show the full code
    if (msg.newString.length > 1000) {
      output += 'NEW CODE:\n';
      output += msg.newString + '\n\n';
    } else {
      output += 'OLD CODE:\n';
      output += msg.oldString + '\n\n';
      output += 'NEW CODE:\n';
      output += msg.newString + '\n\n';
    }

    output += '='.repeat(120) + '\n\n';
  }

  writeFileSync('original_cost_intelligence_code.txt', output);
  console.log('Extraction complete! Output saved to original_cost_intelligence_code.txt');
  console.log(`Extracted ${recentEdits.length} code edits`);

  // Also save a summary
  let summary = 'SUMMARY OF EDITS BY TIMESTAMP:\n\n';
  for (const msg of editMessages) {
    summary += `${msg.timestamp} | Line ${msg.line} | ${msg.contentLength} chars | Contains: `;
    const features = [];
    if (msg.newString.includes('loadTrendData')) features.push('loadTrendData');
    if (msg.newString.includes('loadVendorIntelData')) features.push('loadVendorIntelData');
    if (msg.newString.includes('generateSmartAlerts')) features.push('generateSmartAlerts');
    if (msg.newString.includes('intelligenceTab')) features.push('intelligenceTab');
    summary += features.join(', ') + '\n';
  }

  writeFileSync('edit_summary.txt', summary);
  console.log('Summary saved to edit_summary.txt');
});
