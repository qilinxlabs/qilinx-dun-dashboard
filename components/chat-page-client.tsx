'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useSession } from 'next-auth/react';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusIcon, MessageSquareIcon, Shield, Loader2 } from "lucide-react";
import { useWalletAutoAuth } from "@/hooks/use-wallet-session";

export function ChatPageClient() {
  const wallet = useWallet();
  const { data: session, status } = useSession();
  const { isCreatingSession, error } = useWalletAutoAuth();

  // Show loading while checking session or creating session
  if (status === 'loading' || isCreatingSession) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            {isCreatingSession ? 'Setting up your account...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // Show wallet connection requirement if not connected
  if (!wallet.connected) {
    return (
      <div className="container mx-auto p-4 max-w-6xl relative min-h-[80vh]">
        {/* Semi-transparent blocker overlay */}
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
          <Card className="max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Wallet Required
              </CardTitle>
              <CardDescription>
                Connect your Solana wallet to access chat features
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <WalletMultiButton className="!bg-primary hover:!bg-primary/90" />
              <p className="text-xs text-muted-foreground text-center">
                Your account will be created automatically when you connect
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Placeholder content (blurred) */}
        <div className="space-y-4 opacity-50">
          <Card className="h-32" />
          <Card className="h-48" />
        </div>
      </div>
    );
  }

  // Show error if auto-auth failed
  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardHeader>
            <CardTitle className="text-destructive">Authentication Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => window.location.reload()} 
              className="w-full"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show main chat interface if authenticated and wallet connected
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="text-center space-y-4">
        <div className="flex justify-center text-muted-foreground">
          <MessageSquareIcon size={48} />
        </div>
        <h2 className="text-xl font-semibold">Select a chat or start a new one</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          Choose a conversation from the sidebar or create a new chat to get started with your AI assistant.
        </p>
        {session?.user && (
          <p className="text-xs text-muted-foreground">
            Logged in as: {session.user.walletAddress || session.user.email}
          </p>
        )}
        <Button asChild>
          <Link href="/chat/new">
            <PlusIcon />
            New Chat
          </Link>
        </Button>
      </div>
    </div>
  );
}
