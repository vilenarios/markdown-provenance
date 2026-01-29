#!/usr/bin/env node

/**
 * Generate llms.txt and llms-full.txt from README.md
 * Following the llmstxt.org standard
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Read the README
const readme = readFileSync(join(rootDir, 'README.md'), 'utf8');

// Generate llms.txt (index file with summary)
const llmsTxt = `# Markdown Provenance

> A Claude Code plugin for uploading markdown files to Arweave permanent storage, providing cryptographic proof of authorship and timestamp.

## Overview

Markdown Provenance enables writers, researchers, and content creators to establish verifiable provenance for their work by uploading markdown files to the Arweave permaweb. Each upload is permanent, timestamped, and cryptographically signed.

## Key Features

- Permanent storage on Arweave blockchain
- IPFS-compatible content addressing (CIDv1)
- Free uploads for files under 100KB via ArDrive Turbo
- Deduplication via local log and Arweave GraphQL
- Web viewer for browsing upload history

## Documentation

- [README.md](https://raw.githubusercontent.com/rickmanelius/markdown-provenance/main/README.md): Full documentation including installation, wallet setup, usage, and troubleshooting
- [llms-full.txt](https://raw.githubusercontent.com/rickmanelius/markdown-provenance/main/llms-full.txt): Complete documentation in LLM-friendly format

## Optional

- [LICENSE](https://raw.githubusercontent.com/rickmanelius/markdown-provenance/main/LICENSE): MIT License
`;

// Generate llms-full.txt (complete content)
const llmsFullTxt = `# Markdown Provenance - Complete Documentation

> This file contains the complete documentation for Markdown Provenance, formatted for LLM consumption following the llmstxt.org standard.

---

${readme}
`;

// Write the files
writeFileSync(join(rootDir, 'llms.txt'), llmsTxt);
writeFileSync(join(rootDir, 'llms-full.txt'), llmsFullTxt);

console.log('Generated:');
console.log('  - llms.txt (index)');
console.log('  - llms-full.txt (full content)');
