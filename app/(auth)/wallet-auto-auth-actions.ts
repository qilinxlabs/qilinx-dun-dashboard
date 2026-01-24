"use server";

import { getUserByWallet, createWalletUser } from "@/lib/db/queries";
import { signIn } from "./auth";

export async function createWalletSession(walletAddress: string) {
  try {
    console.log('[createWalletSession] Request for wallet:', walletAddress);

    if (!walletAddress) {
      return { success: false, error: "Wallet address is required" };
    }

    // Check if user exists
    let [user] = await getUserByWallet(walletAddress);

    // Create user if doesn't exist
    if (!user) {
      console.log('[createWalletSession] User not found, creating new user');
      const nonce = `auto-${Date.now()}`;
      await createWalletUser(walletAddress, nonce);
      [user] = await getUserByWallet(walletAddress);
      console.log('[createWalletSession] User created:', user?.id);
    } else {
      console.log('[createWalletSession] User found:', user.id);
    }

    if (!user) {
      return { success: false, error: "Failed to create or fetch user" };
    }

    // Create session using NextAuth signIn
    console.log('[createWalletSession] Creating session for user:', user.id);
    await signIn("wallet", {
      walletAddress,
      redirect: false,
    });

    console.log('[createWalletSession] Session created successfully');

    return {
      success: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
      },
    };
  } catch (error: any) {
    console.error("[createWalletSession] Error:", error);
    return {
      success: false,
      error: error.message || "Failed to create session",
    };
  }
}
