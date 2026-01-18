#!/usr/bin/env python3
"""
Automatic TypeScript test fixer for DatabaseResult patterns
"""

import re
import sys

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Fix pattern: result.data! -> check and use result.data
    # This handles: expect(result.data!.field)
    content = re.sub(
        r'(expect\(result\.success\)\.toBe\(true\);)\n(\s+)(expect\(result\.data!)',
        r'\1\n\2if (result.success) {\n\2  \2.replace("result.data!", "result.data")',
        content
    )

    # Fix: .data! -> .data (simple replacement in all contexts after success check)
    lines = content.split('\n')
    fixed_lines = []
    in_success_block = False
    indent_level = 0

    for i, line in enumerate(lines):
        # Detect if we just checked success
        if 'expect(result.success).toBe(true);' in line or 'expect(createResult.success).toBe(true);' in line:
            fixed_lines.append(line)
            # Check if next line has .data!
            if i + 1 < len(lines) and '.data!' in lines[i + 1]:
                indent = len(lines[i + 1]) - len(lines[i + 1].lstrip())
                fixed_lines.append(' ' * indent + 'if (result.success) {' if 'result.success' in line else ' ' * indent + 'if (createResult.success) {')
                in_success_block = True
                indent_level = indent
            continue

        # Fix .data! to .data when in success block
        if in_success_block and '.data!' in line:
            fixed_line = line.replace('.data!', '.data').replace('?.', '.')
            fixed_lines.append('  ' + fixed_line)
            # Check if this is last line of expects
            if i + 1 < len(lines) and ('.data!' not in lines[i + 1] or 'expect(result' in lines[i + 1]):
                fixed_lines.append(' ' * indent_level + '}')
                in_success_block = False
            continue

        # Fix error! patterns
        if '.error!' in line and i > 0 and 'toBe(false)' in lines[i - 1]:
            indent = len(line) - len(line.lstrip())
            fixed_lines.append(' ' * indent + 'if (!result.success) {')
            fixed_lines.append(line.replace('.error!', '.error'))
            fixed_lines.append(' ' * indent + '}')
            continue

        fixed_lines.append(line)

    content = '\n'.join(fixed_lines)

    # Additional simple replacements
    content = content.replace('createResult.data!.id', 'createResult.data.id')
    content = content.replace('result.data!.id', 'result.data.id')
    content = content.replace('result.data!?.', 'result.data.')

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {filepath}")
        return True
    return False

if __name__ == '__main__':
    files = [
        'src/store/discProfiles.test.ts',
        'src/utils/metricsCalculation.test.ts',
    ]

    for f in files:
        try:
            fix_file(f)
        except Exception as e:
            print(f"Error fixing {f}: {e}")
