import { useEffect, useState, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSession } from 'next-auth/react';
import { createWalletSession } from '@/app/(auth)/wallet-auto-auth-actions';

/**
 * Hook to automatically create a session when wallet connects
 * Creates user record if needed and establishes NextAuth session
 */
export function useWalletAutoAuth() {
  const { publicKey, connected } = useWallet();
  const { data: session, status, update } = useSession();
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAttemptedAuth = useRef<string | null>(null);

  useEffect(() => {
    const createSession = async () => {
      // Reset if wallet disconnected
      if (!connected || !publicKey) {
        hasAttemptedAuth.current = null;
        setIsCreatingSession(false);
        return;
      }

      const walletAddress = publicKey.toBase58();

      // Skip if already have a session with matching wallet
      if (session?.user?.walletAddress === walletAddress) {
        console.log('[useWalletAutoAuth] Already authenticated for wallet:', walletAddress);
        return;
      }

      // Skip if already attempted for this wallet
      if (hasAttemptedAuth.current === walletAddress) {
        console.log('[useWalletAutoAuth] Already attempted auth for wallet:', walletAddress);
        return;
      }

      // Skip if session is loading
      if (status === 'loading') {
        console.log('[useWalletAutoAuth] Session loading, waiting...');
        return;
      }

      console.log('[useWalletAutoAuth] Starting auto-auth for wallet:', walletAddress);
      hasAttemptedAuth.current = walletAddress;
      setIsCreatingSession(true);
      setError(null);

      try {
        // Create or fetch user and establish session using server action
        console.log('[useWalletAutoAuth] Calling createWalletSession server action');
        const result = await createWalletSession(walletAddress);

        if (!result.success) {
          throw new Error(result.error || 'Failed to create session');
        }

        console.log('[useWalletAutoAuth] Session created successfully:', result.user);

        // Update the session
        console.log('[useWalletAutoAuth] Updating NextAuth session');
        await update();
        console.log('[useWalletAutoAuth] Session updated');
      } catch (err: any) {
        console.error('[useWalletAutoAuth] Auto-auth error:', err);
        setError(err.message || 'Failed to create session');
        hasAttemptedAuth.current = null; // Allow retry
      } finally {
        setIsCreatingSession(false);
      }
    };

    createSession();
  }, [connected, publicKey, session, status, update]);

  return {
    isCreatingSession,
    error,
    isAuthenticated: !!session?.user,
    walletAddress: publicKey?.toBase58(),
  };
}
