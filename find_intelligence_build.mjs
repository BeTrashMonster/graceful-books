import { createInterface } from 'readline';
import { createReadStream, writeFileSync } from 'fs';

const conversationFile = 'C:\\Users\\Admin\\.claude\\projects\\C--Users-Admin-graceful-books\\8e3ec30c-6463-48f2-be71-70f2d1e5d9b0.jsonl';

const relevantMessages = [];
let lineNum = 0;

const rl = createInterface({
  input: createReadStream(conversationFile),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  lineNum++;
  try {
    const data = JSON.parse(line);

    // Look for assistant messages or tool use
    if (data.type === 'assistant' || data.type === 'user') {
      const message = data.message || {};
      const content = message.content || [];

      // Check both text content and tool inputs
      const contentStr = JSON.stringify(content);
      const textContent = content.filter(c => c.type === 'text').map(c => c.text).join(' ');

      // Look for keywords that indicate building the Cost Intelligence feature
      const buildKeywords = [
        'Cost Intelligence',
        'Scenario Builder',
        'CPU Trends',
        'Vendor Intel',
        'Smart Alerts',
        'loadTrendData',
        'loadVendorIntelData',
        'generateSmartAlerts'
      ];

      const hasKeyword = buildKeywords.some(keyword => contentStr.includes(keyword) || textContent.includes(keyword));

      if (hasKeyword) {
        relevantMessages.push({
          line: lineNum,
          type: data.type,
          uuid: data.uuid,
          timestamp: data.timestamp,
          textContent: textContent.substring(0, 500),
          hasEditTool: contentStr.includes('"name":"Edit"'),
          hasWriteTool: contentStr.includes('"name":"Write"'),
          contentLength: contentStr.length
        });
      }
    }
  } catch (e) {
    // Skip malformed lines
  }
});

rl.on('close', () => {
  console.log(`Found ${relevantMessages.length} messages mentioning Cost Intelligence\n`);

  // Sort by timestamp
  relevantMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  let output = `Found ${relevantMessages.length} relevant messages\n\n`;
  output += '='.repeat(120) + '\n\n';

  // Show all messages chronologically
  for (let i = 0; i < relevantMessages.length; i++) {
    const msg = relevantMessages[i];
    output += `\n[${i + 1}] Line: ${msg.line} | ${msg.type} | ${msg.timestamp}\n`;
    output += `UUID: ${msg.uuid}\n`;
    output += `Has Edit Tool: ${msg.hasEditTool} | Has Write Tool: ${msg.hasWriteTool} | Content Length: ${msg.contentLength}\n`;
    output += `Preview: ${msg.textContent}\n`;
    output += '-'.repeat(120) + '\n';
  }

  writeFileSync('cost_intelligence_timeline.txt', output);
  console.log('Timeline saved to cost_intelligence_timeline.txt');

  // Create a focused list of Edit/Write operations
  const editsOutput = relevantMessages
    .filter(m => m.hasEditTool || m.hasWriteTool)
    .map((m, i) => `[${i + 1}] Line ${m.line} | ${m.timestamp} | ${m.type}`)
    .join('\n');

  writeFileSync('cost_intelligence_edits.txt', `Messages with Edit/Write operations:\n\n${editsOutput}`);
  console.log('Edit operations saved to cost_intelligence_edits.txt');
});
