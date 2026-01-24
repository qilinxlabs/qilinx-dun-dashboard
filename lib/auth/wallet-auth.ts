import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

/**
 * Generate a random nonce for wallet authentication
 */
export function generateNonce(): string {
  return `Sign this message to authenticate with your wallet: ${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Verify a signed message from a Solana wallet
 * @param walletAddress - The public key of the wallet
 * @param signature - The signature bytes (base58 encoded)
 * @param message - The original message that was signed
 * @returns true if signature is valid
 */
export function verifyWalletSignature(
  walletAddress: string,
  signature: string,
  message: string
): boolean {
  try {
    // Decode the signature from base58
    const signatureBytes = bs58.decode(signature);
    
    // Encode the message as bytes
    const messageBytes = new TextEncoder().encode(message);
    
    // Get the public key
    const publicKey = new PublicKey(walletAddress);
    
    // Verify the signature
    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );
  } catch (error) {
    console.error('Error verifying wallet signature:', error);
    return false;
  }
}

/**
 * Validate Solana wallet address format
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}
