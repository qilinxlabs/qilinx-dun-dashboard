export interface TokenConfig {
  symbol: string;
  name: string;
  decimals: number;
  mintAddress?: string;  // SPL token mint address (undefined for SOL)
}

export const SUPPORTED_TOKENS: TokenConfig[] = [
  { symbol: 'SOL', name: 'Solana', decimals: 9 },
  { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  { symbol: 'RADR', name: 'Radr', decimals: 9 },
  { symbol: 'ORE', name: 'ORE', decimals: 11 },
  { symbol: 'BONK', name: 'Bonk', decimals: 5 },
  { symbol: 'JIM', name: 'Jim', decimals: 9 },
  { symbol: 'GODL', name: 'GODL', decimals: 11 },
  { symbol: 'HUSTLE', name: 'Hustle', decimals: 9 },
  { symbol: 'ZEC', name: 'Zcash', decimals: 8 },
  { symbol: 'CRT', name: 'DefiCarrot', decimals: 9 },
  { symbol: 'BLACKCOIN', name: 'Blackcoin', decimals: 6 },
  { symbol: 'GIL', name: 'Kith Gil', decimals: 6 },
  { symbol: 'ANON', name: 'ANON', decimals: 9 },
  { symbol: 'WLFI', name: 'World Liberty Financial', decimals: 6 },
  { symbol: 'USD1', name: 'USD1', decimals: 6 },
  { symbol: 'AOL', name: 'AOL', decimals: 6 },
  { symbol: 'IQLABS', name: 'IQ Labs', decimals: 9 },
];

/**
 * Get token configuration by symbol
 */
export function getTokenBySymbol(symbol: string): TokenConfig | undefined {
  return SUPPORTED_TOKENS.find((token) => token.symbol === symbol);
}

/**
 * Get token decimals by symbol
 */
export function getTokenDecimals(symbol: string): number {
  const token = getTokenBySymbol(symbol);
  return token?.decimals ?? 9; // Default to 9 decimals (SOL)
}

/**
 * Check if token is supported
 */
export function isTokenSupported(symbol: string): boolean {
  return SUPPORTED_TOKENS.some((token) => token.symbol === symbol);
}
