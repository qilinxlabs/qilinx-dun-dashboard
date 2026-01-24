import { PublicKey } from '@solana/web3.js';

/**
 * Validates if a string is a valid Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    const pubkey = new PublicKey(address);
    return PublicKey.isOnCurve(pubkey.toBytes());
  } catch {
    return false;
  }
}

/**
 * Converts human-readable amount to smallest unit (lamports)
 */
export function toSmallestUnit(amount: number, decimals: number): number {
  return Math.floor(amount * Math.pow(10, decimals));
}

/**
 * Converts smallest unit (lamports) to human-readable amount
 */
export function fromSmallestUnit(amount: number, decimals: number): number {
  return amount / Math.pow(10, decimals);
}

/**
 * Formats amount with token symbol for display
 */
export function formatAmount(amount: number, decimals: number, symbol: string): string {
  return `${fromSmallestUnit(amount, decimals).toFixed(decimals)} ${symbol}`;
}

/**
 * Generates Solana explorer URL for a transaction
 */
export function getSolanaExplorerUrl(
  signature: string,
  cluster: 'mainnet-beta' | 'devnet' | 'testnet' = 'mainnet-beta'
): string {
  return `https://explorer.solana.com/tx/${signature}${
    cluster !== 'mainnet-beta' ? `?cluster=${cluster}` : ''
  }`;
}

/**
 * Truncates a signature for display
 */
export function truncateSignature(
  signature: string,
  startChars: number = 8,
  endChars: number = 8
): string {
  if (signature.length <= startChars + endChars) return signature;
  return `${signature.slice(0, startChars)}...${signature.slice(-endChars)}`;
}

/**
 * Validates if amount is positive
 */
export function isValidAmount(amount: string): boolean {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0;
}

/**
 * Validates if amount does not exceed balance
 */
export function isAmountWithinBalance(amount: number, balance: number): boolean {
  return amount > 0 && amount <= balance;
}
