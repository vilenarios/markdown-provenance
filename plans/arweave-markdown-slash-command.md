# feat: /arweave-markdown Claude Code Slash Command

**Type:** Enhancement
**Date:** 2025-01-15
**Complexity:** Medium

---

## Overview

Create a Claude Code slash command `/arweave-markdown` that uploads markdown files to Arweave permanent storage with proper metadata tags, returning the block explorer URL and logging transactions locally.

## Problem Statement / Motivation

Users want to permanently archive markdown content on Arweave's decentralized storage network directly from Claude Code. This enables:
- Permanent, immutable documentation storage
- Attestations and proof-of-existence for markdown content
- Integration with the permaweb ecosystem
- Content-addressable storage with IPFS CID tagging

## Proposed Solution

Create a Claude Code slash command at `/Users/rickmanelius/git/rickmanelius/arweave-markdown/` with:
1. **commands/arweave-markdown.md** - Slash command definition (explicit invocation only)
2. **SKILL.md** - Core instructions and workflow (NO auto-trigger phrases)
3. **scripts/upload-to-arweave.ts** - TypeScript upload script using @ardrive/turbo-sdk
4. **README.md** - Setup instructions including wallet generation

### Security: Explicit Invocation Only

**This command will ONLY run when explicitly invoked via `/arweave-markdown`.**

It will NOT auto-trigger based on conversation context (e.g., mentioning "arweave", "permanent storage", etc.) to prevent accidental uploads of private content.

### Command Interface

```bash
/arweave-markdown <file-path>
```

**Example:**
```bash
/arweave-markdown ./docs/attestation.md
```

### Default Tags Applied

| Tag | Value | Source |
|-----|-------|--------|
| App-Name | Arweave Markdown | Static |
| App-Version | 0.0.1 | Static |
| Author | User-provided | `ARWEAVE_AUTHOR` env var |
| IPFS-CID | Calculated | SHA-256 hash of content |
| Content-Type | text/markdown | Static |
| Type | Attestation | Static |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ARWEAVE_WALLET_PATH` | Yes | Path to wallet.json file |
| `ARWEAVE_AUTHOR` | No | Author name for Author tag (omitted if not set) |

## Technical Approach

### SDK Selection: @ardrive/turbo-sdk

**Rationale:**
- Free uploads for files under 100KB
- Instant uploads with guaranteed finalization
- Handles chunked uploads automatically
- More reliable than raw arweave-js for production use

### IPFS CID Generation

Using `multiformats` library:
- **Version:** CIDv1
- **Hash:** SHA-256
- **Codec:** raw

```typescript
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import * as raw from 'multiformats/codecs/raw';

async function generateCID(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const hash = await sha256.digest(bytes);
  return CID.create(1, raw.code, hash).toString();
}
```

### Transaction Logging

**Location:** `~/.arweave-markdown/transactions.jsonl`
**Format:** JSON Lines (one JSON object per line)

```json
{"timestamp":"2025-01-15T12:00:00Z","file":"attestation.md","txId":"abc123...","url":"https://viewblock.io/arweave/tx/abc123...","cid":"bafkrei...","size":1234}
```

### Directory Structure

```
arweave-markdown/
├── commands/
│   └── arweave-markdown.md           # Slash command (explicit invocation only)
├── SKILL.md                          # Skill instructions (NO auto-trigger)
├── scripts/
│   └── upload-to-arweave.ts          # Main upload script
├── README.md                         # Setup and usage documentation
├── package.json                      # Dependencies
├── tsconfig.json                     # TypeScript configuration
└── plans/
    └── arweave-markdown-slash-command.md  # This plan
```

## Acceptance Criteria

### Functional Requirements

- [ ] `/arweave-markdown path/to/file.md` uploads file to Arweave
- [ ] Returns viewblock.io transaction URL on success
- [ ] Applies all six required tags (App-Name, App-Version, Author, IPFS-CID, Content-Type, Type)
- [ ] Logs transaction to `~/.arweave-markdown/transactions.jsonl`
- [ ] Log file excluded from git via documentation in README

### Security Requirements

- [ ] Skill ONLY invocable via explicit `/arweave-markdown` command
- [ ] SKILL.md description contains NO auto-trigger phrases
- [ ] Separate slash command file (`commands/arweave-markdown.md`) handles invocation
- [ ] No accidental uploads from conversation context mentioning "arweave", "permanent", etc.

### Error Handling Requirements

- [ ] Missing wallet: Display setup instructions with wallet generation guide
- [ ] Invalid wallet JSON: Display parsing error with troubleshooting steps
- [ ] File not found: Display clear error with provided path
- [ ] Non-markdown file: Warn but allow upload (user may have valid use case)
- [ ] Network error: Display retry suggestion
- [ ] Insufficient funds (>100KB): Display funding instructions

### Documentation Requirements

- [ ] README includes wallet generation instructions (using arweave-js)
- [ ] README includes environment variable setup for both bash and zsh
- [ ] README includes example usage
- [ ] README includes security best practices for wallet storage

## Implementation Plan

### Phase 1: Project Setup

**Files to create:**

#### package.json

```json
{
  "name": "arweave-markdown",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "upload": "npx tsx scripts/upload-to-arweave.ts"
  },
  "dependencies": {
    "@ardrive/turbo-sdk": "^1.0.0",
    "multiformats": "^13.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "@types/node": "^20.0.0"
  }
}
```

#### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["scripts/**/*"]
}
```

### Phase 2: Core Upload Script

**File:** `scripts/upload-to-arweave.ts`

```typescript
import { ArweaveSigner, TurboFactory } from '@ardrive/turbo-sdk';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import * as raw from 'multiformats/codecs/raw';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface UploadResult {
  transactionId: string;
  viewblockUrl: string;
  arweaveUrl: string;
  ipfsCid: string;
  fileSize: number;
}

async function generateIPFSCID(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const hash = await sha256.digest(bytes);
  return CID.create(1, raw.code, hash).toString();
}

function getWallet(): any {
  const walletPath = process.env.ARWEAVE_WALLET_PATH;
  if (!walletPath) {
    throw new Error(
      'ARWEAVE_WALLET_PATH environment variable not set.\n\n' +
      'To set up your Arweave wallet:\n' +
      '1. Generate a wallet: npx arweave wallet generate > wallet.json\n' +
      '2. Set the environment variable:\n' +
      '   export ARWEAVE_WALLET_PATH="/path/to/wallet.json"\n' +
      '3. Add to ~/.zshrc or ~/.bashrc for persistence'
    );
  }

  if (!fs.existsSync(walletPath)) {
    throw new Error(`Wallet file not found at: ${walletPath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  } catch (e) {
    throw new Error(`Failed to parse wallet JSON: ${(e as Error).message}`);
  }
}

function logTransaction(result: UploadResult, fileName: string): void {
  const logDir = path.join(os.homedir(), '.arweave-markdown');
  const logFile = path.join(logDir, 'transactions.jsonl');

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    file: fileName,
    txId: result.transactionId,
    url: result.viewblockUrl,
    cid: result.ipfsCid,
    size: result.fileSize,
  };

  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
}

async function uploadMarkdown(filePath: string): Promise<UploadResult> {
  // Validate file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Read file content
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileSize = Buffer.byteLength(content, 'utf-8');
  const fileName = path.basename(filePath);

  // Warn if not markdown extension
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.md' && ext !== '.markdown') {
    console.warn(`Warning: File extension "${ext}" is not .md or .markdown`);
  }

  // Generate IPFS CID
  const ipfsCid = await generateIPFSCID(content);
  console.log(`IPFS CID: ${ipfsCid}`);

  // Get wallet
  const jwk = getWallet();

  // Initialize Turbo
  const signer = new ArweaveSigner(jwk);
  const turbo = TurboFactory.authenticated({ signer });

  // Build tags
  const tags = [
    { name: 'Content-Type', value: 'text/markdown' },
    { name: 'App-Name', value: 'Arweave Markdown' },
    { name: 'App-Version', value: '0.0.1' },
    { name: 'Type', value: 'Attestation' },
    { name: 'IPFS-CID', value: ipfsCid },
  ];

  // Add author if provided
  const author = process.env.ARWEAVE_AUTHOR;
  if (author) {
    tags.push({ name: 'Author', value: author });
  }

  console.log(`Uploading ${fileName} (${fileSize} bytes)...`);

  // Upload
  const result = await turbo.uploadSignedDataItem({
    dataItemStreamFactory: () => Buffer.from(content),
    dataItemSizeFactory: () => fileSize,
    signal: AbortSignal.timeout(60000),
  });

  const uploadResult: UploadResult = {
    transactionId: result.id,
    viewblockUrl: `https://viewblock.io/arweave/tx/${result.id}`,
    arweaveUrl: `https://arweave.net/${result.id}`,
    ipfsCid,
    fileSize,
  };

  // Log transaction
  logTransaction(uploadResult, fileName);

  return uploadResult;
}

// Main execution
const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: npm run upload <file-path>');
  process.exit(1);
}

uploadMarkdown(filePath)
  .then((result) => {
    console.log('\n✅ Upload successful!\n');
    console.log(`Transaction ID: ${result.transactionId}`);
    console.log(`View on ViewBlock: ${result.viewblockUrl}`);
    console.log(`Direct Arweave URL: ${result.arweaveUrl}`);
    console.log(`IPFS CID: ${result.ipfsCid}`);
    console.log(`\nTransaction logged to ~/.arweave-markdown/transactions.jsonl`);
  })
  .catch((error) => {
    console.error('\n❌ Upload failed:\n');
    console.error(error.message);
    process.exit(1);
  });
```

### Phase 3: Slash Command (Explicit Invocation Only)

**File:** `commands/arweave-markdown.md`

This is the slash command that users invoke with `/arweave-markdown`. It explicitly calls the skill.

```markdown
---
description: Upload a markdown file to Arweave permanent storage
argument-hint: <file-path>
allowed-tools: Bash(npm:*), Bash(npx:*), Bash(echo:*), Read
---

Upload the specified markdown file to Arweave using the arweave-markdown skill.

File to upload: $ARGUMENTS
```

### Phase 4: Claude Code Skill (No Auto-Trigger)

**File:** `SKILL.md`

**IMPORTANT:** The description intentionally has NO trigger phrases to prevent auto-invocation. This skill is ONLY invoked via the explicit `/arweave-markdown` slash command.

```yaml
---
name: arweave-markdown
description: Internal skill for uploading markdown to Arweave. Invoked only via /arweave-markdown command.
---
```

```xml
<objective>
Upload markdown content to Arweave's permanent, decentralized storage network with proper metadata tags. Returns a viewblock.io transaction URL and logs all uploads locally.

SECURITY: This skill should ONLY be invoked via the explicit /arweave-markdown slash command, never automatically based on conversation context.
</objective>

<quick_start>
1. Ensure ARWEAVE_WALLET_PATH environment variable points to wallet.json
2. Run the upload script with the markdown file path

```bash
cd /Users/rickmanelius/git/rickmanelius/arweave-markdown
npm run upload path/to/file.md
```
</quick_start>

<process>
## Step 1: Confirm User Intent

Before uploading, confirm the user explicitly requested this via /arweave-markdown command.

## Step 2: Check Environment

Verify ARWEAVE_WALLET_PATH is set:

```bash
echo $ARWEAVE_WALLET_PATH
```

If not set, guide user through wallet setup per README.md.

## Step 3: Upload File

Execute the upload script:

```bash
cd /Users/rickmanelius/git/rickmanelius/arweave-markdown
npm run upload <file-path>
```

## Step 4: Report Results

Share with user:
- ViewBlock URL for the transaction
- IPFS CID of the content
- Confirmation that transaction was logged
</process>

<success_criteria>
- Transaction ID returned from Arweave
- viewblock.io URL displayed to user
- Transaction logged to ~/.arweave-markdown/transactions.jsonl
- All required tags applied (App-Name, App-Version, Content-Type, Type, IPFS-CID)
</success_criteria>

<error_handling>
If ARWEAVE_WALLET_PATH not set:
- Direct user to README.md wallet setup section
- Provide quick setup commands

If wallet file not found:
- Verify path is correct
- Check file permissions

If upload fails with network error:
- Suggest retry
- Check internet connection

If upload fails with insufficient funds (files >100KB):
- Direct user to fund wallet with AR tokens
- Suggest https://arweave.org for purchasing AR
</error_handling>
```

### Phase 5: Documentation

**File:** `README.md`

```markdown
# Arweave Markdown

A Claude Code slash command for uploading markdown files to Arweave permanent storage.

## Security Note

This command is **explicit invocation only**. It will NOT automatically trigger when you mention "arweave" or "permanent storage" in conversation. You must explicitly run `/arweave-markdown` to upload anything.

## Quick Start

1. Set up your Arweave wallet (see below)
2. Run: `/arweave-markdown path/to/file.md`
3. Receive your permanent viewblock.io URL

## Installation

```bash
cd /Users/rickmanelius/git/rickmanelius/arweave-markdown
npm install
```

## Wallet Setup

### Generate a New Wallet

```bash
npx -y arweave wallet generate > wallet.json
```

**IMPORTANT: Keep this file secure and never commit it to git!**

### Set Environment Variable

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
export ARWEAVE_WALLET_PATH="/path/to/your/wallet.json"
export ARWEAVE_AUTHOR="Your Name"  # Optional
```

Then reload:

```bash
source ~/.zshrc  # or source ~/.bashrc
```

### Fund Your Wallet (for files >100KB)

Files under 100KB are **free** via Turbo.

For larger files, you need AR tokens:
1. Get your wallet address: `npx arweave wallet address wallet.json`
2. Purchase AR from an exchange
3. Send AR to your wallet address

## Usage

### Via Claude Code

```
/arweave-markdown ./my-document.md
```

### Via Command Line

```bash
npm run upload ./my-document.md
```

## Output

On success:
- ViewBlock transaction URL (e.g., `https://viewblock.io/arweave/tx/abc123...`)
- Direct Arweave URL (e.g., `https://arweave.net/abc123...`)
- IPFS CID of the content

All transactions are logged to `~/.arweave-markdown/transactions.jsonl`

## Tags Applied

| Tag | Value |
|-----|-------|
| App-Name | Arweave Markdown |
| App-Version | 0.0.1 |
| Author | From ARWEAVE_AUTHOR env var |
| IPFS-CID | Calculated from file content |
| Content-Type | text/markdown |
| Type | Attestation |

## Security Best Practices

- **Never commit wallet.json to version control**
- Store wallet in a secure location outside your project
- Back up wallet.json to multiple secure locations
- Consider using a hardware wallet for large holdings

## Troubleshooting

### "ARWEAVE_WALLET_PATH not set"

Set the environment variable pointing to your wallet.json file.

### "Wallet file not found"

Check that the path in ARWEAVE_WALLET_PATH is correct and the file exists.

### "Insufficient funds"

Files over 100KB require AR tokens. Fund your wallet address with AR.

### Network errors

Check your internet connection and retry. Arweave uploads may take a moment.

## Transaction Log

All uploads are logged to `~/.arweave-markdown/transactions.jsonl`:

```json
{"timestamp":"2025-01-15T12:00:00Z","file":"doc.md","txId":"abc...","url":"https://viewblock.io/arweave/tx/abc...","cid":"bafkrei...","size":1234}
```

## License

MIT
```

## Success Metrics

- Successful upload returns viewblock.io URL
- Transaction visible on block explorer within minutes
- Markdown renders correctly when accessed via `arweave.net/{txId}`
- Transaction logged to local file

## Dependencies & Risks

### Dependencies

- Node.js 18+
- npm packages: @ardrive/turbo-sdk, multiformats, tsx
- Valid Arweave wallet with funds (for files >100KB)

### Risks

| Risk | Mitigation |
|------|------------|
| Turbo SDK API changes | Pin version in package.json |
| Network outages | Include retry guidance in error messages |
| Wallet security | Document best practices in README |
| Cost for large files | Clear documentation about 100KB free tier |

## References & Research

### Internal References
- Example transaction: https://viewblock.io/arweave/tx/nu-nv3Nyl0S8D4zxjDV7Nae8VLSQe6483eyt1tLZJfQ

### External References
- [ArDrive Turbo SDK](https://github.com/ardriveapp/turbo-sdk)
- [arweave-js SDK](https://github.com/ArweaveTeam/arweave-js)
- [Arweave Tag Standards BP-105](https://github.com/ArweaveTeam/arweave-standards/blob/master/best-practices/BP-105.md)
- [multiformats npm](https://www.npmjs.com/package/multiformats)
- [Permaweb Cookbook](https://cookbook.arweave.net/)

### Claude Code Skill References
- Skill structure guide: `~/.claude/plugins/marketplaces/every-marketplace/plugins/compound-engineering/skills/create-agent-skills/`
