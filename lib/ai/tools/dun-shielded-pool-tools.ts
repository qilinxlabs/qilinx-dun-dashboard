/**
 * Dun Shielded Pool Tools for AI Chat
 *
 * These tools allow the LLM to interact with the Dun V3 shielded pool protocol
 * using the connected Solana wallet for signing transactions.
 */

import { tool, type Tool } from "ai";
import { z } from "zod";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
import { prepareWrapSolTransaction, prepareUnwrapSolTransaction } from "@/lib/solana/wrap-unwrap-service";

const COMMON_AMOUNTS = [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50, 100];
const DEVNET_RPC = "https://api.devnet.solana.com";

// biome-ignore lint/suspicious/noExplicitAny: Dun tools have dynamic return types
type DunToolRecord = Record<string, Tool<any, any>>;

/**
 * Check user's SOL and wrapped SOL balance
 */
const checkWalletBalance = tool({
  description:
    "Check the user's Solana wallet balance including native SOL and wrapped SOL (wSOL). Returns both balances in SOL.",
  inputSchema: z.object({
    walletAddress: z.string().describe("The Solana wallet address to check (base58 encoded public key)"),
  }),
  execute: async ({ walletAddress }) => {
    try {
      const connection = new Connection(DEVNET_RPC, "confirmed");
      const publicKey = new PublicKey(walletAddress);

      // Get native SOL balance
      const nativeBalance = await connection.getBalance(publicKey);
      const nativeSOL = nativeBalance / LAMPORTS_PER_SOL;

      // Get wrapped SOL balance
      let wrappedSOL = 0;
      try {
        const wrappedSolAccount = getAssociatedTokenAddressSync(NATIVE_MINT, publicKey);
        const tokenBalance = await connection.getTokenAccountBalance(wrappedSolAccount);
        wrappedSOL = Number(tokenBalance.value.amount) / LAMPORTS_PER_SOL;
      } catch {
        // No wrapped SOL account exists
        wrappedSOL = 0;
      }

      return {
        success: true,
        walletAddress,
        nativeSOL: nativeSOL.toFixed(4),
        wrappedSOL: wrappedSOL.toFixed(4),
        totalSOL: (nativeSOL + wrappedSOL).toFixed(4),
        network: "devnet",
        message: `Wallet Balance:\n• Native SOL: ${nativeSOL.toFixed(4)} SOL\n• Wrapped SOL: ${wrappedSOL.toFixed(4)} SOL\n• Total: ${(nativeSOL + wrappedSOL).toFixed(4)} SOL`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Failed to fetch balance: ${message}`,
      };
    }
  },
});

/**
 * Wrap SOL to wSOL
 */
const wrapSol = tool({
  description:
    "Wrap native SOL to wrapped SOL (wSOL). Wrapped SOL is required for deposits into the shielded pool. This operation executes on the server and prepares a transaction for the user to sign.",
  inputSchema: z.object({
    amount: z.number().positive().describe("Amount of SOL to wrap (e.g., 0.1, 1, 5)"),
    walletAddress: z.string().describe("The user's Solana wallet address"),
  }),
  execute: async ({ amount, walletAddress }) => {
    try {
      const result = await prepareWrapSolTransaction({ amount, walletAddress });

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to prepare wrap transaction",
        };
      }

      return {
        requiresClientExecution: true,
        action: "wrapSol",
        params: { amount, transaction: result.transaction },
        message: result.message || `Prepared transaction to wrap ${amount} SOL. Please sign in your wallet.`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Failed to wrap SOL: ${message}`,
      };
    }
  },
});

/**
 * Unwrap wSOL to SOL
 */
const unwrapSol = tool({
  description:
    "Unwrap wrapped SOL (wSOL) back to native SOL. This closes the wSOL account and returns ALL wrapped SOL to native SOL. The operation executes on the server and prepares a transaction for the user to sign.",
  inputSchema: z.object({
    amount: z.number().positive().describe("Amount of wSOL to unwrap (e.g., 0.1, 1, 5) - note: this will unwrap ALL available wSOL"),
    walletAddress: z.string().describe("The user's Solana wallet address"),
  }),
  execute: async ({ amount, walletAddress }) => {
    try {
      const result = await prepareUnwrapSolTransaction({ amount, walletAddress });

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to prepare unwrap transaction",
        };
      }

      return {
        requiresClientExecution: true,
        action: "unwrapSol",
        params: { amount: result.actualAmount || amount, transaction: result.transaction },
        message: result.message || `Prepared transaction to unwrap ${result.actualAmount || amount} SOL. Please sign in your wallet.`,
        note: result.note,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Failed to unwrap SOL: ${message}`,
      };
    }
  },
});

/**
 * Check shielded pool balance
 */
const checkShieldedBalance = tool({
  description:
    "Check the user's balance in the Dun V3 shielded pool. Scans the blockchain for commitments owned by the user's wallet. Returns total balance and list of unspent commitments.",
  inputSchema: z.object({
    walletAddress: z.string().describe("The Solana wallet address to check"),
  }),
  execute: async ({ walletAddress }) => {
    try {
      return {
        requiresClientExecution: true,
        action: "checkShieldedBalance",
        params: { walletAddress },
        message: "Scanning blockchain for your shielded commitments...",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: message,
      };
    }
  },
});

/**
 * Deposit SOL into shielded pool
 */
const depositToShieldedPool = tool({
  description:
    `Deposit SOL into the Dun V3 shielded pool for private transactions. IMPORTANT: 
    1. Only COMMON_AMOUNTS are allowed: ${COMMON_AMOUNTS.join(', ')} SOL
    2. User must have enough WRAPPED SOL (wSOL) to deposit - check with checkWalletBalance first
    3. If insufficient wrapped SOL, call wrapSol first to wrap the required amount
    4. This creates a commitment that hides the amount on-chain using zero-knowledge proofs
    5. The user must sign the transaction with their connected wallet
    
    Always check wallet balance before attempting deposit!`,
  inputSchema: z.object({
    amount: z.number().refine(
      (val) => COMMON_AMOUNTS.includes(val),
      {
        message: `Amount must be one of the COMMON_AMOUNTS: ${COMMON_AMOUNTS.join(', ')} SOL`,
      }
    ).describe(`Amount of SOL to deposit. Must be one of: ${COMMON_AMOUNTS.join(', ')}`),
  }),
  execute: async ({ amount }) => {
    try {
      console.log('[depositToShieldedPool] Called with amount:', amount);
      
      if (!COMMON_AMOUNTS.includes(amount)) {
        console.log('[depositToShieldedPool] Invalid amount, not in COMMON_AMOUNTS');
        return {
          success: false,
          error: `Invalid amount. Must be one of the COMMON_AMOUNTS: ${COMMON_AMOUNTS.join(', ')} SOL`,
          hint: "COMMON_AMOUNTS are required for privacy. They create an anonymity set where your transaction mixes with others of the same amount.",
        };
      }

      console.log('[depositToShieldedPool] Returning client execution request');
      return {
        requiresClientExecution: true,
        action: "depositToShieldedPool",
        params: { amount },
        message: `Preparing to deposit ${amount} SOL into the shielded pool. This will generate a zero-knowledge proof (takes 2-3 seconds). Please sign the transaction in your wallet.`,
      };
    } catch (error) {
      console.error('[depositToShieldedPool] Error:', error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: message,
      };
    }
  },
});

/**
 * Withdraw SOL from shielded pool
 */
const withdrawFromShieldedPool = tool({
  description:
    `Withdraw SOL from the Dun V3 shielded pool to any address. IMPORTANT: Only COMMON_AMOUNTS are allowed: ${COMMON_AMOUNTS.join(', ')} SOL. This proves ownership of commitments without revealing which ones, maintaining privacy. The user must sign the transaction with their connected wallet.`,
  inputSchema: z.object({
    amount: z.number().refine(
      (val) => COMMON_AMOUNTS.includes(val),
      {
        message: `Amount must be one of the COMMON_AMOUNTS: ${COMMON_AMOUNTS.join(', ')} SOL`,
      }
    ).describe(`Amount of SOL to withdraw. Must be one of: ${COMMON_AMOUNTS.join(', ')}`),
    recipientAddress: z.string().optional().describe("Optional recipient address. If not provided, withdraws to the user's connected wallet. For maximum privacy, withdraw to a different address."),
  }),
  execute: async ({ amount, recipientAddress }) => {
    try {
      if (!COMMON_AMOUNTS.includes(amount)) {
        return {
          success: false,
          error: `Invalid amount. Must be one of the COMMON_AMOUNTS: ${COMMON_AMOUNTS.join(', ')} SOL`,
          hint: "COMMON_AMOUNTS are required for privacy. They create an anonymity set where your transaction mixes with others of the same amount.",
        };
      }

      return {
        requiresClientExecution: true,
        action: "withdrawFromShieldedPool",
        params: { amount, recipientAddress },
        message: `Preparing to withdraw ${amount} SOL from the shielded pool${recipientAddress ? ` to ${recipientAddress}` : ''}. This will generate a zero-knowledge proof (takes 3-5 seconds). Please sign the transaction in your wallet.`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: message,
      };
    }
  },
});

/**
 * All Dun shielded pool tools exported as a record for use in streamText
 */
export const dunShieldedPoolTools: DunToolRecord = {
  checkWalletBalance,
  wrapSol,
  unwrapSol,
  checkShieldedBalance,
  depositToShieldedPool,
  withdrawFromShieldedPool,
};

export const dunShieldedPoolToolNames = Object.keys(dunShieldedPoolTools);
