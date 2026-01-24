'use client';

import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { 
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

export function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  // Use devnet for testing
  const network = WalletAdapterNetwork.Devnet;
  
  // Use custom RPC or default
  const endpoint = useMemo(() => {
    return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(network);
  }, [network]);

  // Configure wallets - using only the most popular and widely available ones
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),      // Most popular Solana wallet
      new SolflareWalletAdapter(),     // Second most popular
      // Note: Other wallets can be added by installing their specific packages
      // e.g., @solana/wallet-adapter-backpack, @solana/wallet-adapter-coinbase, etc.
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={true}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
