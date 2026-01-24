"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Shield, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface WalletConnectionBlockerProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function WalletConnectionBlocker({ 
  children, 
  title = "Wallet Connection Required",
  description = "Please connect your Solana wallet to access this feature"
}: WalletConnectionBlockerProps) {
  const { connected } = useWallet();

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-md w-full border-2">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Wallet className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription className="text-base">{description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <WalletMultiButton className="!bg-primary hover:!bg-primary/90" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Your wallet stays secure and under your control</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
