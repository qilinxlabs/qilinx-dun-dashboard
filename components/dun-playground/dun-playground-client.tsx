'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Shield } from 'lucide-react';
import dynamic from 'next/dynamic';

const DunV3ClientComponent = dynamic(
  () => import('./dun-v3-client').then(mod => ({ default: mod.DunV3ClientComponent })),
  { 
    loading: () => <div className="flex items-center justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>,
    ssr: false 
  }
);

export function DunPlaygroundClient() {
  const wallet = useWallet();

  if (!wallet.connected) {
    return (
      <div className="container mx-auto p-6 max-w-4xl relative min-h-[80vh]">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dun Shielded Pool</h1>
          <p className="text-muted-foreground">
            Privacy-preserving deposits and withdrawals with hidden amounts on Solana Devnet
          </p>
        </div>

        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
          <Card className="max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Wallet Required
              </CardTitle>
              <CardDescription>
                Connect your Solana wallet to access Shielded Pool features
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <WalletMultiButton className="!bg-primary hover:!bg-primary/90" />
              <p className="text-xs text-muted-foreground text-center">
                Or use the Connect Wallet button in the sidebar
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 opacity-50">
          <Card className="h-32" />
          <Card className="h-48" />
          <Card className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl relative">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dun Shielded Pool</h1>
        <p className="text-muted-foreground">
          Privacy-preserving deposits and withdrawals with hidden amounts on Solana Devnet
        </p>
      </div>

      <DunV3ClientComponent />

      <Card className="mt-6 bg-muted/50">
        <CardHeader>
          <CardTitle className="text-sm">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>✅ <strong>Signature-Based Secrets:</strong> Your wallet signs a message to derive secrets (no private key exposure)</p>
          <p>✅ <strong>Deterministic:</strong> Same signature = same secrets (can recover deposits anytime)</p>
          <p>✅ <strong>Privacy:</strong> Deposit from address A, withdraw to address B (breaks the link)</p>
          <p>✅ <strong>Hidden Amounts:</strong> Amounts hidden on-chain using ZK proofs - maximum privacy!</p>
          <p>⚠️ <strong>Devnet Only:</strong> This is for testing. Use real SOL on mainnet for production.</p>
        </CardContent>
      </Card>
    </div>
  );
}
