// Error types that might be thrown by ShadowWire SDK
// These are based on the documentation but may need adjustment based on actual SDK implementation
export class RecipientNotFoundError extends Error {
  constructor(message: string = 'Recipient not found') {
    super(message);
    this.name = 'RecipientNotFoundError';
  }
}

export class InsufficientBalanceError extends Error {
  constructor(message: string = 'Insufficient balance') {
    super(message);
    this.name = 'InsufficientBalanceError';
  }
}

export class SignatureRejectedError extends Error {
  constructor(message: string = 'Signature rejected') {
    super(message);
    this.name = 'SignatureRejectedError';
  }
}

/**
 * Handles ShadowWire SDK errors and returns user-friendly messages
 */
export function handleShadowWireError(error: unknown, balance?: number, token?: string): string {
  // Check for specific error types
  if (error instanceof RecipientNotFoundError || 
      (error instanceof Error && error.message.includes('recipient not found'))) {
    return 'Recipient not found. This wallet hasn\'t used ShadowWire yet. Try an external transfer instead.';
  }

  if (error instanceof InsufficientBalanceError || 
      (error instanceof Error && error.message.includes('insufficient balance'))) {
    if (balance !== undefined && token) {
      return `Insufficient balance. You have ${balance} ${token} available.`;
    }
    return 'Insufficient balance for this transfer.';
  }

  if (error instanceof SignatureRejectedError || 
      (error instanceof Error && (
        error.message.includes('user rejected') || 
        error.message.includes('signature rejected') ||
        error.message.includes('User rejected the request')
      ))) {
    return 'Signature rejected. Please approve the signature request in your wallet to continue.';
  }

  // Check for network errors
  if (error instanceof Error && (
    error.message.includes('network') || 
    error.message.includes('timeout') ||
    error.message.includes('fetch failed')
  )) {
    return 'Connection failed. Please check your internet connection and try again.';
  }

  // Check for wallet not connected
  if (error instanceof Error && (
    error.message.includes('wallet not connected') ||
    error.message.includes('no wallet')
  )) {
    return 'Wallet not connected. Please connect your wallet first.';
  }

  // Generic error handling
  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown error occurred. Please try again.';
}
