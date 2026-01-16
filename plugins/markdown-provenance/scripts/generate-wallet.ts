import Arweave from 'arweave';
import fs from 'fs';
import path from 'path';
import os from 'os';

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
});

async function generateWallet() {
  const outputPath = process.argv[2] || path.join(os.homedir(), '.arweave', 'wallet.json');
  const outputDir = path.dirname(outputPath);

  // Create directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created directory: ${outputDir}`);
  }

  // Check if wallet already exists
  if (fs.existsSync(outputPath)) {
    console.error(`Error: Wallet already exists at ${outputPath}`);
    console.error('Delete it first if you want to generate a new one.');
    process.exit(1);
  }

  console.log('Generating new Arweave wallet...');
  const key = await arweave.wallets.generate();

  // Get the wallet address
  const address = await arweave.wallets.jwkToAddress(key);

  // Save the wallet
  fs.writeFileSync(outputPath, JSON.stringify(key, null, 2));
  fs.chmodSync(outputPath, 0o600); // Restrict permissions

  console.log('\n✅ Wallet generated successfully!\n');
  console.log(`Wallet saved to: ${outputPath}`);
  console.log(`Wallet address: ${address}`);
  console.log('\n⚠️  IMPORTANT: Back up this wallet file securely!');
  console.log('   Anyone with this file can access your funds.\n');
  console.log('Next steps:');
  console.log(`  1. Add to your shell config (~/.zshrc or ~/.bashrc):`);
  console.log(`     export ARWEAVE_WALLET_PATH="${outputPath}"`);
  console.log(`     export ARWEAVE_AUTHOR="Your Name"  # Optional`);
  console.log('  2. Reload your shell: source ~/.zshrc');
  console.log('  3. Test with: npm run upload README.md');
}

generateWallet().catch((error) => {
  console.error('Failed to generate wallet:', error.message);
  process.exit(1);
});
