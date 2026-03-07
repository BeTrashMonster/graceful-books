import { readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { createReadStream } from 'fs';

const conversationFile = 'C:\\Users\\Admin\\.claude\\projects\\C--Users-Admin-graceful-books\\8e3ec30c-6463-48f2-be71-70f2d1e5d9b0.jsonl';

const messages = [];
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

      const contentStr = JSON.stringify(content);

      const keywords = [
        'Cost Intelligence',
        'intelligenceTab',
        'loadTrendData',
        'loadVendorIntelData',
        'generateSmartAlerts',
        'Scenario Builder',
        'CPU Trends',
        'Vendor Intel'
      ];

      if (keywords.some(keyword => contentStr.includes(keyword))) {
        messages.push({
          line: lineNum,
          uuid: data.uuid,
          timestamp: data.timestamp,
          content: content
        });
      }
    }
  } catch (e) {
    // Skip malformed lines
  }
});

rl.on('close', () => {
  console.log(`Found ${messages.length} messages mentioning Cost Intelligence features\n`);
  console.log('='.repeat(80));

  // Get the last 15 messages
  const recentMessages = messages.slice(-15);

  let output = '';

  for (const msg of recentMessages) {
    output += `\n\nLine: ${msg.line}\n`;
    output += `UUID: ${msg.uuid}\n`;
    output += `Timestamp: ${msg.timestamp}\n`;
    output += '-'.repeat(80) + '\n';

    for (const item of msg.content) {
      if (item.type === 'tool_use') {
        const toolName = item.name;
        const toolInput = item.input || {};

        if (toolName === 'Edit' || toolName === 'Write') {
          const filePath = toolInput.file_path || '';
          if (filePath.includes('HistoricalAnalytics')) {
            output += `\nTOOL: ${toolName}\n`;
            output += `FILE: ${filePath}\n`;

            const newString = toolInput.new_string || toolInput.content || '';
            if (newString.length > 0) {
              output += `\nCODE CONTENT:\n`;
              output += newString;
              output += '\n';
            }
          }
        }
      } else if (item.type === 'text') {
        const text = item.text || '';
        const keywords = ['Cost Intelligence', 'loadTrendData', 'loadVendorIntelData', 'generateSmartAlerts', 'intelligenceTab'];
        if (keywords.some(keyword => text.includes(keyword))) {
          output += `\nTEXT:\n`;
          output += text;
          output += '\n';
        }
      }
    }

    output += '='.repeat(80) + '\n';
  }

  writeFileSync('cost_intelligence_code_extraction.txt', output);
  console.log('\nExtraction complete! Output saved to cost_intelligence_code_extraction.txt');
  console.log(`Extracted ${recentMessages.length} recent messages`);
});
