---
description: Sync agent brain to Arweave and update ArNS pointer
argument-hint: (no arguments required)
allowed-tools: Bash(npm:*), Bash(npx:*), Bash(cd:*), Bash(echo:*), Read
---

Sync the agent brain to Arweave permanent storage and update the ArNS name pointer.

**Arguments:** $ARGUMENTS

## Process

1. Check that MP_WALLET_PATH environment variable is set
2. Check that MP_ARNS_NAME environment variable is set
3. Run the brain-sync script from the markdown-provenance plugin directory
4. Report the ArNS URL and Arweave TX to the user

## Commands

```bash
# Navigate to the plugin directory and run brain-sync
cd "${CLAUDE_PLUGIN_ROOT}" && npm run brain-sync
```

## On Success

Report to user:
- ArNS URL (e.g., https://name.ar.io)
- Arweave TX URL for the brain file
- IPFS CID of the brain
- Number of transactions included in the brain
- Confirmation that brain version was logged

## On Error

If MP_WALLET_PATH not set, show wallet setup instructions from README.md.
If MP_ARNS_NAME not set, explain that the user needs a registered ArNS name and that their wallet (MP_WALLET_PATH) must be an owner or controller of the name's ANT process. Show: `export MP_ARNS_NAME="yourname"`
If brain upload succeeds but ArNS update fails, explain the brain is on Arweave but the pointer wasn't updated, and suggest retry with `/markdown-provenance-brain`.
