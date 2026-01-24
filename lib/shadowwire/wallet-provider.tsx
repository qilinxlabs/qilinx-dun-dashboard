'use client';

import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
  LedgerWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface SolanaWalletProviderProps {
  children: React.ReactNode;
  network?: WalletAdapterNetwork;
}

export function SolanaWalletProvider({
  children,
  network = WalletAdapterNetwork.Mainnet,
}: SolanaWalletProviderProps) {
  // Use QuickNode RPC if available, otherwise fall back to public endpoint
  const endpoint = useMemo(() => {
    // For devnet, always use public devnet endpoint
    if (network === WalletAdapterNetwork.Devnet) {
      return clusterApiUrl(WalletAdapterNetwork.Devnet);
    }
    
    // For mainnet, use custom RPC URL if available
    if (network === WalletAdapterNetwork.Mainnet) {
      const customRpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
      if (customRpcUrl) {
        return customRpcUrl;
      }
      return 'https://api.mainnet-beta.solana.com';
    }
    
    return clusterApiUrl(network);
  }, [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
      new LedgerWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
