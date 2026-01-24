/**
 * Dun V3 Secret Management
 * Deterministic secret derivation from wallet signature
 * 
 * Uses dynamic imports for heavy crypto libraries to improve initial load time
 */

import { WalletAdapter } from '@solana/wallet-adapter-base';
import * as crypto from 'crypto';

/**
 * V3 Secret Manager with lazy-loaded crypto libraries
 * Derives secrets deterministically from wallet signature
 */
export class V3SecretManager {
    private poseidon: any;
    private initialized = false;
    private initPromise: Promise<void> | null = null;
    private cachedSignature: Uint8Array | null = null;
    private signatureRejected = false; // Flag to prevent retry loops

    async init() {
        // Prevent multiple simultaneous initializations
        if (this.initPromise) {
            return this.initPromise;
        }

        if (!this.initialized) {
            this.initPromise = (async () => {
                // Dynamically import circomlibjs
                const { buildPoseidon } = await import('circomlibjs');
                this.poseidon = await buildPoseidon();
                this.initialized = true;
            })();
            
            await this.initPromise;
        }
    }

    /**
     * Get wallet signature (cached for session)
     * User signs once per session
     */
    async getWalletSignature(wallet: WalletAdapter): Promise<Uint8Array> {
        if (this.cachedSignature) {
            console.log('✓ Using cached signature');
            return this.cachedSignature;
        }

        // If user previously rejected, don't retry
        if (this.signatureRejected) {
            throw new Error('User rejected the signature request. Please refresh the page to try again.');
        }

        if (!wallet.publicKey) {
            throw new Error('Wallet not connected');
        }

        // Request signature from wallet
        console.log('🔐 Requesting wallet signature (one-time for this session)...');
        const message = new TextEncoder().encode('Sign to access Dun Privacy Pool');
        
        // Check if wallet supports message signing
        const walletWithSignMessage = wallet as any;
        if (!walletWithSignMessage.signMessage || typeof walletWithSignMessage.signMessage !== 'function') {
            throw new Error('Wallet does not support message signing');
        }

        try {
            const signature = await walletWithSignMessage.signMessage(message);
            this.cachedSignature = signature;
            this.signatureRejected = false; // Reset flag on success
            
            console.log('✓ Wallet signature obtained and cached for session');
            return signature;
        } catch (error: any) {
            console.error('❌ Signature request failed:', error);
            
            // Check if user rejected the signature request
            // Handle various wallet rejection patterns
            const errorMessage = error.message?.toLowerCase() || '';
            const errorName = error.name?.toLowerCase() || '';
            
            if (errorMessage.includes('user rejected') || 
                errorMessage.includes('user denied') ||
                errorMessage.includes('rejected') ||
                errorMessage.includes('denied') ||
                errorMessage.includes('cancelled') ||
                errorMessage.includes('canceled') ||
                errorName.includes('walletconnectionerror') ||
                errorName.includes('walletsigntransactionerror') ||
                error.code === 4001 ||
                error.code === -32603 ||
                error.code === 'ACTION_REJECTED') {
                
                // Set flag to prevent retry
                this.signatureRejected = true;
                throw new Error('User rejected the signature request. Please refresh the page to try again.');
            }
            
            // Re-throw other errors
            throw error;
        }
    }

    /**
     * Derive master private key from wallet signature
     */
    async deriveMasterKey(wallet: WalletAdapter): Promise<bigint> {
        await this.init();
        
        const signature = await this.getWalletSignature(wallet);
        
        // Use first 31 bytes of signature as master key
        const keyBytes = signature.slice(0, 31);
        const masterKey = BigInt('0x' + Buffer.from(keyBytes).toString('hex'));
        
        return masterKey;
    }

    /**
     * Derive secret for a specific deposit
     * secret = Poseidon(masterKey, nonce, amount)
     */
    async deriveSecret(
        wallet: WalletAdapter,
        nonce: number,
        amount: bigint
    ): Promise<bigint> {
        await this.init();
        
        const masterKey = await this.deriveMasterKey(wallet);
        
        // Hash: Poseidon(masterKey, nonce, amount)
        // Poseidon expects BigInt values
        const hash = this.poseidon([
            masterKey,
            BigInt(nonce),
            amount
        ]);
        
        return BigInt(this.poseidon.F.toString(hash));
    }

    /**
     * Generate random secret (for change commitments)
     */
    generateRandomSecret(): bigint {
        const randomBytes = crypto.randomBytes(31);
        return BigInt('0x' + randomBytes.toString('hex'));
    }

    /**
     * Scan for owned commitments
     * Tries to derive secrets for all commitments on-chain
     */
    async scanCommitments(
        wallet: WalletAdapter,
        commitments: Array<{ commitment: string; address: string }>,
        possibleAmounts: bigint[],
        maxNonce: number = 100
    ): Promise<Array<{
        commitment: string;
        address: string;
        amount: bigint;
        secret: bigint;
        nonce: number;
    }>> {
        await this.init();
        
        console.log(`🔍 Scanning ${commitments.length} commitments...`);
        console.log(`   Trying ${possibleAmounts.length} amounts × ${maxNonce} nonces`);
        
        const ownedCommitments = [];
        
        for (const { commitment, address } of commitments) {
            // Try all possible amounts and nonces
            for (const amount of possibleAmounts) {
                for (let nonce = 0; nonce < maxNonce; nonce++) {
                    try {
                        // Derive secret
                        const secret = await this.deriveSecret(wallet, nonce, amount);
                        
                        // Compute commitment
                        const hash = this.poseidon([amount, secret]);
                        const computedCommitment = this.poseidon.F.toString(hash);
                        
                        // Does it match?
                        if (computedCommitment === commitment) {
                            console.log(`✓ Found owned commitment: ${amount.toString()} (nonce: ${nonce})`);
                            ownedCommitments.push({
                                commitment,
                                address,
                                amount,
                                secret,
                                nonce,
                            });
                            break; // Found it, move to next commitment
                        }
                    } catch (error) {
                        // Continue trying
                    }
                }
            }
        }
        
        console.log(`✓ Found ${ownedCommitments.length} owned commitments`);
        return ownedCommitments;
    }

    /**
     * Clear cached signature (logout)
     */
    clearCache() {
        this.cachedSignature = null;
        this.signatureRejected = false; // Reset rejection flag
        console.log('✓ Signature cache cleared');
    }
}

// Singleton instance
export const v3SecretManager = new V3SecretManager();

/**
 * Common amounts to try when scanning (in lamports)
 */
export const COMMON_AMOUNTS = [
    BigInt(10_000_000),      // 0.01 SOL
    BigInt(50_000_000),      // 0.05 SOL
    BigInt(100_000_000),     // 0.1 SOL
    BigInt(500_000_000),     // 0.5 SOL
    BigInt(1_000_000_000),   // 1 SOL
    BigInt(5_000_000_000),   // 5 SOL
    BigInt(10_000_000_000),  // 10 SOL
    BigInt(50_000_000_000),  // 50 SOL
    BigInt(100_000_000_000), // 100 SOL
];
