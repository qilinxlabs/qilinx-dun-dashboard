/**
 * Solana Wrap/Unwrap Service
 * 
 * Provides server-side functionality to prepare wrap and unwrap transactions
 * for SOL <-> wSOL conversions.
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const DEVNET_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export interface WrapSolParams {
  amount: number;
  walletAddress: string;
}

export interface UnwrapSolParams {
  amount: number;
  walletAddress: string;
}

export interface WrapSolResult {
  success: boolean;
  transaction?: string; // base64 encoded
  message?: string;
  error?: string;
}

export interface UnwrapSolResult {
  success: boolean;
  transaction?: string; // base64 encoded
  actualAmount?: number;
  message?: string;
  note?: string;
  error?: string;
}

/**
 * Prepare a transaction to wrap SOL to wSOL
 */
export async function prepareWrapSolTransaction({
  amount,
  walletAddress,
}: WrapSolParams): Promise<WrapSolResult> {
  try {
    if (!amount || amount <= 0) {
      return { success: false, error: "Invalid amount" };
    }

    const connection = new Connection(DEVNET_RPC, "confirmed");
    const userPublicKey = new PublicKey(walletAddress);

    // Get or create associated token account for wrapped SOL
    const associatedTokenAccount = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      userPublicKey
    );

    const transaction = new Transaction();

    // Check if the associated token account exists
    const accountInfo = await connection.getAccountInfo(associatedTokenAccount);
    
    if (!accountInfo) {
      // Create associated token account if it doesn't exist
      transaction.add(
        createAssociatedTokenAccountInstruction(
          userPublicKey, // payer (user pays for account creation)
          associatedTokenAccount,
          userPublicKey, // owner
          NATIVE_MINT
        )
      );
    }

    // Transfer SOL from user to their token account
    const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: associatedTokenAccount,
        lamports,
      })
    );

    // Sync native (this converts the SOL to wSOL)
    transaction.add(
      createSyncNativeInstruction(associatedTokenAccount, TOKEN_PROGRAM_ID)
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;

    // Serialize transaction for client to sign
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    return {
      success: true,
      transaction: Buffer.from(serializedTransaction).toString("base64"),
      message: `Transaction prepared to wrap ${amount} SOL. Please sign in your wallet.`,
    };
  } catch (error) {
    console.error("Wrap SOL error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: `Failed to prepare wrap transaction: ${message}`,
    };
  }
}

/**
 * Prepare a transaction to unwrap wSOL to SOL
 */
export async function prepareUnwrapSolTransaction({
  amount,
  walletAddress,
}: UnwrapSolParams): Promise<UnwrapSolResult> {
  try {
    if (!amount || amount <= 0) {
      return { success: false, error: "Invalid amount" };
    }

    const connection = new Connection(DEVNET_RPC, "confirmed");
    const userPublicKey = new PublicKey(walletAddress);

    // Get associated token account for wrapped SOL
    const associatedTokenAccount = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      userPublicKey
    );

    // Check if the account exists and has sufficient balance
    const accountInfo = await connection.getAccountInfo(associatedTokenAccount);
    
    if (!accountInfo) {
      return {
        success: false,
        error: "No wrapped SOL account found",
      };
    }

    const tokenBalance = await connection.getTokenAccountBalance(associatedTokenAccount);
    const currentBalance = Number(tokenBalance.value.amount) / LAMPORTS_PER_SOL;

    if (currentBalance < amount) {
      return {
        success: false,
        error: `Insufficient wrapped SOL balance. You have ${currentBalance.toFixed(4)} wSOL but tried to unwrap ${amount} wSOL`,
      };
    }

    const transaction = new Transaction();

    // Close the account to unwrap all wSOL back to native SOL
    // Note: This unwraps ALL wSOL, not just the specified amount
    transaction.add(
      createCloseAccountInstruction(
        associatedTokenAccount,
        userPublicKey, // destination for remaining SOL
        userPublicKey, // owner
        [],
        TOKEN_PROGRAM_ID
      )
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;

    // Serialize transaction for client to sign
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    return {
      success: true,
      transaction: Buffer.from(serializedTransaction).toString("base64"),
      actualAmount: currentBalance,
      message: `Transaction prepared to unwrap ${currentBalance.toFixed(4)} wSOL (all available). Please sign in your wallet.`,
      note: "Unwrapping closes the wSOL account and returns all wrapped SOL to native SOL",
    };
  } catch (error) {
    console.error("Unwrap SOL error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: `Failed to prepare unwrap transaction: ${message}`,
    };
  }
}
