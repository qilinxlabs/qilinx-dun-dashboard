import { NextResponse } from "next/server";
import { prepareUnwrapSolTransaction } from "@/lib/solana/wrap-unwrap-service";

export async function POST(request: Request) {
  try {
    const { amount, walletAddress } = await request.json();

    const result = await prepareUnwrapSolTransaction({ amount, walletAddress });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Unwrap SOL API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to unwrap SOL: ${message}` },
      { status: 500 }
    );
  }
}
