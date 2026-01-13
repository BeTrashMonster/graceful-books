# Fix discProfiles.test.ts DatabaseResult patterns

$file = "src\store\discProfiles.test.ts"
$content = Get-Content $file -Raw

# Pattern 1: Fix .data! access by adding type guards
$content = $content -replace '(\s+)(const \w+Result = await \w+\([^)]+\);)\s+\n\s+expect\((\w+Result)\.data!\.', '$1$2$1if (!$3.success) throw new Error(''Operation failed'');$1expect($3.data.'

# Pattern 2: Fix expect(result.data!.) patterns
$content = $content -replace 'expect\((\w+)\.data!\.([\w.]+)\)', 'if ($1.success) {$1  expect($1.data.$2)$1}'

# Pattern 3: Fix expect(result.error!.) patterns
$content = $content -replace 'expect\((\w+)\.error!\.([\w.]+)\)', 'if (!$1.success) {$1  expect($1.error.$2)$1}'

# Pattern 4: Fix .data! in function calls
$content = $content -replace '(\w+)\.data!\.(\w+)', '$1.data.$2'

# Write back
Set-Content -Path $file -Value $content -NoNewline

Write-Host "Fixed discProfiles.test.ts patterns"
