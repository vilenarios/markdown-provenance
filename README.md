# Markdown Provenance

A Claude Code slash command for uploading markdown files to Arweave permanent storage.

## Why Provenance Matters

In an age where AI generates millions of pieces of content daily, proving the authenticity and origin of your work has never been more important. **Strong provenance** means your content has four cryptographically verifiable properties: it's **permanent** (cannot be deleted or altered), **precisely timestamped** (proving exactly when it was created), **signed** (your wallet's cryptographic signature proves you uploaded it), and **unconstrained** (anyone can verify it). By uploading your markdown to Arweave, you anchor something ephemeral into the real time domain with assurances around permanence—proving you authored this content at this specific moment, before anyone else could copy, modify, or claim it.

This matters whether you're a writer establishing priority over your ideas, a researcher documenting findings, or anyone who needs to prove "I wrote this first." As deepfakes proliferate and AI-generated content becomes indistinguishable from human work, having a tamper-proof timestamp on the blockchain provides the receipts you need. Think of it as a digital notary—permanent, global, and cryptographically secure.

### Learn More About Content Provenance

- [Content Authenticity Initiative](https://contentauthenticity.org/) — Cross-industry coalition (Adobe, NYT, BBC, Microsoft) building open standards for content provenance
- [C2PA Technical Standard](https://c2pa.org/) — The open specification for Content Credentials
- [Deepfakes and Elections: Content Credentials Fight Back](https://spectrum.ieee.org/deepfakes-election) — IEEE Spectrum
- [How Google and C2PA Are Increasing Transparency](https://blog.google/technology/ai/google-gen-ai-content-transparency-c2pa/) — Google Blog
- [AI Deepfakes Are a 'Solvable Problem'](https://fortune.com/2025/12/27/alex-bores-ai-deepfakes-solvable-problem-c2pa-free-open-source-standard/) — Fortune

## Security Note

This command is **explicit invocation only**. It will NOT automatically trigger when you mention "arweave" or "permanent storage" in conversation. You must explicitly run `/markdown-provenance` to upload anything.

## Quick Start

1. Install the plugin (see Installation below)
2. Set up your Arweave wallet (see Wallet Setup below)
3. Run: `/markdown-provenance path/to/file.md`
4. Receive your permanent viewblock.io URL

## Installation

### Via Claude Code Plugin Marketplace (Recommended)

```bash
# Add the marketplace (one-time)
/plugin marketplace add https://github.com/rickmanelius/markdown-provenance

# Install the plugin
/plugin install markdown-provenance
```

After installation, install npm dependencies:

```bash
# Find and install dependencies in the plugin directory
cd ~/.claude/plugins/cache/markdown-provenance/markdown-provenance/*/  && npm install
```

Or if that path doesn't work, find it with:

```bash
find ~/.claude/plugins/cache -name "package.json" -path "*markdown-provenance*" -exec dirname {} \; | head -1 | xargs -I {} sh -c 'cd {} && npm install'
```

### Via Git Clone (Alternative)

```bash
git clone https://github.com/rickmanelius/markdown-provenance.git
cd markdown-provenance/plugins/markdown-provenance
npm install

# Symlink the plugin to Claude plugins directory
ln -s "$(pwd)" ~/.claude/plugins/markdown-provenance
```

## Wallet Setup

### Generate a New Wallet

```bash
npx -y arweave wallet generate > wallet.json
```

**IMPORTANT: Keep this file secure and never commit it to git!**

### Set Environment Variables

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
export MP_WALLET_PATH="/path/to/your/wallet.json"
export MP_AUTHOR="Your Name"  # Optional - adds Author tag to uploads
```

Then reload your shell:

```bash
source ~/.zshrc  # or source ~/.bashrc
```

### Fund Your Wallet (for files >100KB)

Files under 100KB are **FREE** via Turbo.

For larger files, you need AR tokens:

1. Get your wallet address:
   ```bash
   npx arweave wallet address wallet.json
   ```

2. Purchase AR from an exchange (Binance, Gate.io, etc.)

3. Send AR to your wallet address

## Usage

### Via Claude Code

```
/markdown-provenance ./my-document.md
```

### Via Command Line

```bash
cd /path/to/markdown-provenance
npm run upload ./my-document.md
```

Or directly:

```bash
npx tsx /path/to/markdown-provenance/scripts/upload-to-arweave.ts ./my-document.md
```

### Options

All options are optional and can be combined:

```bash
npm run upload ./doc.md --author "Jane Doe" --fileName "my-article" --source "https://example.com/original"
```

| Option | Description |
|--------|-------------|
| `--author "Name"` | Override the `MP_AUTHOR` environment variable |
| `--fileName "name"` | Add a `File-Name` tag for easier lookup on Arweave |
| `--source "URL"` | Add a `Source` tag referencing the origin URL or URI |

## Output

On success, you'll receive:

- **ViewBlock URL**: `https://viewblock.io/arweave/tx/abc123...` (block explorer)
- **Direct Arweave URL**: `https://arweave.net/abc123...` (raw content)
- **IPFS CID**: Content identifier for the uploaded file

All transactions are logged to `~/.markdown-provenance/transactions.jsonl`

## Deduplication

Before uploading, Markdown Provenance checks if the exact content already exists on Arweave:

1. **Local log check** (fast) - Searches your `~/.markdown-provenance/transactions.jsonl` for matching IPFS CID
2. **Arweave GraphQL query** - Queries the Arweave network for transactions with the same `IPFS-CID` tag

If the content already exists, you'll receive the existing transaction details without creating a duplicate upload. This saves costs and avoids redundant data on the permaweb.

## Tags Applied

Each upload includes these metadata tags:

| Tag | Value |
|-----|-------|
| App-Name | Markdown Provenance |
| App-Version | 0.0.1 |
| Author | From `MP_AUTHOR` env var or `--author` flag (if set) |
| File-Name | From `--fileName` flag (if set) |
| Source | From `--source` flag (if set) |
| IPFS-CID | Calculated from file content (CIDv1, SHA-256) |
| Content-Type | text/markdown |
| Type | Attestation |

## Security Best Practices

- **Never commit wallet.json to version control**
- Store wallet in a secure location outside your project (e.g., `~/.arweave/wallet.json`)
- Back up wallet.json to multiple secure locations
- Consider using a hardware wallet for large holdings
- The `MP_WALLET_PATH` environment variable should point to this secure location

## Troubleshooting

### "MP_WALLET_PATH not set"

Set the environment variable pointing to your wallet.json file:

```bash
export MP_WALLET_PATH="/path/to/wallet.json"
```

### "Wallet file not found"

Check that the path in `MP_WALLET_PATH` is correct and the file exists:

```bash
ls -la $MP_WALLET_PATH
```

### "Insufficient funds"

Files over 100KB require AR tokens. Fund your wallet address with AR:

```bash
# Get your wallet address
npx arweave wallet address $MP_WALLET_PATH
```

### Network errors

Check your internet connection and retry. Arweave uploads may take a moment.

### "/markdown-provenance not found"

Make sure you've registered the skill with Claude Code (see "Registering with Claude Code" section above).

## Transaction Log

All uploads are logged to `~/.markdown-provenance/transactions.jsonl`:

```json
{"timestamp":"2025-01-15T12:00:00Z","file":"doc.md","txId":"abc...","url":"https://viewblock.io/arweave/tx/abc...","cid":"bafkrei...","size":1234}
```

You can view your transaction history:

```bash
cat ~/.markdown-provenance/transactions.jsonl
```

Or get a count:

```bash
wc -l ~/.markdown-provenance/transactions.jsonl
```

## How It Works

1. **File Reading**: The script reads your markdown file
2. **CID Generation**: Calculates an IPFS-compatible CID (CIDv1, SHA-256, raw codec)
3. **Transaction Creation**: Creates an Arweave transaction with proper tags
4. **Upload**: Uses ArDrive Turbo SDK for reliable, fast uploads
5. **Logging**: Records the transaction in your local log file

## References

- [Arweave](https://arweave.org) - Permanent data storage
- [ArDrive Turbo SDK](https://github.com/ardriveapp/turbo-sdk) - Upload library
- [ViewBlock](https://viewblock.io/arweave) - Arweave block explorer
- [Permaweb Cookbook](https://cookbook.arweave.net/) - Developer resources

## Acknowledgments

A huge thank you to the [ArDrive](https://ardrive.io) community for providing **free uploads for files under 100KB** through their Turbo SDK. This generous offering makes permanent, decentralized storage accessible to everyone and is what makes this tool practical for everyday use. Their commitment to lowering barriers to the permaweb is what enables projects like Markdown Provenance to exist.

## License

MIT
