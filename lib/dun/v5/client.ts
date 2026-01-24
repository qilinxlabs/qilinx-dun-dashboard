/**
 * Dun V5 Client - x402 Privacy Transfer Protocol
 * Uses Anchor's Program interface like V3
 * Uses V3's proof generator and secret manager for cryptography
 */

import { Connection, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import idl from './dun_core_v5.json';
import { COMMON_AMOUNTS } from './types';

// Dynamically import V3's proof generator and secret manager
let v3ProofGenerator: any;
let v3SecretManager: any;

async function loadV3Crypto() {
  if (!v3ProofGenerator || !v3SecretManager) {
    const proofs = await import('@/dun-protocol/sdk/src/v3/proofs');
    const secrets = await import('@/dun-protocol/sdk/src/v3/secrets');
    v3ProofGenerator = proofs.v3ProofGenerator;
    v3SecretManager = secrets.v3SecretManager;
  }
  return { v3ProofGenerator, v3SecretManager };
}

const PROGRAM_ID = new PublicKey('972EkHPNpRyp9BW1G3Gj9WRGnR3bLNJt4T7EtjxdfaN7');
const NATIVE_MINT = new PublicKey('So11111111111111111111111111111111111111112');

export interface CreatePaymentRequestParams {
  amount: number; // In SOL
  expiresIn: number; // In seconds
  metadata?: string;
  wallet: WalletAdapter;
}

export interface PrivacyTransferParams {
  paymentRequestPDA: PublicKey;
  wallet: WalletAdapter;
}

export interface PaymentRequest {
  requestId: Uint8Array;
  payee: PublicKey;
  amount: number; // In lamports
  status: { pending?: {}; paid?: {}; expired?: {}; cancelled?: {} };
  createdAt: number;
  expiresAt: number;
  paidAt?: number;
  metadataHash?: Uint8Array;
  bump: number;
}

/**
 * Dun V5 Client
 * Works like V3 - uses Anchor's Program interface
 */
export class DunV5Client {
  private connection: Connection;
  private wallet: WalletAdapter;
  private program: Program;

  constructor(connection: Connection, wallet: WalletAdapter) {
    this.connection = connection;
    this.wallet = wallet;
    
    // Create program instance - errors are suppressed as they're just validation warnings
    const provider = new AnchorProvider(
      connection,
      wallet as any,
      { commitment: 'confirmed' }
    );
    
    // @ts-ignore - Suppress type errors during Program initialization
    this.program = new Program(idl as any, provider);
    
    console.log('[V5] Client initialized with program:', this.program.programId.toBase58());
  }

  /**
   * Initialize pool vault (one-time setup)
   * Creates the associated token account for the vault authority
   */
  async initializePoolVault(): Promise<string> {
    if (!this.wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    console.log('\n🔐 V5 Initialize Pool Vault');

    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault_authority')],
      PROGRAM_ID
    );

    const poolVault = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      vaultAuthority,
      true
    );

    // Check if vault already exists
    const accountInfo = await this.connection.getAccountInfo(poolVault);
    if (accountInfo) {
      console.log('✓ Pool vault already initialized:', poolVault.toBase58());
      return 'already_initialized';
    }

    console.log('[V5] Creating pool vault:', poolVault.toBase58());
    console.log('[V5] Vault authority:', vaultAuthority.toBase58());

    try {
      // Create associated token account for vault
      const { Transaction, SystemProgram } = await import('@solana/web3.js');
      const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');

      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          this.wallet.publicKey,
          poolVault,
          vaultAuthority,
          NATIVE_MINT
        )
      );

      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet.publicKey;

      const signed = await (this.wallet as any).signTransaction(transaction);
      const txSignature = await this.connection.sendRawTransaction(signed.serialize());
      await this.connection.confirmTransaction(txSignature, 'confirmed');

      console.log('✓ Pool vault initialized:', txSignature);
      return txSignature;
    } catch (error: any) {
      console.error('[V5] Failed to initialize pool vault:', error);
      throw error;
    }
  }

  /**
   * Payee: Create payment request
   */
  async createPaymentRequest(params: CreatePaymentRequestParams): Promise<{ signature: string; address: PublicKey }> {
    if (!this.wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    console.log(`\n🔐 V5 Create Payment Request: ${params.amount} SOL`);

    // Validate amount
    if (!COMMON_AMOUNTS.includes(params.amount)) {
      throw new Error(`Amount must be one of: ${COMMON_AMOUNTS.join(', ')} SOL`);
    }

    const amountLamports = new BN(params.amount * LAMPORTS_PER_SOL);
    const expiresIn = new BN(params.expiresIn);
    const timestamp = new BN(Math.floor(Date.now() / 1000)); // Current Unix timestamp
    
    // Prepare metadata hash
    let metadataHash: number[] | null = null;
    if (params.metadata) {
      const buf = Buffer.from(params.metadata).slice(0, 32);
      const padded = Buffer.alloc(32);
      buf.copy(padded);
      metadataHash = Array.from(padded);
    }

    // Derive payment request PDA (payee + amount + timestamp for uniqueness)
    const [paymentRequest] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('payment_request'),
        this.wallet.publicKey.toBuffer(),
        Buffer.from(amountLamports.toArray('le', 8)),
        Buffer.from(timestamp.toArray('le', 8)),
      ],
      PROGRAM_ID
    );

    console.log('[V5] Payment request PDA:', paymentRequest.toBase58());
    console.log('[V5] Amount:', amountLamports.toString(), 'lamports');
    console.log('[V5] Expires in:', expiresIn.toString(), 'seconds');

    // Check if payment request already exists
    try {
      const existingAccount = await this.connection.getAccountInfo(paymentRequest);
      if (existingAccount) {
        console.log('[V5] Payment request already exists, attempting to close it first...');
        
        // Try to fetch and check status
        try {
          const existingRequest = await (this.program.account as any).paymentRequest.fetch(paymentRequest);
          
          // If it's paid, we can't close it - user needs to use a different amount
          if (existingRequest.status.paid) {
            throw new Error(`A paid payment request for ${params.amount} SOL already exists. Please use a different amount or wait for it to be manually closed.`);
          }
          
          // Try to close the existing request (works for Pending or Cancelled)
          console.log('[V5] Closing existing payment request...');
          const closeTx = await this.program.methods
            .cancelPaymentRequest()
            .accounts({
              payee: this.wallet.publicKey,
              paymentRequest,
            })
            .rpc();
          
          console.log('✓ Existing payment request closed:', closeTx);
          
          // Wait for confirmation
          await this.connection.confirmTransaction(closeTx, 'confirmed');
          console.log('✓ Close transaction confirmed');
        } catch (closeError: any) {
          console.error('[V5] Failed to close existing request:', closeError.message);
          throw new Error(`A payment request for ${params.amount} SOL already exists and cannot be closed. Please use a different amount.`);
        }
      }
    } catch (error: any) {
      // If it's our custom error, rethrow it
      if (error.message?.includes('already exists')) {
        throw error;
      }
      // Otherwise, continue with creation (account might not exist)
      console.log('[V5] No existing payment request found, proceeding with creation');
    }

    try {
      // Call the program
      const tx = await this.program.methods
        .createPaymentRequest(amountLamports, expiresIn, timestamp, metadataHash)
        .accounts({
          payee: this.wallet.publicKey,
          paymentRequest,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('✓ Payment request created:', tx);
      return { signature: tx, address: paymentRequest };
    } catch (error: any) {
      console.error('[V5] Transaction failed:', error);
      console.error('[V5] Error message:', error.message);
      console.error('[V5] Error logs:', error.logs);
      throw error;
    }
  }

  /**
   * Payer: Execute privacy transfer
   * Uses V3's proof generator and secret manager for commitment generation
   */
  async privacyTransfer(params: PrivacyTransferParams): Promise<string> {
    if (!this.wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    console.log(`\n🔐 V5 Privacy Transfer`);

    // Load V3 crypto libraries
    const { v3ProofGenerator, v3SecretManager } = await loadV3Crypto();

    // Fetch payment request
    const paymentRequest = await (this.program.account as any).paymentRequest.fetch(
      params.paymentRequestPDA
    ) as PaymentRequest;

    console.log('[V5] Payment request:', {
      payee: paymentRequest.payee.toBase58(),
      amount: paymentRequest.amount.toString(),
      status: paymentRequest.status,
    });

    const amountLamports = BigInt(paymentRequest.amount.toString());

    // Derive secret deterministically using V3's secret manager
    // Try different nonces until we find one that doesn't have an existing commitment account
    let nonce = 0;
    let secret: bigint;
    let commitment: string;
    let commitmentBytes: Uint8Array;
    let commitmentAccount: PublicKey;
    let commitmentExists = true;
    const MAX_NONCE_ATTEMPTS = 1000;

    while (commitmentExists && nonce < MAX_NONCE_ATTEMPTS) {
      secret = await v3SecretManager.deriveSecret(
        this.wallet,
        nonce,
        amountLamports
      );

      // Compute commitment using V3's proof generator
      commitment = await v3ProofGenerator.computeCommitment(
        amountLamports,
        secret
      );

      // Convert commitment string to 32-byte array (same as V3)
      const commitmentBigInt = BigInt(commitment);
      commitmentBytes = new Uint8Array(32);
      let value = commitmentBigInt;
      for (let i = 31; i >= 0; i--) {
        commitmentBytes[i] = Number(value & 0xFFn);
        value = value >> 8n;
      }

      // Derive commitment account
      [commitmentAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('commitment'), Buffer.from(commitmentBytes)],
        PROGRAM_ID
      );

      // Check if commitment account already exists
      const existingAccount = await this.connection.getAccountInfo(commitmentAccount);
      if (!existingAccount) {
        commitmentExists = false;
        console.log('[V5] Found unused nonce:', nonce);
      } else {
        console.log('[V5] Commitment account exists for nonce', nonce, ', trying next...');
        nonce++;
      }
    }

    if (commitmentExists) {
      throw new Error('Could not find unused commitment nonce. Please try again later.');
    }

    console.log('[V5] Commitment computed:', commitment!);
    console.log('[V5] Using V3 crypto (Poseidon hash) with nonce:', nonce);

    // Get token accounts
    const payerTokenAccount = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      this.wallet.publicKey
    );

    const payeeTokenAccount = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      paymentRequest.payee
    );

    // Check if payee token account exists, create if needed
    const { Transaction, SystemProgram } = await import('@solana/web3.js');
    const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');
    
    const payeeAccountInfo = await this.connection.getAccountInfo(payeeTokenAccount);
    const needsPayeeAccount = !payeeAccountInfo;

    if (needsPayeeAccount) {
      console.log('[V5] Payee token account does not exist, will create it');
    }

    // Get pool vault
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault_authority')],
      PROGRAM_ID
    );

    const poolVault = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      vaultAuthority,
      true
    );

    console.log('[V5] Accounts:', {
      payer: this.wallet.publicKey.toBase58(),
      payerTokenAccount: payerTokenAccount.toBase58(),
      poolVault: poolVault.toBase58(),
      vaultAuthority: vaultAuthority.toBase58(),
      commitmentAccount: commitmentAccount!.toBase58(),
      paymentRequest: params.paymentRequestPDA.toBase58(),
      payeeTokenAccount: payeeTokenAccount.toBase58(),
      needsPayeeAccount,
    });

    try {
      // If payee token account doesn't exist, create it first in a separate transaction
      if (needsPayeeAccount) {
        console.log('[V5] Creating payee token account...');
        
        const createAccountIx = createAssociatedTokenAccountInstruction(
          this.wallet.publicKey, // payer
          payeeTokenAccount,
          paymentRequest.payee, // owner
          NATIVE_MINT
        );
        
        const createTx = new Transaction().add(createAccountIx);
        const { blockhash: createBlockhash } = await this.connection.getLatestBlockhash();
        createTx.recentBlockhash = createBlockhash;
        createTx.feePayer = this.wallet.publicKey;
        
        const signedCreateTx = await (this.wallet as any).signTransaction(createTx);
        const createSig = await this.connection.sendRawTransaction(signedCreateTx.serialize());
        await this.connection.confirmTransaction(createSig, 'confirmed');
        console.log('✓ Payee token account created:', createSig);
      }

      // Now execute privacy transfer
      const tx = await this.program.methods
        .privacyTransfer(Array.from(commitmentBytes!))
        .accounts({
          payer: this.wallet.publicKey,
          payerTokenAccount,
          poolVault,
          tokenMint: NATIVE_MINT,
          vaultAuthority,
          commitmentAccount: commitmentAccount!,
          paymentRequest: params.paymentRequestPDA,
          payeeTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('✓ Privacy transfer completed:', tx);
      console.log('✓ Commitment:', commitment!);
      console.log('✓ Amount: HIDDEN (using Poseidon hash)');
      return tx;
    } catch (error: any) {
      console.error('[V5] Transaction failed:', error);
      console.error('[V5] Error message:', error.message);
      console.error('[V5] Error logs:', error.logs);
      throw error;
    }
  }

  /**
   * Payee: Cancel payment request
   */
  async cancelPaymentRequest(paymentRequestAddress: string): Promise<string> {
    if (!this.wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    console.log(`\n🔐 V5 Cancel Payment Request`);

    const paymentRequestPubkey = new PublicKey(paymentRequestAddress);

    try {
      const tx = await this.program.methods
        .cancelPaymentRequest()
        .accounts({
          payee: this.wallet.publicKey,
          paymentRequest: paymentRequestPubkey,
        })
        .rpc();

      console.log('✓ Payment request cancelled:', tx);
      return tx;
    } catch (error: any) {
      console.error('[V5] Transaction failed:', error);
      console.error('[V5] Error message:', error.message);
      console.error('[V5] Error logs:', error.logs);
      throw error;
    }
  }

  /**
   * Get a single payment request
   */
  async getPaymentRequest(address: PublicKey): Promise<any> {
    try {
      const account = await (this.program.account as any).paymentRequest.fetch(address);
      
      // Convert BN to number for amount
      const amountLamports = typeof account.amount === 'object' && 'toNumber' in account.amount
        ? account.amount.toNumber()
        : Number(account.amount);
      
      return {
        requestId: Buffer.from(account.requestId).toString('hex'),
        payee: account.payee,
        amount: amountLamports / LAMPORTS_PER_SOL,
        status: account.status.pending ? 'Pending' :
                account.status.paid ? 'Paid' :
                account.status.expired ? 'Expired' :
                'Cancelled',
        createdAt: new Date(account.createdAt * 1000),
        expiresAt: new Date(account.expiresAt * 1000),
        paidAt: account.paidAt ? new Date(account.paidAt * 1000) : undefined,
        metadataHash: account.metadataHash ? Buffer.from(account.metadataHash).toString('hex') : undefined,
        paymentUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/dapp/x402-playground?request=${address.toBase58()}`,
        pda: address,
      };
    } catch (error: any) {
      console.error('[V5] Failed to get payment request:', error);
      throw error;
    }
  }

  /**
   * List all payment requests for a payee
   */
  async listPaymentRequests(payee?: PublicKey): Promise<any[]> {
    const targetPayee = payee || this.wallet.publicKey;
    if (!targetPayee) {
      throw new Error('No payee specified and wallet not connected');
    }

    console.log(`\n🔍 Listing payment requests for:`, targetPayee.toBase58());

    try {
      const accounts = await (this.program.account as any).paymentRequest.all([
        {
          memcmp: {
            offset: 8 + 32, // discriminator + request_id
            bytes: targetPayee.toBase58(),
          },
        },
      ]);

      console.log(`Found ${accounts.length} payment requests`);

      // Convert each account to proper format
      return accounts.map((acc: any) => {
        const account = acc.account;
        
        // Convert BN to number for amount
        const amountLamports = typeof account.amount === 'object' && 'toNumber' in account.amount
          ? account.amount.toNumber()
          : Number(account.amount);
        
        return {
          requestId: Buffer.from(account.requestId).toString('hex'),
          payee: account.payee,
          amount: amountLamports / LAMPORTS_PER_SOL,
          status: account.status.pending ? 'Pending' :
                  account.status.paid ? 'Paid' :
                  account.status.expired ? 'Expired' :
                  'Cancelled',
          createdAt: new Date(account.createdAt * 1000),
          expiresAt: new Date(account.expiresAt * 1000),
          paidAt: account.paidAt ? new Date(account.paidAt * 1000) : undefined,
          metadataHash: account.metadataHash ? Buffer.from(account.metadataHash).toString('hex') : undefined,
          paymentUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/dapp/x402-playground?request=${acc.publicKey.toBase58()}`,
          pda: acc.publicKey,
        };
      });
    } catch (error: any) {
      console.error('[V5] Failed to list payment requests:', error);
      throw error;
    }
  }
}
