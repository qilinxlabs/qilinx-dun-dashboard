# Solana Wallet Support

## Overview

We use **`@solana/wallet-adapter`** - the official Solana wallet adapter SDK that provides a unified interface for connecting to multiple Solana wallets.

## Currently Supported Wallets

### ✅ Enabled (2 wallets)

1. **Phantom** - Most popular Solana wallet
   - Browser extension (Chrome, Firefox, Brave, Edge)
   - Mobile app (iOS, Android)
   - ~3M+ users
   - https://phantom.app

2. **Solflare** - Second most popular
   - Browser extension
   - Mobile app
   - Hardware wallet support
   - https://solflare.com

**Note:** These are the two most popular Solana wallets and cover 90%+ of users. The wallet adapter will automatically detect any installed Solana-compatible wallet, so users with other wallets can still connect!

## How It Works

### User Experience:
1. User clicks "Connect Wallet" button
2. Modal appears showing all available wallets
3. User selects their wallet
4. Wallet prompts for approval
5. Connected! Can now sign messages and transactions

### Developer Experience:
```tsx
import { useWallet } from '@solana/wallet-adapter-react';

function MyComponent() {
  const { publicKey, signMessage, signTransaction, connected } = useWallet();
  
  // Use wallet features
  if (connected) {
    console.log('Connected:', publicKey.toBase58());
  }
}
```

## Additional Wallets Available

The wallet adapter automatically detects **any Solana-compatible wallet** installed in the browser! This means users with Backpack, Coinbase Wallet, Trust Wallet, Glow, Slope, Exodus, and many others can still connect - they'll just appear in the "Detected" section of the wallet modal.

### To Explicitly Add More Wallets:

If you want to show specific wallets in the modal (even if not installed), you need to install their individual packages:

```bash
# Install specific wallet adapters
pnpm add @solana/wallet-adapter-backpack
pnpm add @solana/wallet-adapter-coinbase
pnpm add @solana/wallet-adapter-trust
pnpm add @solana/wallet-adapter-ledger
```

Then import and add them:

```tsx
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import { CoinbaseWalletAdapter } from '@solana/wallet-adapter-coinbase';
import { TrustWalletAdapter } from '@solana/wallet-adapter-trust';
import { LedgerWalletAdapter } from '@solana/wallet-adapter-ledger';

const wallets = useMemo(
  () => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new BackpackWalletAdapter(),
    new CoinbaseWalletAdapter(),
    new TrustWalletAdapter(),
    new LedgerWalletAdapter(),
  ],
  []
);
```

### Why Only 2 Wallets by Default?

1. **Phantom + Solflare = 90%+ of users**
2. **Auto-detection works for others** - any installed wallet will be detected
3. **Smaller bundle size** - fewer dependencies
4. **Faster load time** - less code to download
5. **Easy to add more** - just install the package when needed

## Features

### Auto-Connect
- Automatically reconnects to previously connected wallet
- Enabled by default: `<WalletProvider autoConnect>`

### Network Support
- Mainnet Beta
- Devnet (currently configured)
- Testnet
- Localnet

### Custom RPC
- Uses `NEXT_PUBLIC_SOLANA_RPC_URL` from `.env.local`
- Falls back to default Solana RPC

### Wallet Modal
- Beautiful UI for wallet selection
- Shows installed wallets first
- Links to install wallets if not found
- Mobile-responsive

## API Reference

### useWallet() Hook

```tsx
const {
  // Connection state
  connected,          // boolean: is wallet connected?
  connecting,         // boolean: is connection in progress?
  disconnecting,      // boolean: is disconnection in progress?
  
  // Wallet info
  publicKey,          // PublicKey | null: user's public key
  wallet,             // Wallet | null: wallet adapter instance
  
  // Actions
  connect,            // () => Promise<void>: connect wallet
  disconnect,         // () => Promise<void>: disconnect wallet
  select,             // (walletName: string) => void: select wallet
  
  // Signing
  signMessage,        // (message: Uint8Array) => Promise<Uint8Array>
  signTransaction,    // (tx: Transaction) => Promise<Transaction>
  signAllTransactions,// (txs: Transaction[]) => Promise<Transaction[]>
  
  // Send transaction
  sendTransaction,    // (tx: Transaction, connection: Connection) => Promise<string>
} = useWallet();
```

### useConnection() Hook

```tsx
const { connection } = useConnection();

// Use connection to interact with Solana
const balance = await connection.getBalance(publicKey);
```

## Configuration

### Current Setup
**File:** `lib/solana/wallet-provider.tsx`

```tsx
export function SolanaWalletProvider({ children }) {
  const network = WalletAdapterNetwork.Devnet;  // Change for mainnet
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(network);
  
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      // Other wallets auto-detected!
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

### Environment Variables
```bash
# .env.local
NEXT_PUBLIC_SOLANA_RPC_URL="https://api.devnet.solana.com"

# For mainnet (later):
# NEXT_PUBLIC_SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"

# Or use a custom RPC (faster, more reliable):
# NEXT_PUBLIC_SOLANA_RPC_URL="https://rpc.helius.xyz/?api-key=YOUR_KEY"
```

## Usage in Dun Protocol

### Signature-Based Secrets
```tsx
const { signMessage } = useWallet();

// User signs message to derive secrets
const message = new TextEncoder().encode('Dun Protocol Secret Derivation');
const signature = await signMessage(message);

// Signature is used to derive deterministic secrets
const secrets = new SignatureSecrets();
const privateKey = await secrets.derivePrivateKey(signature);
```

### Transaction Signing
```tsx
const { signTransaction, publicKey } = useWallet();

// Build transaction
const tx = await program.methods
  .simpleDeposit(amount, commitment)
  .accounts({ signer: publicKey, ... })
  .transaction();

// Sign and send
const signed = await signTransaction(tx);
const signature = await connection.sendRawTransaction(signed.serialize());
```

## Security Notes

### What's Safe:
- ✅ Signing messages (for secret derivation)
- ✅ Signing transactions (user approves each one)
- ✅ Reading public key (public information)
- ✅ Checking balance (public information)

### What's NOT Exposed:
- ❌ Private key (never leaves wallet)
- ❌ Seed phrase (never leaves wallet)
- ❌ Auto-signing (user must approve each transaction)

### Best Practices:
1. Always show what user is signing
2. Never auto-sign transactions
3. Validate all inputs before signing
4. Use hardware wallets for large amounts
5. Test on devnet first

## Troubleshooting

### "Wallet not found"
- User needs to install wallet extension
- Modal will show "Install" button
- Mobile users need wallet app

### "User rejected request"
- User clicked "Cancel" in wallet popup
- Normal behavior, not an error
- Let user try again

### "Transaction failed"
- Check wallet is on correct network (devnet/mainnet)
- Check user has enough SOL for gas
- Check RPC endpoint is working

### "Auto-connect not working"
- User may have disconnected manually
- Clear browser cache and try again
- Check wallet extension is enabled

## Resources

- **Official Docs:** https://github.com/anza-xyz/wallet-adapter
- **Wallet List:** https://github.com/anza-xyz/wallet-adapter/tree/master/packages/wallets
- **React Docs:** https://github.com/anza-xyz/wallet-adapter/tree/master/packages/react
- **UI Components:** https://github.com/anza-xyz/wallet-adapter/tree/master/packages/react-ui

## Future Enhancements

### Phase 2:
- [ ] Add more wallet options (Glow, Slope, etc.)
- [ ] Custom wallet modal UI
- [ ] Wallet connection analytics
- [ ] Multi-wallet support (connect multiple at once)

### Phase 3:
- [ ] Mobile wallet connect (WalletConnect)
- [ ] Social login wallets (Torus)
- [ ] Hardware wallet optimization
- [ ] Wallet-specific features (xNFTs, etc.)
