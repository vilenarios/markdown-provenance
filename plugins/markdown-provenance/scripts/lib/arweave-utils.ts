import { ArweaveSigner, TurboFactory } from '@ardrive/turbo-sdk';
import { createData, ArweaveSigner as ArbundlesSigner } from 'arbundles';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import * as raw from 'multiformats/codecs/raw';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface UploadResult {
  transactionId: string;
  viewblockUrl: string;
  arweaveUrl: string;
  ipfsCid: string;
  fileSize: number;
  alreadyExists: boolean;
  source?: 'local' | 'arweave';
}

export interface LogEntry {
  timestamp: string;
  file: string;
  txId: string;
  url: string;
  cid: string;
  size: number;
}

export interface UploadOptions {
  authorOverride?: string;
  fileName?: string;
  source?: string;
}

interface ArweaveGraphQLResponse {
  data: {
    transactions: {
      edges: Array<{
        node: {
          id: string;
          tags: Array<{ name: string; value: string }>;
        };
      }>;
    };
  };
}

export async function generateIPFSCID(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const hash = await sha256.digest(bytes);
  return CID.create(1, raw.code, hash).toString();
}

export function checkLocalLog(ipfsCid: string): LogEntry | null {
  const logFile = path.join(os.homedir(), '.markdown-provenance', 'transactions.jsonl');

  if (!fs.existsSync(logFile)) {
    return null;
  }

  const lines = fs.readFileSync(logFile, 'utf-8').trim().split('\n');

  for (const line of lines) {
    if (!line) continue;
    try {
      const entry: LogEntry = JSON.parse(line);
      if (entry.cid === ipfsCid) {
        return entry;
      }
    } catch {
      // Skip malformed lines
    }
  }

  return null;
}

export async function checkArweaveForCID(ipfsCid: string): Promise<{ txId: string } | null> {
  const query = `
    query {
      transactions(
        tags: [
          { name: "IPFS-CID", values: ["${ipfsCid}"] }
        ]
        first: 1
      ) {
        edges {
          node {
            id
            tags {
              name
              value
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://arweave.net/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.warn('Warning: Could not query Arweave GraphQL endpoint');
      return null;
    }

    const result = await response.json() as ArweaveGraphQLResponse;
    const edges = result.data?.transactions?.edges;

    if (edges && edges.length > 0) {
      return { txId: edges[0].node.id };
    }

    return null;
  } catch (error) {
    console.warn('Warning: Error querying Arweave:', (error as Error).message);
    return null;
  }
}

export function getWallet(): any {
  const walletPath = process.env.MP_WALLET_PATH;
  if (!walletPath) {
    throw new Error(
      'MP_WALLET_PATH environment variable not set.\n\n' +
      'To set up your Arweave wallet:\n' +
      '1. Generate a wallet: npx -y arweave wallet generate > wallet.json\n' +
      '2. Set the environment variable:\n' +
      '   export MP_WALLET_PATH="/path/to/wallet.json"\n' +
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

export function logTransaction(result: UploadResult, fileName: string): void {
  const logDir = path.join(os.homedir(), '.markdown-provenance');
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

export async function uploadMarkdown(filePath: string, options: UploadOptions = {}): Promise<UploadResult> {
  // Resolve to absolute path
  const absolutePath = path.resolve(filePath);

  // Validate file exists
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  // Read file content
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const fileSize = Buffer.byteLength(content, 'utf-8');
  const fileName = path.basename(absolutePath);

  // Warn if not markdown extension
  const ext = path.extname(absolutePath).toLowerCase();
  if (ext !== '.md' && ext !== '.markdown') {
    console.warn(`Warning: File extension "${ext}" is not .md or .markdown`);
  }

  // Generate IPFS CID
  console.log('Calculating IPFS CID...');
  const ipfsCid = await generateIPFSCID(content);
  console.log(`IPFS CID: ${ipfsCid}`);

  // Check if this content was already uploaded (local log first, then Arweave)
  console.log('\nChecking for existing upload...');

  // Check local log first (faster)
  const localEntry = checkLocalLog(ipfsCid);
  if (localEntry) {
    console.log('Found existing upload in local log.');
    return {
      transactionId: localEntry.txId,
      viewblockUrl: localEntry.url,
      arweaveUrl: `https://arweave.net/${localEntry.txId}`,
      ipfsCid: localEntry.cid,
      fileSize: localEntry.size,
      alreadyExists: true,
      source: 'local',
    };
  }

  // Check Arweave GraphQL
  const arweaveEntry = await checkArweaveForCID(ipfsCid);
  if (arweaveEntry) {
    console.log('Found existing upload on Arweave.');
    return {
      transactionId: arweaveEntry.txId,
      viewblockUrl: `https://viewblock.io/arweave/tx/${arweaveEntry.txId}`,
      arweaveUrl: `https://arweave.net/${arweaveEntry.txId}`,
      ipfsCid,
      fileSize,
      alreadyExists: true,
      source: 'arweave',
    };
  }

  console.log('No existing upload found. Proceeding with new upload...');

  // Get wallet
  const jwk = getWallet();

  // Initialize Turbo
  const signer = new ArweaveSigner(jwk);
  const turbo = TurboFactory.authenticated({ signer });

  // Build tags
  const tags = [
    { name: 'Content-Type', value: 'text/markdown' },
    { name: 'App-Name', value: 'Markdown Provenance' },
    { name: 'App-Version', value: '0.0.1' },
    { name: 'Type', value: 'Attestation' },
    { name: 'IPFS-CID', value: ipfsCid },
  ];

  // Add author if provided (--author flag overrides MP_AUTHOR env var)
  const author = options.authorOverride || process.env.MP_AUTHOR;
  if (author) {
    tags.push({ name: 'Author', value: author });
  }

  // Add optional fileName tag (custom filename for lookup)
  if (options.fileName) {
    tags.push({ name: 'File-Name', value: options.fileName });
  }

  // Add optional source tag (URL/URI reference)
  if (options.source) {
    tags.push({ name: 'Source', value: options.source });
  }

  console.log(`\nUploading ${fileName} (${fileSize} bytes)...`);
  console.log('Tags:', tags.map(t => `${t.name}: ${t.value}`).join(', '));

  // Create and sign a data item using arbundles
  const arbundlesSigner = new ArbundlesSigner(jwk);
  const dataItem = createData(content, arbundlesSigner, { tags });
  await dataItem.sign(arbundlesSigner);

  // Upload the signed data item
  const result = await turbo.uploadSignedDataItem({
    dataItemStreamFactory: () => dataItem.getRaw(),
    dataItemSizeFactory: () => dataItem.getRaw().length,
    signal: AbortSignal.timeout(60000),
  });

  const uploadResult: UploadResult = {
    transactionId: result.id,
    viewblockUrl: `https://viewblock.io/arweave/tx/${result.id}`,
    arweaveUrl: `https://arweave.net/${result.id}`,
    ipfsCid,
    fileSize,
    alreadyExists: false,
  };

  // Log transaction
  logTransaction(uploadResult, fileName);

  return uploadResult;
}

export interface UploadContentOptions {
  content: string;
  fileName: string;
  tags: Array<{ name: string; value: string }>;
  skipDedup?: boolean;
}

export async function uploadContent(options: UploadContentOptions): Promise<UploadResult> {
  const { content, fileName, tags, skipDedup } = options;
  const fileSize = Buffer.byteLength(content, 'utf-8');

  // Generate IPFS CID
  const ipfsCid = await generateIPFSCID(content);

  if (!skipDedup) {
    const localEntry = checkLocalLog(ipfsCid);
    if (localEntry) {
      return {
        transactionId: localEntry.txId,
        viewblockUrl: localEntry.url,
        arweaveUrl: `https://arweave.net/${localEntry.txId}`,
        ipfsCid: localEntry.cid,
        fileSize: localEntry.size,
        alreadyExists: true,
        source: 'local',
      };
    }

    const arweaveEntry = await checkArweaveForCID(ipfsCid);
    if (arweaveEntry) {
      return {
        transactionId: arweaveEntry.txId,
        viewblockUrl: `https://viewblock.io/arweave/tx/${arweaveEntry.txId}`,
        arweaveUrl: `https://arweave.net/${arweaveEntry.txId}`,
        ipfsCid,
        fileSize,
        alreadyExists: true,
        source: 'arweave',
      };
    }
  }

  // Ensure IPFS-CID tag is present
  const allTags = [...tags];
  if (!allTags.find(t => t.name === 'IPFS-CID')) {
    allTags.push({ name: 'IPFS-CID', value: ipfsCid });
  }

  // Get wallet, sign, upload
  const jwk = getWallet();
  const signer = new ArweaveSigner(jwk);
  const turbo = TurboFactory.authenticated({ signer });

  const arbundlesSigner = new ArbundlesSigner(jwk);
  const dataItem = createData(content, arbundlesSigner, { tags: allTags });
  await dataItem.sign(arbundlesSigner);

  const result = await turbo.uploadSignedDataItem({
    dataItemStreamFactory: () => dataItem.getRaw(),
    dataItemSizeFactory: () => dataItem.getRaw().length,
    signal: AbortSignal.timeout(60000),
  });

  return {
    transactionId: result.id,
    viewblockUrl: `https://viewblock.io/arweave/tx/${result.id}`,
    arweaveUrl: `https://arweave.net/${result.id}`,
    ipfsCid,
    fileSize,
    alreadyExists: false,
  };
}
