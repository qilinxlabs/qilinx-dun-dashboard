import { NextResponse } from "next/server";
import { getUserByWallet } from "@/lib/db/queries";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("walletAddress");

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    const [user] = await getUserByWallet(walletAddress);

    return NextResponse.json({
      exists: !!user,
      user: user ? { id: user.id, walletAddress: user.walletAddress } : null,
    });
  } catch (error) {
    console.error("Error checking wallet:", error);
    return NextResponse.json(
      { error: "Failed to check wallet" },
      { status: 500 }
    );
  }
}
