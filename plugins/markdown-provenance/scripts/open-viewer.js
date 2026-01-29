#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const viewerDir = join(__dirname, '..', 'viewer');

// Read the base HTML
const html = readFileSync(join(viewerDir, 'index.html'), 'utf8');

// Try to read transactions
let transactions = '';
try {
  transactions = readFileSync(join(homedir(), '.markdown-provenance', 'transactions.jsonl'), 'utf8');
} catch (e) {
  console.log('No transactions.jsonl found - viewer will open empty');
}

// Escape for embedding in template literal
const escaped = transactions.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

// Inject the data
const output = html.replace('</head>', `<script>var EMBEDDED_TRANSACTIONS = \`${escaped}\`;</script></head>`);

// Write the loaded version
const outputPath = join(viewerDir, 'index-loaded.html');
writeFileSync(outputPath, output);

// Open it
execSync(`open "${outputPath}"`);
console.log('Viewer opened with', transactions.split('\n').filter(Boolean).length, 'transactions');
