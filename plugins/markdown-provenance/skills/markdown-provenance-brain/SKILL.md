---
name: markdown-provenance-brain
description: Internal skill for syncing agent brain to Arweave. Invoked only via /markdown-provenance-brain command.
---

<objective>
Sync the agent brain file to Arweave permanent storage and update the ArNS name pointer. The brain is a self-bootstrapping markdown file containing agent identity, instructions, and provenance transaction history. Any agent can fetch the brain from the ArNS URL and fully reconstitute.

SECURITY: This skill should ONLY be invoked via the explicit /markdown-provenance-brain slash command, never automatically based on conversation context.
</objective>

<quick_start>

1. Ensure MP_WALLET_PATH environment variable points to wallet.json
2. Ensure MP_ARNS_NAME environment variable is set to your registered ArNS name
3. Run the brain-sync script

```bash
cd "${CLAUDE_PLUGIN_ROOT}"
npm run brain-sync
```

</quick_start>

<process>
## Step 1: Confirm User Intent

Before syncing, confirm the user explicitly requested this via /markdown-provenance-brain command. Never auto-trigger based on conversation about agents or brain files.

## Step 2: Check Environment and Guide Setup

Check all required environment variables and files. If anything is missing, walk the user through setup **before** attempting to sync.

```bash
echo "MP_WALLET_PATH: $MP_WALLET_PATH"
echo "MP_ARNS_NAME: $MP_ARNS_NAME"
```

**If MP_WALLET_PATH is not set or wallet doesn't exist:**

1. Ask if they already have an Arweave wallet
2. If not, generate one:
   ```bash
   cd "${CLAUDE_PLUGIN_ROOT}" && npm run generate-wallet
   ```
3. Guide them to set the env var:
   ```bash
   export MP_WALLET_PATH="$HOME/.arweave/wallet.json"
   ```

**If MP_ARNS_NAME is not set:**

1. First, show the user their wallet's public address so they know which address needs to be an owner/controller:
   ```bash
   cd "${CLAUDE_PLUGIN_ROOT}" && npx tsx -e "import Arweave from 'arweave'; import fs from 'fs'; const jwk = JSON.parse(fs.readFileSync(process.env.MP_WALLET_PATH, 'utf-8')); const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' }); arweave.wallets.jwkToAddress(jwk).then(a => console.log('Wallet address:', a));"
   ```
2. Ask the user for their ArNS name
3. Explain: they must have already registered the name at https://arns.ar.io
4. Explain: their wallet address (shown above) must be an **owner** or **controller** of the name's ANT (Arweave Name Token) process. If they registered the name with a different wallet, they need to add this wallet address as a controller at https://arns.ar.io under the name's settings
5. Guide them to set the env var:
   ```bash
   export MP_ARNS_NAME="theirname"
   ```

**Check for brain-instructions.md:**

```bash
cat ~/.markdown-provenance/brain-instructions.md 2>/dev/null || echo "NOT FOUND"
```

If not found, ask the user if they'd like to create one now. This file contains the agent's identity, personality, and directives — the "soul" of the brain. Offer to help them draft it based on their description of what the agent should be.

## Step 3: Run Brain Sync

Once all prerequisites are confirmed:

```bash
cd "${CLAUDE_PLUGIN_ROOT}"
npm run brain-sync
```

## Step 4: Report Results

Share with user:

- ArNS URL (https://name.ar.io)
- Direct Arweave URL for the brain file
- IPFS CID of the brain
- Number of provenance transactions included
- Confirmation that brain version was logged to ~/.markdown-provenance/brain-versions.jsonl
- Remind them that future `/markdown-provenance` uploads will auto-sync the brain
  </process>

<brain_file_contents>
The brain file is a self-bootstrapping markdown document containing:

| Section                        | Contents                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------- |
| Identity                       | ArNS name, URL, wallet address, last updated                                      |
| Instructions                   | User-defined agent instructions from ~/.markdown-provenance/brain-instructions.md |
| How to Use This Brain          | Bootstrap instructions for any agent                                              |
| Provenance Transaction History | Table of all uploads from transactions.jsonl (max 200 most recent)                |
| Previous Brain Versions        | Table of all brain uploads from brain-versions.jsonl                              |

</brain_file_contents>

<configuration>
| File | Purpose |
|------|---------|
| ~/.markdown-provenance/brain-instructions.md | User-written agent instructions (create manually) |
| ~/.markdown-provenance/brain-versions.jsonl | Auto-maintained log of brain uploads |
| ~/.markdown-provenance/transactions.jsonl | Existing upload transaction log |
</configuration>

<tags_applied>
The following tags are applied to brain uploads:

| Tag | Value |
|-----|-------|
| Content-Type | text/markdown |
| App-Name | Markdown Provenance |
| App-Version | 0.0.1 |
| Type | Agent-Brain |
| ArNS-Name | (from MP_ARNS_NAME) |
| IPFS-CID | (calculated from content) |
</tags_applied>

<success_criteria>

- Brain markdown generated with current transaction history
- Brain uploaded to Arweave (TX ID returned)
- Brain version logged to ~/.markdown-provenance/brain-versions.jsonl
- ArNS record updated to point to new brain TX
- Brain accessible at https://name.ar.io
  </success_criteria>

<error_handling>
If MP_WALLET_PATH not set:

- Direct user to wallet setup instructions

If MP_ARNS_NAME not set:

- Explain they need a registered ArNS name
- Point to https://arns.ar.io for registration
- Their wallet (MP_WALLET_PATH) must be an owner or controller of the name's ANT process
- Show: export MP_ARNS_NAME="yourname"

If brain upload fails:

- Show error and suggest retry
- Check internet connection

If ArNS update fails after successful upload:

- The brain IS on Arweave (show TX URL)
- Only the ArNS pointer failed to update
- Suggest retry: /markdown-provenance-brain

If brain-instructions.md not found:

- Brain will be generated with a placeholder message
- Instruct user to create ~/.markdown-provenance/brain-instructions.md
  </error_handling>
