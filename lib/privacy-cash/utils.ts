import { PublicKey } from '@solana/web3.js';

/**
 * Validate if a string is a valid Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert SOL to lamports
 */
export function toSmallestUnit(amount: number, decimals: number = 9): number {
  return Math.floor(amount * Math.pow(10, decimals));
}

/**
 * Convert lamports to SOL
 */
export function fromSmallestUnit(lamports: number, decimals: number = 9): number {
  return lamports / Math.pow(10, decimals);
}

/**
 * Format amount for display
 */
export function formatAmount(amount: number, decimals: number = 4): string {
  return amount.toFixed(decimals);
}

/**
 * Get Solana explorer URL for a transaction
 */
export function getSolanaExplorerUrl(signature: string, network: 'mainnet' | 'devnet' | 'testnet' = 'mainnet'): string {
  const cluster = network === 'mainnet' ? '' : `?cluster=${network}`;
  return `https://explorer.solana.com/tx/${signature}${cluster}`;
}

/**
 * Truncate a signature for display
 */
export function truncateSignature(signature: string, startChars: number = 8, endChars: number = 8): string {
  if (signature.length <= startChars + endChars) {
    return signature;
  }
  return `${signature.slice(0, startChars)}...${signature.slice(-endChars)}`;
}
