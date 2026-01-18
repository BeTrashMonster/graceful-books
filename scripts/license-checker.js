#!/usr/bin/env node

/**
 * License Checker for Graceful Books
 *
 * Validates that all dependencies comply with the project's license policy.
 * Blocks PRs if restricted licenses are found.
 *
 * Usage:
 *   npm run deps:check-licenses
 *   node scripts/license-checker.js --output report.json
 *   node scripts/license-checker.js --package react
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// License configurations
const ALLOWED_LICENSES = [
  'MIT',
  'Apache-2.0',
  'Apache 2.0',
  'BSD',
  'BSD-2-Clause',
  '2-Clause BSD',
  'BSD-3-Clause',
  '3-Clause BSD',
  'ISC',
  'Unlicense',
  'CC0-1.0',
  'CC0 1.0 Universal',
  'Python-2.0',
  'MPL-2.0',
  'CC-BY-4.0',
  'BlueOak-1.0.0',
];

const RESTRICTED_LICENSES = [
  'GPL',
  'GPLv2',
  'GPLv3',
  'GPL-2.0',
  'GPL-3.0',
  'AGPL',
  'AGPL-3.0',
  'SSPL',
  'Commons Clause',
];

const BLOCKED_LICENSES = [...RESTRICTED_LICENSES];

/**
 * Check if a license is allowed
 * @param {string} license - License string to check
 * @returns {string} - 'allowed', 'restricted', or 'unknown'
 */
function checkLicense(license) {
  if (!license) return 'unknown';

  // Handle array of licenses
  if (Array.isArray(license)) {
    license = license.map((l) => (typeof l === 'string' ? l : l.type || '')).join(', ');
  }

  // Convert to string if not already
  if (typeof license !== 'string') {
    return 'unknown';
  }

  const licenseLower = license.toLowerCase();

  // Check allowed
  if (
    ALLOWED_LICENSES.some((allowed) =>
      licenseLower.includes(allowed.toLowerCase())
    )
  ) {
    return 'allowed';
  }

  // Check restricted
  if (
    RESTRICTED_LICENSES.some((restricted) =>
      licenseLower.includes(restricted.toLowerCase())
    )
  ) {
    return 'restricted';
  }

  // Check blocked
  if (
    BLOCKED_LICENSES.some((blocked) =>
      licenseLower.includes(blocked.toLowerCase())
    )
  ) {
    return 'blocked';
  }

  return 'unknown';
}

/**
 * Get license for a package
 * @param {string} packageName - Package name
 * @returns {string|null} - License string or null
 */
function getLicense(packageName) {
  try {
    // Handle scoped packages
    const parts = packageName.split('/');
    const isScoped = packageName.startsWith('@');
    const packagePath = isScoped
      ? path.join(process.cwd(), 'node_modules', parts[0], parts[1], 'package.json')
      : path.join(process.cwd(), 'node_modules', packageName, 'package.json');

    if (!fs.existsSync(packagePath)) {
      return null;
    }

    const content = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    if (content.license) {
      return content.license;
    }
    if (content.licenses && Array.isArray(content.licenses)) {
      return content.licenses.map((l) => l.type || l).join(', ');
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get all dependencies from node_modules
 * @returns {Object} - Map of package names to info
 */
function getAllDependencies() {
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  const packages = {};

  if (!fs.existsSync(nodeModulesPath)) {
    return packages;
  }

  // Read all top-level packages
  function readDirectory(dir, prefix = '') {
    try {
      const entries = fs.readdirSync(dir);

      entries.forEach((entry) => {
        if (entry.startsWith('.')) return;

        const entryPath = path.join(dir, entry);
        const stat = fs.statSync(entryPath);

        if (entry === 'node_modules') {
          // Skip nested node_modules for now
          return;
        }

        if (entry.startsWith('@') && stat.isDirectory()) {
          // Handle scoped packages
          const scopedEntries = fs.readdirSync(entryPath);
          scopedEntries.forEach((scopedEntry) => {
            if (!scopedEntry.startsWith('.')) {
              const packageName = `${entry}/${scopedEntry}`;
              const packagePath = path.join(entryPath, scopedEntry, 'package.json');
              if (fs.existsSync(packagePath)) {
                packages[packageName] = { name: packageName };
              }
            }
          });
        } else if (stat.isDirectory()) {
          // Regular package
          const packagePath = path.join(entryPath, 'package.json');
          if (fs.existsSync(packagePath)) {
            packages[entry] = { name: entry };
          }
        }
      });
    } catch {
      // Ignore errors reading directories
    }
  }

  readDirectory(nodeModulesPath);
  return packages;
}

/**
 * Check licenses for all dependencies
 * @param {Object} options - Options
 * @returns {Object} - Results with allowed, restricted, blocked, unknown
 */
function checkAllLicenses(options = {}) {
  const { filterPackage = null, verbose = false } = options;

  const results = {
    allowed: [],
    restricted: [],
    blocked: [],
    unknown: [],
    checked: 0,
    errors: [],
  };

  const dependencies = getAllDependencies();

  // Get unique package names (remove duplicates from different paths)
  const uniquePackages = new Map();
  Object.entries(dependencies).forEach(([fullName, info]) => {
    const key = info.scope ? `${info.scope}/${info.name}` : info.name;
    if (!uniquePackages.has(key)) {
      uniquePackages.set(key, { ...info, fullName });
    }
  });

  uniquePackages.forEach((info, packageName) => {
    // Filter if specified
    if (filterPackage && !packageName.includes(filterPackage)) {
      return;
    }

    const license = getLicense(packageName);
    const status = checkLicense(license);

    const record = {
      name: packageName,
      license: license || 'unknown',
      status,
    };

    if (verbose) {
      console.log(`${packageName}: ${license || '(unknown)'} [${status}]`);
    }

    if (status === 'allowed') {
      results.allowed.push(record);
    } else if (status === 'restricted') {
      results.restricted.push(record);
    } else if (status === 'blocked') {
      results.blocked.push(record);
    } else {
      results.unknown.push(record);
    }

    results.checked++;
  });

  return results;
}

/**
 * Format and display results
 * @param {Object} results - Results from checkAllLicenses
 */
function displayResults(results) {
  const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
  };

  console.log(`\n${colors.cyan}${colors.bold}License Compliance Check${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(50)}${colors.reset}\n`);

  console.log(`${colors.bold}Total Checked:${colors.reset} ${results.checked}`);
  console.log(
    `${colors.green}${colors.bold}Allowed:${colors.reset} ${results.allowed.length}`
  );
  console.log(
    `${colors.yellow}${colors.bold}Restricted:${colors.reset} ${results.restricted.length}`
  );
  console.log(`${colors.red}${colors.bold}Blocked:${colors.reset} ${results.blocked.length}`);
  console.log(
    `${colors.yellow}${colors.bold}Unknown:${colors.reset} ${results.unknown.length}\n`
  );

  if (results.blocked.length > 0) {
    console.log(`${colors.red}${colors.bold}BLOCKED LICENSES:${colors.reset}`);
    results.blocked.forEach(({ name, license }) => {
      console.log(`  ${colors.red}✗${colors.reset} ${name}: ${license}`);
    });
    console.log();
  }

  if (results.restricted.length > 0) {
    console.log(`${colors.yellow}${colors.bold}RESTRICTED LICENSES (require review):${colors.reset}`);
    results.restricted.forEach(({ name, license }) => {
      console.log(`  ${colors.yellow}!${colors.reset} ${name}: ${license}`);
    });
    console.log();
  }

  if (results.unknown.length > 0) {
    console.log(
      `${colors.yellow}${colors.bold}UNKNOWN LICENSES (may need review):${colors.reset}`
    );
    results.unknown.forEach(({ name, license }) => {
      console.log(`  ${colors.yellow}?${colors.reset} ${name}: ${license}`);
    });
    console.log();
  }

  // Summary
  if (results.blocked.length === 0 && results.restricted.length === 0) {
    console.log(
      `${colors.green}${colors.bold}✓ All licenses compliant!${colors.reset}\n`
    );
    return true;
  } else {
    console.log(
      `${colors.red}${colors.bold}✗ License compliance check failed!${colors.reset}\n`
    );
    if (results.blocked.length > 0) {
      console.log(
        `${colors.red}Action Required: Remove or replace blocked packages${colors.reset}`
      );
    }
    if (results.restricted.length > 0) {
      console.log(
        `${colors.yellow}Review Required: Restricted licenses need business justification${colors.reset}`
      );
    }
    console.log();
    return false;
  }
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const options = {};
  let outputFile = null;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      outputFile = args[i + 1];
      i++;
    } else if (args[i] === '--package' && args[i + 1]) {
      options.filterPackage = args[i + 1];
      i++;
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      options.verbose = true;
    }
  }

  try {
    const results = checkAllLicenses(options);

    // Save to file if requested
    if (outputFile) {
      fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
      console.log(`Results saved to ${outputFile}`);
    }

    // Display results
    const passed = displayResults(results);

    // Exit with appropriate code
    process.exit(results.blocked.length > 0 || results.restricted.length > 0 ? 1 : 0);
  } catch (error) {
    console.error(`${'\x1b[31m'}Error: ${error.message}${'\x1b[0m'}`);
    process.exit(1);
  }
}

main();
