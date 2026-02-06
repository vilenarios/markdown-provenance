# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A Claude Code plugin providing the `/markdown-provenance` slash command for uploading markdown files to Arweave permanent storage. Generates IPFS-compatible CIDs and deduplicates uploads via local log + Arweave GraphQL.

## Tech Stack

- TypeScript with ESM modules, run via `tsx` (no build step)
- Node.js 18+
- ArDrive Turbo SDK (`@ardrive/turbo-sdk`) for Arweave uploads
- ar.io SDK (`@ar.io/sdk`) for ArNS name resolution and ANT record updates
- Arbundles for data item signing
- Multiformats for IPFS CID generation (CIDv1, SHA-256, raw codec)

## Development Commands

All npm commands run from `plugins/markdown-provenance/`:

```bash
cd plugins/markdown-provenance
npm install                                          # Install dependencies
npm run upload <file.md>                             # Upload markdown to Arweave
npm run upload <file.md> --author "Name"             # With author override
npm run upload <file.md> --fileName "name"           # With File-Name tag
npm run upload <file.md> --source "https://..."      # With Source tag
npm run generate-wallet                              # Create new Arweave wallet
npm run viewer                                       # Open transaction viewer in browser
npm run brain-sync                                   # Sync agent brain to Arweave + update ArNS
```

Root-level script:
```bash
node scripts/generate-llms-txt.js                    # Regenerate llms.txt from README
```

No linter, formatter, or test suite is configured.

## Architecture

The repo has a **two-level structure**: root contains plugin marketplace metadata, README, and llms.txt generation; the actual plugin lives under `plugins/markdown-provenance/`.

### Plugin internals (`plugins/markdown-provenance/`)

- **`scripts/lib/arweave-utils.ts`** — Shared upload utilities: wallet loading, IPFS CID generation, dedup checks, Turbo upload, transaction logging. Used by both the upload and brain-sync scripts.
- **`scripts/upload-to-arweave.ts`** — CLI entry point for `npm run upload`. Parses args, calls `uploadMarkdown()` from the shared lib, and auto-triggers brain sync if `MP_ARNS_NAME` is set.
- **`scripts/generate-wallet.ts`** — Creates a new Arweave wallet at a specified path (default `~/.arweave/wallet.json`) with restricted file permissions (0o600).
- **`scripts/open-viewer.js`** — Reads `~/.markdown-provenance/transactions.jsonl`, injects data into `viewer/index.html`, writes `viewer/index-loaded.html`, and opens it in a browser.
- **`viewer/index.html`** — Self-contained web UI for viewing transaction history with drag-and-drop upload, sortable table, and Arweave GraphQL tag fetching.
- **`commands/markdown-provenance.md`** — Claude Code slash command definition. Specifies allowed tools and runs `npm run upload` with user arguments.
- **`scripts/brain-sync.ts`** — Agent Brain feature. Generates a self-bootstrapping brain markdown (identity + instructions + transaction history), uploads to Arweave, and updates the ArNS pointer via ar.io SDK. Exports `syncBrain()` for auto-sync from uploads.
- **`skills/markdown-provenance/SKILL.md`** — Skill definition with security constraints. The skill ONLY activates on explicit `/markdown-provenance` invocation, never automatically.
- **`commands/markdown-provenance-brain.md`** and **`skills/markdown-provenance-brain/SKILL.md`** — Slash command and skill for manual brain sync via `/markdown-provenance-brain`.

### Root level

- **`.claude-plugin/plugin.json`** and **`.claude-plugin/marketplace.json`** — Plugin marketplace metadata.
- **`scripts/generate-llms-txt.js`** — Generates `llms.txt` and `llms-full.txt` from README following the llmstxt.org standard.

## Environment Variables

Required:
- `MP_WALLET_PATH` — Absolute path to Arweave wallet.json file

Optional:
- `MP_AUTHOR` — Default author name (can be overridden with `--author` flag)
- `MP_ARNS_NAME` — Registered ArNS name for Agent Brain feature (e.g., `domino`). When set, brain auto-syncs on each provenance upload

## Key Behaviors

- Files under 100KB upload free via Turbo
- Deduplication flow: check local log (`~/.markdown-provenance/transactions.jsonl`) first, then query Arweave GraphQL by IPFS CID
- Tags applied to uploads: Content-Type, App-Name, App-Version, Type, IPFS-CID, and optionally Author, File-Name, Source
- Transaction log is append-only JSONL at `~/.markdown-provenance/transactions.jsonl`
- Agent Brain: self-bootstrapping markdown uploaded to Arweave with ArNS pointer. Contains agent identity, instructions (from `~/.markdown-provenance/brain-instructions.md`), and transaction history. Brain versions logged to `~/.markdown-provenance/brain-versions.jsonl`

## Security

- Never commit wallet.json to git (already in .gitignore)
- The `/markdown-provenance` slash command must only trigger on explicit user invocation, never automatically
