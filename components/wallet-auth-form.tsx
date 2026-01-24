"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import bs58 from "bs58";
import { toast } from "@/components/toast";
import { requestWalletNonce, loginWithWallet, registerWithWallet } from "@/app/(auth)/actions";

export function WalletAuthForm({ mode }: { mode: "login" | "register" }) {
  const { publicKey, signMessage, connected } = useWallet();
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    if (connected && publicKey && signMessage && !isAuthenticating) {
      handleWalletAuth();
    }
  }, [connected, publicKey]);

  const handleWalletAuth = async () => {
    if (!publicKey || !signMessage) {
      toast({
        type: "error",
        description: "Wallet not connected properly",
      });
      return;
    }

    setIsAuthenticating(true);

    try {
      const walletAddress = publicKey.toBase58();

      // Request nonce from server
      const { nonce } = await requestWalletNonce(walletAddress);

      // Sign the nonce
      const messageBytes = new TextEncoder().encode(nonce);
      const signatureBytes = await signMessage(messageBytes);
      const signature = bs58.encode(signatureBytes);

      // Try to login first, if fails then register
      let result = await loginWithWallet(
        { status: "idle" },
        { walletAddress, signature, message: nonce }
      );

      // If login failed (wallet not registered), auto-register
      if (result.status === "failed") {
        console.log("Wallet not found, auto-registering...");
        result = await registerWithWallet(walletAddress, signature, nonce);
      }

      if (result.status === "success") {
        toast({
          type: "success",
          description: "Signed in successfully!",
        });
        await updateSession();
        // Use full page navigation to ensure server components re-render with new session
        window.location.href = "/dashboard";
      } else if (result.status === "invalid_signature") {
        toast({
          type: "error",
          description: "Invalid signature. Please try again.",
        });
      } else {
        toast({
          type: "error",
          description: "Authentication failed. Please try again.",
        });
      }
    } catch (error: any) {
      console.error("Wallet auth error:", error);
      toast({
        type: "error",
        description: error.message || "Authentication failed",
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-4">
        <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700" />
        {isAuthenticating && (
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Please sign the message in your wallet...
          </p>
        )}
      </div>
      
      {connected && publicKey && (
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-zinc-800">
          <p className="text-xs text-gray-600 dark:text-zinc-400">
            Connected: {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
          </p>
        </div>
      )}
    </div>
  );
}
