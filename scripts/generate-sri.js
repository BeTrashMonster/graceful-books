#!/usr/bin/env node

/**
 * Subresource Integrity (SRI) Hash Generator
 *
 * This script generates SRI hashes for external resources.
 * Use these hashes with the integrity attribute on <script> and <link> tags
 * to protect against CDN compromise attacks.
 *
 * IMPORTANT: Graceful Books is designed to be fully self-contained with no
 * external resources. This script is provided for cases where external
 * resources become necessary in the future.
 *
 * Usage:
 *   node scripts/generate-sri.js <url>
 *   node scripts/generate-sri.js <file-path>
 *   node scripts/generate-sri.js --check <url> <expected-hash>
 *
 * Examples:
 *   node scripts/generate-sri.js https://cdn.example.com/library.js
 *   node scripts/generate-sri.js ./dist/assets/vendor.js
 *   node scripts/generate-sri.js --check https://cdn.example.com/lib.js sha384-abc123
 *
 * Output formats:
 *   - SHA-384 hash (recommended, standard for SRI)
 *   - SHA-256 hash (alternative)
 *   - SHA-512 hash (strongest)
 *   - Ready-to-use HTML attributes
 *
 * @module scripts/generate-sri
 */

import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import https from 'https';
import http from 'http';

/**
 * Supported hash algorithms for SRI
 * SHA-384 is the recommended default per W3C SRI specification
 */
const ALGORITHMS = ['sha256', 'sha384', 'sha512'];
const DEFAULT_ALGORITHM = 'sha384';

/**
 * Fetches content from a URL
 * @param {string} url - The URL to fetch
 * @returns {Promise<Buffer>} The response body as a buffer
 */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        fetchUrl(response.headers.location).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: Failed to fetch ${url}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });

    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Request timeout after 30 seconds'));
    });
  });
}

/**
 * Generates SRI hash for the given content
 * @param {Buffer} content - The content to hash
 * @param {string} algorithm - The hash algorithm (sha256, sha384, sha512)
 * @returns {string} The SRI hash in the format "algorithm-base64hash"
 */
function generateSRIHash(content, algorithm = DEFAULT_ALGORITHM) {
  const hash = createHash(algorithm);
  hash.update(content);
  const base64Hash = hash.digest('base64');
  return `${algorithm}-${base64Hash}`;
}

/**
 * Generates all SRI hashes for the given content
 * @param {Buffer} content - The content to hash
 * @returns {Object} Object containing hashes for all algorithms
 */
function generateAllHashes(content) {
  const hashes = {};
  for (const algorithm of ALGORITHMS) {
    hashes[algorithm] = generateSRIHash(content, algorithm);
  }
  return hashes;
}

/**
 * Verifies a resource against an expected SRI hash
 * @param {Buffer} content - The content to verify
 * @param {string} expectedHash - The expected SRI hash (e.g., "sha384-abc123...")
 * @returns {boolean} True if the hash matches
 */
function verifySRIHash(content, expectedHash) {
  const [algorithm] = expectedHash.split('-');
  if (!ALGORITHMS.includes(algorithm)) {
    throw new Error(`Unsupported algorithm: ${algorithm}. Supported: ${ALGORITHMS.join(', ')}`);
  }
  const actualHash = generateSRIHash(content, algorithm);
  return actualHash === expectedHash;
}

/**
 * Generates ready-to-use HTML attributes for a resource
 * @param {string} url - The resource URL
 * @param {string} hash - The SRI hash
 * @param {string} type - The resource type ('script' or 'link')
 * @returns {string} HTML snippet with integrity attribute
 */
function generateHTMLSnippet(url, hash, type = 'script') {
  if (type === 'script') {
    return `<script src="${url}"
        integrity="${hash}"
        crossorigin="anonymous"></script>`;
  } else if (type === 'link' || type === 'stylesheet') {
    return `<link rel="stylesheet" href="${url}"
      integrity="${hash}"
      crossorigin="anonymous">`;
  }
  return `integrity="${hash}" crossorigin="anonymous"`;
}

/**
 * Prints usage information
 */
function printUsage() {
  console.log(`
Subresource Integrity (SRI) Hash Generator
============================================

Usage:
  node scripts/generate-sri.js <url-or-file>
  node scripts/generate-sri.js --check <url-or-file> <expected-hash>
  node scripts/generate-sri.js --help

Arguments:
  <url-or-file>     URL (https://...) or local file path to generate hash for
  --check           Verify a resource against an expected hash
  --help, -h        Show this help message

Examples:
  # Generate hashes for a CDN resource
  node scripts/generate-sri.js https://cdn.jsdelivr.net/npm/library@1.0.0/dist/library.min.js

  # Generate hashes for a local file
  node scripts/generate-sri.js ./dist/assets/vendor-abc123.js

  # Verify a resource against a known hash
  node scripts/generate-sri.js --check https://cdn.example.com/lib.js sha384-expectedhash...

Security Note:
  Graceful Books is designed to be FULLY SELF-CONTAINED with no external
  dependencies loaded at runtime. This script is provided for future use
  cases where external resources might become necessary.

  Always prefer bundling dependencies locally over loading from CDNs.
`);
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const isVerifyMode = args[0] === '--check';

  if (isVerifyMode) {
    if (args.length < 3) {
      console.error('Error: --check requires a URL/file and expected hash');
      console.error('Usage: node scripts/generate-sri.js --check <url-or-file> <expected-hash>');
      process.exit(1);
    }

    const target = args[1];
    const expectedHash = args[2];

    try {
      console.log(`\nVerifying SRI hash for: ${target}`);
      console.log(`Expected hash: ${expectedHash}\n`);

      let content;
      if (target.startsWith('http://') || target.startsWith('https://')) {
        console.log('Fetching remote resource...');
        content = await fetchUrl(target);
      } else if (existsSync(target)) {
        console.log('Reading local file...');
        content = await readFile(target);
      } else {
        throw new Error(`File not found: ${target}`);
      }

      const isValid = verifySRIHash(content, expectedHash);

      if (isValid) {
        console.log('PASS: SRI hash matches!');
        process.exit(0);
      } else {
        const [algorithm] = expectedHash.split('-');
        const actualHash = generateSRIHash(content, algorithm);
        console.log('FAIL: SRI hash does NOT match!');
        console.log(`  Expected: ${expectedHash}`);
        console.log(`  Actual:   ${actualHash}`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  } else {
    const target = args[0];

    try {
      console.log(`\nGenerating SRI hashes for: ${target}\n`);

      let content;
      let resourceType = 'script';

      if (target.startsWith('http://') || target.startsWith('https://')) {
        console.log('Fetching remote resource...');
        content = await fetchUrl(target);

        // Detect resource type from URL
        if (target.endsWith('.css')) {
          resourceType = 'stylesheet';
        }
      } else if (existsSync(target)) {
        console.log('Reading local file...');
        content = await readFile(target);

        if (target.endsWith('.css')) {
          resourceType = 'stylesheet';
        }
      } else {
        throw new Error(`File not found and not a valid URL: ${target}`);
      }

      const hashes = generateAllHashes(content);

      console.log('Generated SRI Hashes:');
      console.log('=====================');
      for (const [algorithm, hash] of Object.entries(hashes)) {
        const isDefault = algorithm === DEFAULT_ALGORITHM ? ' (recommended)' : '';
        console.log(`  ${algorithm}: ${hash}${isDefault}`);
      }

      console.log('\nReady-to-use HTML:');
      console.log('==================');
      console.log(generateHTMLSnippet(target, hashes[DEFAULT_ALGORITHM], resourceType));

      console.log('\nIntegrity attribute only:');
      console.log('=========================');
      console.log(`integrity="${hashes[DEFAULT_ALGORITHM]}" crossorigin="anonymous"`);

      console.log('\n');
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  }
}

main();
