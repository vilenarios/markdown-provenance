import { ANT, ARIO } from '@ar.io/sdk/node';
import { ArweaveSigner } from '@ar.io/sdk/node';
import Arweave from 'arweave';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import {
  getWallet,
  uploadContent,
  type LogEntry,
  type UploadResult,
} from './lib/arweave-utils.js';

const CONFIG_DIR = path.join(os.homedir(), '.markdown-provenance');
const TRANSACTIONS_FILE = path.join(CONFIG_DIR, 'transactions.jsonl');
const BRAIN_INSTRUCTIONS_FILE = path.join(CONFIG_DIR, 'brain-instructions.md');
const BRAIN_VERSIONS_FILE = path.join(CONFIG_DIR, 'brain-versions.jsonl');
const MAX_TRANSACTIONS_IN_BRAIN = 200;
const DEFAULT_ARNS_TTL_SECONDS = 300; // 5 minutes

interface BrainVersionEntry {
  timestamp: string;
  txId: string;
  arweaveUrl: string;
  ipfsCid: string;
  size: number;
  transactionCount: number;
}

async function getWalletAddress(jwk: any): Promise<string> {
  const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });
  return arweave.wallets.jwkToAddress(jwk);
}

function readTransactionHistory(): LogEntry[] {
  if (!fs.existsSync(TRANSACTIONS_FILE)) {
    return [];
  }

  const lines = fs.readFileSync(TRANSACTIONS_FILE, 'utf-8').trim().split('\n');
  const entries: LogEntry[] = [];

  for (const line of lines) {
    if (!line) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}

function readBrainInstructions(): string {
  if (!fs.existsSync(BRAIN_INSTRUCTIONS_FILE)) {
    return '_No instructions configured yet. Create `~/.markdown-provenance/brain-instructions.md` to add your agent instructions._';
  }
  return fs.readFileSync(BRAIN_INSTRUCTIONS_FILE, 'utf-8');
}

function readBrainVersions(): BrainVersionEntry[] {
  if (!fs.existsSync(BRAIN_VERSIONS_FILE)) {
    return [];
  }

  const lines = fs.readFileSync(BRAIN_VERSIONS_FILE, 'utf-8').trim().split('\n');
  const entries: BrainVersionEntry[] = [];

  for (const line of lines) {
    if (!line) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}

function generateBrainMarkdown(options: {
  arnsName: string;
  walletAddress: string;
  transactions: LogEntry[];
  brainVersions: BrainVersionEntry[];
  instructions: string;
}): string {
  const { arnsName, walletAddress, transactions, brainVersions, instructions } = options;
  const now = new Date().toISOString();
  const latestBrainTx = brainVersions.length > 0
    ? brainVersions[brainVersions.length - 1].txId
    : '_first version_';

  let md = `# Agent Brain: ${arnsName}\n\n`;
  md += `> This is a self-bootstrapping agent brain stored on Arweave.\n`;
  md += `> To activate: fetch this file and follow the instructions below.\n\n`;

  // Identity section
  md += `## Identity\n\n`;
  md += `- **ArNS Name:** ${arnsName}\n`;
  md += `- **ArNS URL:** https://${arnsName}.ar.io\n`;
  md += `- **Wallet Address:** ${walletAddress}\n`;
  md += `- **Last Updated:** ${now}\n`;
  md += `- **Previous Brain TX:** ${latestBrainTx}\n\n`;

  // Instructions section
  md += `## Instructions\n\n`;
  md += instructions + '\n\n';

  // Bootstrap section
  md += `## How to Use This Brain\n\n`;
  md += `1. Install the markdown-provenance plugin\n`;
  md += `2. Set environment variables:\n`;
  md += `   - \`MP_WALLET_PATH\` — path to the Arweave wallet\n`;
  md += `   - \`MP_ARNS_NAME\` — set to \`${arnsName}\`\n`;
  md += `3. Upload new content: \`/markdown-provenance <file>\`\n`;
  md += `4. Brain updates automatically with each upload\n`;
  md += `5. Manual sync: \`/markdown-provenance-brain\`\n\n`;

  // Transaction history table
  md += `## Provenance Transaction History\n\n`;
  if (transactions.length === 0) {
    md += `_No transactions yet._\n\n`;
  } else {
    const showTransactions = transactions.slice(-MAX_TRANSACTIONS_IN_BRAIN).reverse();
    if (transactions.length > MAX_TRANSACTIONS_IN_BRAIN) {
      md += `_Showing ${MAX_TRANSACTIONS_IN_BRAIN} most recent of ${transactions.length} total transactions._\n\n`;
    }
    md += `| Date | File | Size | Arweave TX | IPFS CID |\n`;
    md += `|------|------|------|------------|----------|\n`;
    for (const tx of showTransactions) {
      const date = tx.timestamp.split('T')[0];
      const shortTx = tx.txId.substring(0, 12) + '...';
      const shortCid = tx.cid.substring(0, 16) + '...';
      md += `| ${date} | ${tx.file} | ${tx.size} | [${shortTx}](https://arweave.net/${tx.txId}) | ${shortCid} |\n`;
    }
    md += '\n';
  }

  // Brain versions table
  md += `## Previous Brain Versions\n\n`;
  if (brainVersions.length === 0) {
    md += `_This is the first brain version._\n\n`;
  } else {
    md += `| Date | Arweave TX |\n`;
    md += `|------|------------|\n`;
    for (const ver of brainVersions) {
      const date = ver.timestamp.split('T')[0];
      const shortTx = ver.txId.substring(0, 12) + '...';
      md += `| ${date} | [${shortTx}](https://arweave.net/${ver.txId}) |\n`;
    }
    md += '\n';
  }

  return md;
}

function logBrainVersion(result: UploadResult, transactionCount: number): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const entry: BrainVersionEntry = {
    timestamp: new Date().toISOString(),
    txId: result.transactionId,
    arweaveUrl: result.arweaveUrl,
    ipfsCid: result.ipfsCid,
    size: result.fileSize,
    transactionCount,
  };

  fs.appendFileSync(BRAIN_VERSIONS_FILE, JSON.stringify(entry) + '\n');
}

async function updateArNSRecord(arnsName: string, transactionId: string): Promise<string> {
  const jwk = getWallet();

  // Look up the ArNS name to get the ANT process ID
  const ario = ARIO.init();
  const record = await ario.getArNSRecord({ name: arnsName });

  if (!record) {
    throw new Error(
      `ArNS name "${arnsName}" not found. ` +
      `Make sure the name is registered at https://arns.ar.io`
    );
  }

  const processId = record.processId;

  // Initialize ANT with signer for write access
  const signer = new ArweaveSigner(jwk);
  const ant = ANT.init({ signer, processId });

  // Update the root record (@) to point to the new brain TX
  const ttl = process.env.MP_ARNS_TTL
    ? parseInt(process.env.MP_ARNS_TTL, 10)
    : DEFAULT_ARNS_TTL_SECONDS;
  const { id: txId } = await ant.setRecord({
    undername: '@',
    transactionId,
    ttlSeconds: ttl,
  });

  return txId;
}

export async function syncBrain(): Promise<UploadResult> {
  // Check required env vars
  const arnsName = process.env.MP_ARNS_NAME;
  if (!arnsName) {
    throw new Error(
      'MP_ARNS_NAME environment variable not set.\n\n' +
      'Set it to your registered ArNS name:\n' +
      '  export MP_ARNS_NAME="yourname"\n\n' +
      'Register a name at https://arns.ar.io if you haven\'t already.\n' +
      'Your wallet (MP_WALLET_PATH) must be an owner or controller of the ArNS name\'s ANT process.'
    );
  }

  // Get wallet and derive public address
  const jwk = getWallet();
  const walletAddress = await getWalletAddress(jwk);

  // Gather data
  const transactions = readTransactionHistory();
  const brainVersions = readBrainVersions();
  const instructions = readBrainInstructions();

  // Generate brain markdown
  console.log('Generating brain file...');
  const brainMarkdown = generateBrainMarkdown({
    arnsName,
    walletAddress,
    transactions,
    brainVersions,
    instructions,
  });

  console.log(`Wallet address: ${walletAddress}`);
  console.log(`Brain file: ${Buffer.byteLength(brainMarkdown, 'utf-8')} bytes, ${transactions.length} transactions`);

  // Upload to Arweave (skip dedup — brain changes every time)
  console.log('Uploading brain to Arweave...');
  const uploadResult = await uploadContent({
    content: brainMarkdown,
    fileName: `brain-${arnsName}.md`,
    tags: [
      { name: 'Content-Type', value: 'text/markdown' },
      { name: 'App-Name', value: 'Markdown Provenance' },
      { name: 'App-Version', value: '0.0.1' },
      { name: 'Type', value: 'Agent-Brain' },
      { name: 'ArNS-Name', value: arnsName },
    ],
    skipDedup: true,
  });

  // Log brain version
  logBrainVersion(uploadResult, transactions.length);

  console.log(`\nBrain uploaded: ${uploadResult.arweaveUrl}`);
  console.log(`IPFS CID: ${uploadResult.ipfsCid}`);

  // Update ArNS record
  console.log(`\nUpdating ArNS record for ${arnsName}.ar.io...`);
  try {
    const arnsUpdateTxId = await updateArNSRecord(arnsName, uploadResult.transactionId);
    console.log(`ArNS updated! TX: ${arnsUpdateTxId}`);
    console.log(`Brain accessible at: https://${arnsName}.ar.io`);
  } catch (error) {
    // ArNS update failure is non-fatal — brain is already on Arweave
    console.error(`\nWarning: ArNS update failed: ${(error as Error).message}`);
    console.error('The brain was uploaded successfully to Arweave, but the ArNS pointer was not updated.');
    console.error(`Brain TX: ${uploadResult.transactionId}`);
    console.error('\nCommon causes:');
    console.error(`  - Your wallet (${walletAddress}) is not an owner or controller of the ArNS name's ANT process`);
    console.error('    Add it as a controller at https://arns.ar.io under your name\'s settings');
    console.error('  - The ArNS name is not registered or has expired');
    console.error('  - Network connectivity issue (retry with: npm run brain-sync)');
  }

  return uploadResult;
}

// Run when executed directly (not imported)
const __filename = fileURLToPath(import.meta.url);
const isMain = path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMain) {
  syncBrain()
    .then((result) => {
      console.log('\n✅ Brain sync complete!');
      console.log(`TX: ${result.transactionId}`);
      console.log(`CID: ${result.ipfsCid}`);
      console.log(`Size: ${result.fileSize} bytes`);
    })
    .catch((error) => {
      console.error('\n❌ Brain sync failed:\n');
      console.error(error.message);
      process.exit(1);
    });
}
