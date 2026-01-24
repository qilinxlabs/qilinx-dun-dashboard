import { Keypair, PublicKey } from '@solana/web3.js';
import { buildPoseidon } from 'circomlibjs';
import bs58 from 'bs58';

/**
 * Derive secrets from wallet signature (works for both CLI and browser wallets)
 * 
 * CLI: Sign with private key from .env
 * Browser: User signs message with Phantom/Solflare
 */
export class SignatureSecrets {
    private poseidon: any;
    private initialized = false;

    async init() {
        if (!this.initialized) {
            this.poseidon = await buildPoseidon();
            this.initialized = true;
        }
    }

    /**
     * Get signature from wallet
     * 
     * @param walletOrKeypair - Either a browser wallet adapter or a Keypair
     * @param message - Message to sign (default: "Dun Protocol Secret Derivation")
     * @returns Signature as Uint8Array
     */
    async getSignature(
        walletOrKeypair: any,
        message: string = "Dun Protocol Secret Derivation"
    ): Promise<Uint8Array> {
        const messageBytes = new TextEncoder().encode(message);

        // Check if it's a Keypair (CLI mode)
        if (walletOrKeypair.secretKey) {
            const keypair = walletOrKeypair as Keypair;
            // Sign with ed25519
            const nacl = await import('tweetnacl');
            return nacl.sign.detached(messageBytes, keypair.secretKey);
        }

        // Browser wallet mode (Phantom, Solflare, etc.)
        if (walletOrKeypair.signMessage) {
            return await walletOrKeypair.signMessage(messageBytes);
        }

        throw new Error('Invalid wallet: must be Keypair or have signMessage method');
    }

    /**
     * Derive a deterministic "private key" from signature
     * This is used in ZK circuits for ownership proof
     * 
     * @param signature - Wallet signature
     * @returns Deterministic private key as BigInt
     */
    async derivePrivateKey(signature: Uint8Array): Promise<bigint> {
        await this.init();
        
        // Use first 31 bytes of signature
        const signatureBytes = signature.slice(0, 31);
        const privateKey = BigInt('0x' + Buffer.from(signatureBytes).toString('hex'));
        
        return privateKey;
    }

    /**
     * Derive a deterministic blinding factor for a specific deposit
     * 
     * @param signature - Wallet signature
     * @param depositIndex - Index of this deposit (0, 1, 2, ...)
     * @param amount - Amount being deposited (for uniqueness)
     * @returns Deterministic blinding factor as BigInt
     */
    async deriveBlindingFactor(
        signature: Uint8Array,
        depositIndex: number,
        amount: bigint
    ): Promise<bigint> {
        await this.init();
        
        // Derive from: signature + deposit_index + amount
        const signatureBytes = signature.slice(0, 31);
        const signatureBigInt = BigInt('0x' + Buffer.from(signatureBytes).toString('hex'));
        
        // Hash: Poseidon(signature, deposit_index, amount)
        // Convert all inputs to strings for Poseidon
        const hash = this.poseidon([
            signatureBigInt.toString(),
            depositIndex.toString(),
            amount.toString()
        ]);
        
        return BigInt(this.poseidon.F.toString(hash));
    }

    /**
     * Compute commitment from amount and blinding factor
     * commitment = Poseidon(amount, blinding_factor)
     */
    async computeCommitment(amount: bigint, blindingFactor: bigint): Promise<string> {
        await this.init();
        
        const hash = this.poseidon([
            amount.toString(),
            blindingFactor.toString()
        ]);
        
        return this.poseidon.F.toString(hash);
    }

    /**
     * Compute nullifier for withdrawal
     * nullifier = Poseidon(private_key, amount, blinding_factor)
     */
    async computeNullifier(
        privateKey: bigint,
        amount: bigint,
        blindingFactor: bigint
    ): Promise<string> {
        await this.init();
        
        const hash = this.poseidon([
            privateKey.toString(),
            amount.toString(),
            blindingFactor.toString()
        ]);
        
        return this.poseidon.F.toString(hash);
    }

    /**
     * Helper: Create a signature-based keypair for CLI testing
     * Derives a keypair from the signature (useful for testing)
     */
    async signatureToKeypair(signature: Uint8Array): Promise<Keypair> {
        // Use signature as seed for keypair
        const seed = signature.slice(0, 32);
        return Keypair.fromSeed(seed);
    }
}

/**
 * Example usage:
 * 
 * // CLI Mode (testing):
 * const keypair = Keypair.fromSecretKey(...);
 * const secrets = new SignatureSecrets();
 * const signature = await secrets.getSignature(keypair);
 * const privateKey = await secrets.derivePrivateKey(signature);
 * 
 * // Browser Mode (dApp):
 * const { signMessage } = useWallet(); // Phantom/Solflare
 * const secrets = new SignatureSecrets();
 * const signature = await secrets.getSignature({ signMessage });
 * const privateKey = await secrets.derivePrivateKey(signature);
 * 
 * // Both modes produce the same result for the same wallet!
 */
