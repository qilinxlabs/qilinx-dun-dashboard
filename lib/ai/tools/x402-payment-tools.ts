/**
 * X402 Payment Tools for AI Chat
 * 
 * These tools allow the LLM to interact with X402 payment requests
 * using the connected Solana wallet.
 */

import { tool } from 'ai';
import { z } from 'zod';

const COMMON_AMOUNTS = [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50, 100];

/**
 * Create X402 payment request
 */
const createPaymentRequest = tool({
  description:
    `Create an X402 payment request that others can pay. IMPORTANT: Only COMMON_AMOUNTS are allowed: ${COMMON_AMOUNTS.join(', ')} SOL. Returns a payment URL that can be shared with payers. The user must sign the transaction with their connected wallet.`,
  inputSchema: z.object({
    walletAddress: z.string().describe("The Solana wallet address creating the request"),
    amount: z.number().refine(
      (val) => COMMON_AMOUNTS.includes(val),
      { message: `Amount must be one of: ${COMMON_AMOUNTS.join(', ')} SOL` }
    ).describe(`Amount in SOL (must be one of: ${COMMON_AMOUNTS.join(', ')})`),
    expiresIn: z.number().positive().default(3600).describe("Expiration time in seconds (default: 3600 = 1 hour)"),
    metadata: z.string().optional().describe("Optional metadata/description for the payment request"),
  }),
  execute: async ({ walletAddress, amount, expiresIn, metadata }) => {
    try {
      // Return instruction for client-side execution
      return {
        requiresClientExecution: true,
        action: "createPaymentRequest",
        params: { walletAddress, amount, expiresIn, metadata },
        message: `Creating payment request for ${amount} SOL. Please sign the transaction in your wallet.`,
      };
    } catch (error: any) {
      return {
        error: error.message || 'Failed to create payment request',
      };
    }
  },
});

/**
 * Get my payment requests
 */
const getMyPaymentRequests = tool({
  description:
    "Get all payment requests created by the user's wallet. Shows pending, paid, expired, and cancelled requests with their details.",
  inputSchema: z.object({
    walletAddress: z.string().describe("The Solana wallet address to check"),
  }),
  execute: async ({ walletAddress }) => {
    try {
      // Return instruction for client-side execution
      return {
        requiresClientExecution: true,
        action: "getMyPaymentRequests",
        params: { walletAddress },
        message: "Fetching your payment requests...",
      };
    } catch (error: any) {
      return {
        error: error.message || 'Failed to fetch payment requests',
      };
    }
  },
});

/**
 * Pay a payment request
 */
const payPaymentRequest = tool({
  description:
    "Pay an X402 payment request using a payment URL or request ID. This executes a privacy transfer where the payment amount is hidden using zero-knowledge proofs. The user must have enough wrapped SOL and sign the transaction.",
  inputSchema: z.object({
    walletAddress: z.string().describe("The Solana wallet address making the payment"),
    paymentUrl: z.string().describe("The payment URL (e.g., https://app.com/dapp/x402-payment?request=...) or just the request PDA address"),
  }),
  execute: async ({ walletAddress, paymentUrl }) => {
    try {
      // Extract request PDA from URL if it's a full URL
      let requestPDA = paymentUrl;
      if (paymentUrl.includes('?request=')) {
        const urlParams = new URLSearchParams(paymentUrl.split('?')[1]);
        requestPDA = urlParams.get('request') || paymentUrl;
      }

      // Return instruction for client-side execution
      return {
        requiresClientExecution: true,
        action: "payPaymentRequest",
        params: { walletAddress, requestPDA },
        message: `Preparing to pay the payment request. This will use privacy transfer with zero-knowledge proofs (takes 2-3 seconds). Please sign the transaction in your wallet.`,
      };
    } catch (error: any) {
      return {
        error: error.message || 'Failed to pay payment request',
      };
    }
  },
});

/**
 * Get payment request details
 */
const getPaymentRequestDetails = tool({
  description:
    "Get details of a specific payment request by its URL or PDA address. Shows amount, status, payee, expiration, and other metadata.",
  inputSchema: z.object({
    paymentUrl: z.string().describe("The payment URL or request PDA address"),
  }),
  execute: async ({ paymentUrl }) => {
    try {
      // Extract request PDA from URL if it's a full URL
      let requestPDA = paymentUrl;
      if (paymentUrl.includes('?request=')) {
        const urlParams = new URLSearchParams(paymentUrl.split('?')[1]);
        requestPDA = urlParams.get('request') || paymentUrl;
      }

      // Return instruction for client-side execution
      return {
        requiresClientExecution: true,
        action: "getPaymentRequestDetails",
        params: { requestPDA },
        message: "Fetching payment request details...",
      };
    } catch (error: any) {
      return {
        error: error.message || 'Failed to fetch payment request details',
      };
    }
  },
});

/**
 * All X402 payment tools exported as a record for use in streamText
 */
export const x402PaymentTools = {
  createPaymentRequest,
  getMyPaymentRequests,
  payPaymentRequest,
  getPaymentRequestDetails,
} as const;

export const x402PaymentToolNames = Object.keys(x402PaymentTools);

// Type for the tools record
export type X402PaymentToolRecord = typeof x402PaymentTools;
