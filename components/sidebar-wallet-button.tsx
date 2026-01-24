'use client';

import { useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

export function SidebarWalletButton() {
  const { publicKey, connected } = useWallet();
  const router = useRouter();
  const previousWalletRef = useRef<string | null>(null);

  useEffect(() => {
    const currentWallet = publicKey?.toBase58() || null;

    // If wallet changed (not just initial connection)
    if (previousWalletRef.current && previousWalletRef.current !== currentWallet) {
      console.log('[SidebarWalletButton] Wallet changed, logging out and redirecting');
      
      // Sign out the current session
      signOut({ redirect: false }).then(() => {
        // Redirect to chat home page which will trigger auto-auth with new wallet
        router.push('/chat');
        // Force a full page reload to clear all state
        window.location.href = '/chat';
      });
    }

    // Update the previous wallet reference
    previousWalletRef.current = currentWallet;
  }, [publicKey, connected, router]);

  return (
    <div className="px-2 py-2">
      <WalletMultiButton className="!w-full !h-auto !py-2 !px-3 !text-sm !bg-primary hover:!bg-primary/90" />
    </div>
  );
}
