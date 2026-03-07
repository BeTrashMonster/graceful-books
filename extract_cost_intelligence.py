import json
import sys

# Read the JSONL file and find Cost Intelligence related messages
with open(r'C:\Users\Admin\.claude\projects\C--Users-Admin-graceful-books\8e3ec30c-6463-48f2-be71-70f2d1e5d9b0.jsonl', 'r', encoding='utf-8') as f:
    messages = []
    for line_num, line in enumerate(f, 1):
        try:
            data = json.loads(line)
            if data.get('type') == 'assistant':
                message = data.get('message', {})
                content = message.get('content', [])

                # Convert content to string for searching
                content_str = json.dumps(content)

                # Check if this message contains Cost Intelligence code
                if any(keyword in content_str for keyword in [
                    'Cost Intelligence',
                    'intelligenceTab',
                    'loadTrendData',
                    'loadVendorIntelData',
                    'generateSmartAlerts',
                    'Scenario Builder',
                    'CPU Trends',
                    'Vendor Intel'
                ]):
                    messages.append({
                        'line': line_num,
                        'uuid': data.get('uuid'),
                        'timestamp': data.get('timestamp'),
                        'content': content
                    })
        except:
            continue

# Print the last 10 messages that mention Cost Intelligence
print(f"Found {len(messages)} messages mentioning Cost Intelligence features\n")
print("=" * 80)

for msg in messages[-10:]:
    print(f"\nLine: {msg['line']}")
    print(f"UUID: {msg['uuid']}")
    print(f"Timestamp: {msg['timestamp']}")
    print("-" * 80)

    for item in msg['content']:
        if item.get('type') == 'tool_use':
            tool_name = item.get('name')
            tool_input = item.get('input', {})

            if tool_name == 'Edit':
                file_path = tool_input.get('file_path', '')
                if 'HistoricalAnalytics' in file_path:
                    print(f"\nTOOL: {tool_name}")
                    print(f"FILE: {file_path}")
                    new_string = tool_input.get('new_string', '')
                    if len(new_string) > 0:
                        print(f"\nNEW_STRING (first 2000 chars):")
                        print(new_string[:2000])
                        if len(new_string) > 2000:
                            print(f"\n... (truncated, total length: {len(new_string)} chars)")

        elif item.get('type') == 'text':
            text = item.get('text', '')
            if any(keyword in text for keyword in ['Cost Intelligence', 'loadTrendData', 'loadVendorIntelData', 'generateSmartAlerts']):
                print(f"\nTEXT:")
                print(text[:1000])
                if len(text) > 1000:
                    print(f"\n... (truncated, total length: {len(text)} chars)")

    print("=" * 80)
