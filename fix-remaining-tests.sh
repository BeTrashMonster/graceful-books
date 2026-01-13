#!/bin/bash

# Fix all remaining test DatabaseResult patterns

for file in src/store/discProfiles.test.ts src/utils/metricsCalculation.test.ts; do
  if [ -f "$file" ]; then
    echo "Fixing $file..."

    # Create temp file
    temp_file=$(mktemp)

    # Read file and apply fixes
    awk '
    /expect\(result\.success\)\.toBe\(true\);/ {
      print
      next_line_num = NR + 1
      getline
      # Check if next line has .data! pattern
      if ($0 ~ /expect\(.*\.data!/) {
        # Add type guard
        indent = match($0, /[^ ]/)
        spaces = substr($0, 1, indent-1)
        print spaces "if (result.success) {"
        gsub(/\.data!/, ".data", $0)
        print $0
        # Continue reading lines with .data! until we hit a different pattern
        while (getline > 0 && $0 ~ /expect\(.*\.data/) {
          gsub(/\.data!/, ".data", $0)
          print $0
        }
        print spaces "}"
        if (NF > 0) print  # Print the last read line if it exists
        next
      }
      print
      next
    }
    /expect\(.*\.error!\.)/ {
      gsub(/\.error!\./, ".error.")
      if (prev_line ~ /expect\(.*\.success\)\.toBe\(false\)/) {
        indent = match($0, /[^ ]/)
        spaces = substr($0, 1, indent-1)
        print spaces "if (!result.success) {"
        print $0
        print spaces "}"
      } else {
        print
      }
      next
    }
    { prev_line = $0; print }
    ' "$file" > "$temp_file"

    # Replace original file
    mv "$temp_file" "$file"
    echo "Fixed $file"
  fi
done

echo "All fixes applied!"
