import { uploadMarkdown } from './lib/arweave-utils.js';

// Parse command line arguments
function parseArgs(): { filePath: string; author?: string; fileName?: string; source?: string } {
  const args = process.argv.slice(2);
  let filePath = '';
  let author: string | undefined;
  let fileName: string | undefined;
  let source: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--author' && args[i + 1]) {
      author = args[i + 1];
      i++; // Skip the next arg since it's the author value
    } else if (args[i] === '--fileName' && args[i + 1]) {
      fileName = args[i + 1];
      i++;
    } else if (args[i] === '--source' && args[i + 1]) {
      source = args[i + 1];
      i++;
    } else if (!args[i].startsWith('--')) {
      filePath = args[i];
    }
  }

  return { filePath, author, fileName, source };
}

// Main execution
const { filePath, author: authorOverride, fileName, source } = parseArgs();
if (!filePath) {
  console.error('Usage: npm run upload <file-path> [options]');
  console.error('       npx tsx scripts/upload-to-arweave.ts <file-path> [options]');
  console.error('\nOptions:');
  console.error('  --author "Name"     Override MP_AUTHOR environment variable');
  console.error('  --fileName "name"   Add a File-Name tag for easier lookup');
  console.error('  --source "URL"      Add a Source tag referencing origin URL/URI');
  process.exit(1);
}

uploadMarkdown(filePath, { authorOverride, fileName, source })
  .then(async (result) => {
    if (result.alreadyExists) {
      const sourceMsg = result.source === 'local' ? 'local log' : 'Arweave network';
      console.log(`\n✅ Content already exists on Arweave (found in ${sourceMsg})!\n`);
      console.log('This exact content was previously uploaded. No new upload needed.');
    } else {
      console.log('\n✅ Upload successful!\n');
      console.log(`Transaction logged to ~/.markdown-provenance/transactions.jsonl`);
    }
    console.log(`\nTransaction ID: ${result.transactionId}`);
    console.log(`View on ViewBlock: ${result.viewblockUrl}`);
    console.log(`Direct Arweave URL: ${result.arweaveUrl}`);
    console.log(`IPFS CID: ${result.ipfsCid}`);
    console.log(`File size: ${result.fileSize} bytes`);

    // Auto-sync brain if ArNS name is configured and this was a new upload
    if (process.env.MP_ARNS_NAME && !result.alreadyExists) {
      console.log('\nAuto-syncing agent brain...');
      try {
        const { syncBrain } = await import('./brain-sync.js');
        await syncBrain();
        console.log(`Brain synced to ${process.env.MP_ARNS_NAME}.ar.io`);
      } catch (err) {
        console.error(`Brain auto-sync warning: ${(err as Error).message}`);
        console.error('Run /markdown-provenance-brain to retry manually.');
      }
    }
  })
  .catch((error) => {
    console.error('\n❌ Upload failed:\n');
    console.error(error.message);

    // Provide helpful context for common errors
    if (error.message.includes('insufficient funds') || error.message.includes('Insufficient')) {
      console.error('\nHint: Files over 100KB require AR tokens. Fund your wallet.');
    } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
      console.error('\nHint: Check your internet connection and try again.');
    }

    process.exit(1);
  });
