import { NextResponse } from "next/server";
import { getUserByWallet, createWalletUser } from "@/lib/db/queries";
import { signIn } from "@/app/(auth)/auth";

export async function POST(request: Request) {
  try {
    const { walletAddress } = await request.json();

    console.log('[create-session] Request for wallet:', walletAddress);

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    // Check if user exists
    let [user] = await getUserByWallet(walletAddress);

    // Create user if doesn't exist
    if (!user) {
      console.log('[create-session] User not found, creating new user');
      const nonce = `auto-${Date.now()}`;
      await createWalletUser(walletAddress, nonce);
      [user] = await getUserByWallet(walletAddress);
      console.log('[create-session] User created:', user?.id);
    } else {
      console.log('[create-session] User found:', user.id);
    }

    if (!user) {
      throw new Error('Failed to create or fetch user');
    }

    // Create session
    console.log('[create-session] Creating session for user:', user.id);
    const result = await signIn("wallet", {
      walletAddress,
      redirect: false,
    });
    console.log('[create-session] Session created:', result);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
      },
    });
  } catch (error: any) {
    console.error("[create-session] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create session" },
      { status: 500 }
    );
  }
}
