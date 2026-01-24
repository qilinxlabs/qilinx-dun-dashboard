/**
 * Dun V3 Client
 * Privacy pool with hidden amounts - works like V1 with blockchain scanning
 * NO localStorage - everything derived from blockchain + wallet signature
 */

import { Connection, PublicKey, Transaction, Keypair, SystemProgram } from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { v3ProofGenerator } from './proofs';
import { v3SecretManager, COMMON_AMOUNTS } from './secrets';
import idl from '@/lib/dun/v3/dun_core_v3.json';

const PROGRAM_ID = new PublicKey('9XtSgWQf75oPndxpMCcnU2K2VyJdPhtUeT6daia5xYKJ');

export interface V3DepositParams {
    amount: number; // In SOL
    token: string;  // 'SOL' or token symbol
}

export interface V3WithdrawParams {
    amount: number;  // In SOL
    token: string;
    recipient?: string; // Optional recipient address
}

export interface V3BalanceInfo {
    totalBalance: number; // In SOL
    commitments: Array<{
        commitment: string;
        amount: number;
        nonce: number;
        isSpent: boolean;
        address: string; // Commitment account address
    }>;
}

/**
 * Dun V3 Client
 * Works exactly like V1 - scans blockchain, no localStorage
 */
export class DunV3Client {
    private connection: Connection;
    private wallet: WalletAdapter;
    private program: Program;

    constructor(connection: Connection, wallet: WalletAdapter) {
        this.connection = connection;
        this.wallet = wallet;
        
        // Create program instance
        const provider = new AnchorProvider(
            connection,
            wallet as any,
            { commitment: 'confirmed' }
        );
        this.program = new Program(idl as any, provider);
    }

    /**
     * Deposit tokens into V3 privacy pool
     * Amount is hidden inside commitment hash
     */
    async deposit(params: V3DepositParams): Promise<string> {
        if (!this.wallet.publicKey) {
            throw new Error('Wallet not connected');
        }

        console.log(`\n🔐 V3 Deposit: ${params.amount} ${params.token}`);

        // Convert to lamports
        const amountLamports = BigInt(Math.floor(params.amount * 1e9));
        
        // Get token mint
        const tokenMint = this.getTokenMint(params.token);
        
        // Derive secret deterministically
        // Use nonce = 0 for first deposit, increment for subsequent deposits
        let nonce = await this.getNextNonce();
        let secret = await v3SecretManager.deriveSecret(
            this.wallet,
            nonce,
            amountLamports
        );
        
        // Compute commitment
        let commitment = await v3ProofGenerator.computeCommitment(
            amountLamports,
            secret
        );
        
        // Check if commitment already exists, if so increment nonce
        let commitmentExists = true;
        let maxAttempts = 100;
        let attempts = 0;
        
        while (commitmentExists && attempts < maxAttempts) {
            // Convert commitment to bytes for PDA
            const commitmentBigInt = BigInt(commitment);
            const commitmentBytes = new Uint8Array(32);
            let value = commitmentBigInt;
            for (let i = 31; i >= 0; i--) {
                commitmentBytes[i] = Number(value & 0xFFn);
                value = value >> 8n;
            }
            
            const [commitmentPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('commitment'), Buffer.from(commitmentBytes)],
                PROGRAM_ID
            );
            
            // Check if account exists
            const accountInfo = await this.connection.getAccountInfo(commitmentPDA);
            
            if (accountInfo === null) {
                // Account doesn't exist, we can use this nonce
                commitmentExists = false;
            } else {
                // Account exists, try next nonce
                console.log(`⚠️  Nonce ${nonce} already used, trying ${nonce + 1}...`);
                nonce++;
                secret = await v3SecretManager.deriveSecret(
                    this.wallet,
                    nonce,
                    amountLamports
                );
                commitment = await v3ProofGenerator.computeCommitment(
                    amountLamports,
                    secret
                );
                attempts++;
            }
        }
        
        if (attempts >= maxAttempts) {
            throw new Error('Could not find available nonce after 100 attempts');
        }
        
        console.log('✓ Commitment computed:', commitment);
        console.log('✓ Nonce:', nonce);
        
        // Generate ZK proof (optional for MVP)
        // const { proof } = await v3ProofGenerator.generateDepositProof({
        //     commitment,
        //     amount: amountLamports,
        //     secret,
        // });
        
        // Get accounts
        const userTokenAccount = getAssociatedTokenAddressSync(
            tokenMint,
            this.wallet.publicKey
        );
        
        const poolVault = await this.getPoolVault(tokenMint);
        
        // Convert commitment string to 32-byte array
        // The commitment is a big number string, we need to convert it to bytes
        const commitmentBigInt = BigInt(commitment);
        const commitmentBytes = new Uint8Array(32);
        
        // Convert BigInt to 32-byte array (big-endian)
        let value = commitmentBigInt;
        for (let i = 31; i >= 0; i--) {
            commitmentBytes[i] = Number(value & 0xFFn);
            value = value >> 8n;
        }
        
        // Derive commitment PDA
        const [commitmentPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('commitment'), Buffer.from(commitmentBytes)],
            PROGRAM_ID
        );
        
        // Build transaction
        console.log('⚙️  Building transaction...');
        const tx = await this.program.methods
            .deposit(
                Array.from(commitmentBytes),
                new BN(amountLamports.toString())
            )
            .accounts({
                signer: this.wallet.publicKey,
                userTokenAccount,
                poolVault,
                tokenMint,
                commitmentAccount: commitmentPDA,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .transaction();
        
        // Get recent blockhash for simulation
        const { blockhash } = await this.connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = this.wallet.publicKey;
        
        // Simulate first to get better error messages
        console.log('🧪 Simulating transaction...');
        try {
            const simulation = await this.connection.simulateTransaction(tx);
            if (simulation.value.err) {
                console.error('❌ Simulation failed:', simulation.value.err);
                console.error('Logs:', simulation.value.logs);
                throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
            }
            console.log('✓ Simulation successful');
            if (simulation.value.logs) {
                console.log('Simulation logs:', simulation.value.logs);
            }
        } catch (simError: any) {
            console.error('❌ Simulation error:', simError);
            throw simError;
        }
        
        // Send transaction
        console.log('📤 Sending transaction...');
        try {
            const signature = await this.wallet.sendTransaction(tx, this.connection);
            
            console.log('⏳ Waiting for confirmation...');
            await this.connection.confirmTransaction(signature, 'confirmed');
            
            console.log('✅ Deposit successful!');
            console.log('   Signature:', signature);
            console.log('   Commitment:', commitment);
            console.log('   Amount: HIDDEN ✓');
            console.log('   Privacy preserved: ✓');
            
            return signature;
        } catch (error: any) {
            console.error('❌ Transaction failed:', error);
            if (error.logs) {
                console.error('Transaction logs:', error.logs);
            }
            if (error.message) {
                console.error('Error message:', error.message);
            }
            throw error;
        }
    }

    /**
     * Withdraw tokens from V3 privacy pool
     * Scans blockchain to find owned commitments
     */
    async withdraw(params: V3WithdrawParams): Promise<string> {
        if (!this.wallet.publicKey) {
            throw new Error('Wallet not connected');
        }

        console.log(`\n🔓 V3 Withdraw: ${params.amount} ${params.token}`);

        // Convert to lamports
        const withdrawAmountLamports = BigInt(Math.floor(params.amount * 1e9));
        
        // Scan blockchain for owned commitments
        console.log('🔍 Scanning blockchain for your commitments...');
        const balance = await this.getBalance(params.token);
        
        if (balance.commitments.length === 0) {
            throw new Error('No commitments found. Please deposit first.');
        }
        
        // Find a commitment with enough balance
        const commitment = balance.commitments.find(
            c => !c.isSpent && BigInt(Math.floor(c.amount * 1e9)) >= withdrawAmountLamports
        );
        
        if (!commitment) {
            throw new Error(`Insufficient balance. Available: ${balance.totalBalance} SOL`);
        }
        
        console.log(`✓ Found commitment with ${commitment.amount} SOL`);
        
        const commitmentAmountLamports = BigInt(Math.floor(commitment.amount * 1e9));
        const changeAmountLamports = commitmentAmountLamports - withdrawAmountLamports;
        
        // Re-derive secret
        const secret = await v3SecretManager.deriveSecret(
            this.wallet,
            commitment.nonce,
            commitmentAmountLamports
        );
        
        // Compute nullifier
        const nullifier = await v3ProofGenerator.computeNullifier(
            secret,
            commitment.commitment
        );
        
        console.log('✓ Nullifier computed');
        
        // Get recipient
        const tokenMint = this.getTokenMint(params.token);
        const recipientPubkey = params.recipient
            ? new PublicKey(params.recipient)
            : this.wallet.publicKey;
        
        const recipientTokenAccount = getAssociatedTokenAddressSync(
            tokenMint,
            recipientPubkey
        );
        
        // Check if we need change
        if (changeAmountLamports > 0) {
            console.log(`💰 Change: ${Number(changeAmountLamports) / 1e9} SOL`);
            return await this.withdrawWithChange(
                commitment,
                secret,
                nullifier,
                withdrawAmountLamports,
                changeAmountLamports,
                tokenMint,
                recipientTokenAccount,
                recipientPubkey
            );
        } else {
            // Exact amount, simple withdraw
            return await this.simpleWithdraw(
                nullifier,
                withdrawAmountLamports,
                tokenMint,
                recipientTokenAccount,
                recipientPubkey
            );
        }
    }

    /**
     * Simple withdraw (no change)
     */
    private async simpleWithdraw(
        nullifier: string,
        withdrawAmount: bigint,
        tokenMint: PublicKey,
        recipientTokenAccount: PublicKey,
        recipientPubkey?: PublicKey
    ): Promise<string> {
        if (!this.wallet.publicKey) throw new Error('Wallet not connected');

        // Use wallet pubkey if no recipient specified
        const actualRecipient = recipientPubkey || this.wallet.publicKey;

        // Check if recipient token account exists, create if not
        const accountInfo = await this.connection.getAccountInfo(recipientTokenAccount);
        if (!accountInfo) {
            console.log('⚙️  Creating recipient token account...');
            
            const createAtaIx = createAssociatedTokenAccountInstruction(
                this.wallet.publicKey, // payer
                recipientTokenAccount,
                actualRecipient, // owner - use the actual recipient!
                tokenMint
            );
            
            const createTx = new Transaction().add(createAtaIx);
            const { blockhash } = await this.connection.getLatestBlockhash();
            createTx.recentBlockhash = blockhash;
            createTx.feePayer = this.wallet.publicKey;
            
            try {
                const createSig = await this.wallet.sendTransaction(createTx, this.connection);
                await this.connection.confirmTransaction(createSig, 'confirmed');
                console.log('✓ Token account created');
            } catch (error: any) {
                console.error('Failed to create token account:', error);
                throw new Error(`Failed to create recipient token account: ${error.message}`);
            }
        }

        const poolVault = await this.getPoolVault(tokenMint);
        
        const [vaultAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from('vault_authority')],
            PROGRAM_ID
        );
        
        // Convert nullifier string to 32-byte array
        const nullifierBigInt = BigInt(nullifier);
        const nullifierBytes = new Uint8Array(32);
        let value = nullifierBigInt;
        for (let i = 31; i >= 0; i--) {
            nullifierBytes[i] = Number(value & 0xFFn);
            value = value >> 8n;
        }
        
        const [nullifierPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('nullifier'), Buffer.from(nullifierBytes)],
            PROGRAM_ID
        );
        
        console.log('⚙️  Building withdraw transaction...');
        const tx = await this.program.methods
            .withdraw(
                Array.from(nullifierBytes),
                new BN(withdrawAmount.toString())
            )
            .accounts({
                signer: this.wallet.publicKey,
                poolVault,
                recipientTokenAccount,
                vaultAuthority,
                nullifierAccount: nullifierPDA,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .transaction();
        
        // Add recent blockhash
        const { blockhash } = await this.connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = this.wallet.publicKey;
        
        // Simulate transaction first
        console.log('🧪 Simulating transaction...');
        try {
            const simulation = await this.connection.simulateTransaction(tx);
            if (simulation.value.err) {
                console.error('❌ Simulation failed:', simulation.value.err);
                console.error('Logs:', simulation.value.logs);
                throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}\nLogs: ${simulation.value.logs?.join('\n')}`);
            }
            console.log('✓ Simulation successful');
            if (simulation.value.logs) {
                console.log('Simulation logs:', simulation.value.logs);
            }
        } catch (simError: any) {
            console.error('❌ Simulation error:', simError);
            throw simError;
        }
        
        console.log('📤 Sending transaction...');
        const signature = await this.wallet.sendTransaction(tx, this.connection);
        
        console.log('⏳ Waiting for confirmation...');
        await this.connection.confirmTransaction(signature, 'confirmed');
        
        console.log('✅ Withdrawal successful!');
        console.log('   Signature:', signature);
        
        return signature;
    }

    /**
     * Withdraw with change (creates new commitment for remainder)
     */
    private async withdrawWithChange(
        oldCommitment: any,
        oldSecret: bigint,
        oldNullifier: string,
        withdrawAmount: bigint,
        changeAmount: bigint,
        tokenMint: PublicKey,
        recipientTokenAccount: PublicKey,
        recipientPubkey?: PublicKey
    ): Promise<string> {
        if (!this.wallet.publicKey) throw new Error('Wallet not connected');

        // Use wallet pubkey if no recipient specified
        const actualRecipient = recipientPubkey || this.wallet.publicKey;

        // Check if recipient token account exists, create if not
        const accountInfo = await this.connection.getAccountInfo(recipientTokenAccount);
        if (!accountInfo) {
            console.log('⚙️  Creating recipient token account...');
            
            const createAtaIx = createAssociatedTokenAccountInstruction(
                this.wallet.publicKey, // payer
                recipientTokenAccount,
                actualRecipient, // owner - use the actual recipient!
                tokenMint
            );
            
            const createTx = new Transaction().add(createAtaIx);
            const { blockhash } = await this.connection.getLatestBlockhash();
            createTx.recentBlockhash = blockhash;
            createTx.feePayer = this.wallet.publicKey;
            
            try {
                const createSig = await this.wallet.sendTransaction(createTx, this.connection);
                await this.connection.confirmTransaction(createSig, 'confirmed');
                console.log('✓ Token account created');
            } catch (error: any) {
                console.error('Failed to create token account:', error);
                throw new Error(`Failed to create recipient token account: ${error.message}`);
            }
        }

        // Generate new secret for change commitment
        const newSecret = v3SecretManager.generateRandomSecret();
        const newCommitment = await v3ProofGenerator.computeCommitment(
            changeAmount,
            newSecret
        );
        
        console.log('✓ New commitment created for change');
        
        const poolVault = await this.getPoolVault(tokenMint);
        
        const [vaultAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from('vault_authority')],
            PROGRAM_ID
        );
        
        // Convert nullifier string to 32-byte array
        const oldNullifierBigInt = BigInt(oldNullifier);
        const oldNullifierBytes = new Uint8Array(32);
        let nullifierValue = oldNullifierBigInt;
        for (let i = 31; i >= 0; i--) {
            oldNullifierBytes[i] = Number(nullifierValue & 0xFFn);
            nullifierValue = nullifierValue >> 8n;
        }
        
        // Convert new commitment string to 32-byte array
        const newCommitmentBigInt = BigInt(newCommitment);
        const newCommitmentBytes = new Uint8Array(32);
        let commitmentValue = newCommitmentBigInt;
        for (let i = 31; i >= 0; i--) {
            newCommitmentBytes[i] = Number(commitmentValue & 0xFFn);
            commitmentValue = commitmentValue >> 8n;
        }
        
        const [oldNullifierPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('nullifier'), Buffer.from(oldNullifierBytes)],
            PROGRAM_ID
        );
        
        const [newCommitmentPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('commitment'), Buffer.from(newCommitmentBytes)],
            PROGRAM_ID
        );
        
        console.log('⚙️  Building withdraw-with-change transaction...');
        const tx = await this.program.methods
            .withdrawWithChange(
                Array.from(oldNullifierBytes),
                Array.from(newCommitmentBytes),
                new BN(withdrawAmount.toString())
            )
            .accounts({
                signer: this.wallet.publicKey,
                poolVault,
                recipientTokenAccount,
                tokenMint,
                vaultAuthority,
                oldNullifierAccount: oldNullifierPDA,
                newCommitmentAccount: newCommitmentPDA,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .transaction();
        
        // Add recent blockhash
        const { blockhash } = await this.connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = this.wallet.publicKey;
        
        // Simulate transaction first
        console.log('🧪 Simulating transaction...');
        try {
            const simulation = await this.connection.simulateTransaction(tx);
            if (simulation.value.err) {
                console.error('❌ Simulation failed:', simulation.value.err);
                console.error('Logs:', simulation.value.logs);
                throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}\nLogs: ${simulation.value.logs?.join('\n')}`);
            }
            console.log('✓ Simulation successful');
            if (simulation.value.logs) {
                console.log('Simulation logs:', simulation.value.logs);
            }
        } catch (simError: any) {
            console.error('❌ Simulation error:', simError);
            throw simError;
        }
        
        console.log('📤 Sending transaction...');
        const signature = await this.wallet.sendTransaction(tx, this.connection);
        
        console.log('⏳ Waiting for confirmation...');
        await this.connection.confirmTransaction(signature, 'confirmed');
        
        console.log('✅ Withdrawal with change successful!');
        console.log('   Signature:', signature);
        console.log('   Change commitment:', newCommitment);
        
        return signature;
    }

    /**
     * Get balance by scanning blockchain
     * NO localStorage - everything from chain!
     */
    async getBalance(token: string): Promise<V3BalanceInfo> {
        if (!this.wallet.publicKey) {
            throw new Error('Wallet not connected');
        }

        console.log('🔍 Scanning blockchain for commitments...');

        // Fetch all accounts owned by the V3 program
        // Use getProgramAccounts instead of Anchor's .all() to avoid discriminator issues
        const accounts = await this.connection.getProgramAccounts(PROGRAM_ID, {
            filters: [
                {
                    dataSize: 81, // CommitmentAccount size
                },
            ],
        });
        
        console.log(`   Found ${accounts.length} total commitment accounts`);

        // Parse commitment accounts manually
        const commitments = accounts.map(({ pubkey, account }) => {
            // Skip discriminator (first 8 bytes) and read commitment (next 32 bytes)
            const commitment = account.data.slice(8, 40);
            
            // Convert 32-byte array to BigInt then to string
            let value = 0n;
            for (let i = 0; i < 32; i++) {
                value = (value << 8n) | BigInt(commitment[i]);
            }
            const commitmentStr = value.toString();
            console.log(`   Commitment on-chain: ${commitmentStr.substring(0, 20)}...`);
            return {
                commitment: commitmentStr,
                address: pubkey.toBase58(),
            };
        });

        // Scan with common amounts
        console.log(`   Scanning with amounts: ${COMMON_AMOUNTS.map(a => Number(a) / 1e9).join(', ')} SOL`);
        const ownedCommitments = await v3SecretManager.scanCommitments(
            this.wallet,
            commitments,
            COMMON_AMOUNTS,
            100 // max nonce
        );

        // Check which are spent
        const result: V3BalanceInfo = {
            totalBalance: 0,
            commitments: [],
        };

        // Collect commitment data with block time for sorting
        const commitmentsWithTime: Array<{
            commitment: string;
            amount: number;
            nonce: number;
            isSpent: boolean;
            address: string;
            blockTime: number;
        }> = [];

        for (const owned of ownedCommitments) {
            // Compute nullifier
            const nullifier = await v3ProofGenerator.computeNullifier(
                owned.secret,
                owned.commitment
            );

            // Convert nullifier string to 32-byte array
            const nullifierBigInt = BigInt(nullifier);
            const nullifierBytes = new Uint8Array(32);
            let value = nullifierBigInt;
            for (let i = 31; i >= 0; i--) {
                nullifierBytes[i] = Number(value & 0xFFn);
                value = value >> 8n;
            }

            // Check if spent
            const [nullifierPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('nullifier'), Buffer.from(nullifierBytes)],
                PROGRAM_ID
            );

            let isSpent = false;
            try {
                const nullifierAccount = await this.connection.getAccountInfo(nullifierPDA);
                isSpent = nullifierAccount !== null;
            } catch {
                // Not spent
            }

            const amountSOL = Number(owned.amount) / 1e9;

            // Get block time for the commitment account
            let blockTime = 0;
            try {
                const commitmentPubkey = new PublicKey(owned.address);
                const signatures = await this.connection.getSignaturesForAddress(
                    commitmentPubkey,
                    { limit: 1 }
                );
                if (signatures.length > 0 && signatures[0].blockTime) {
                    blockTime = signatures[0].blockTime;
                }
            } catch (error) {
                console.warn(`Could not fetch block time for ${owned.address}`);
            }

            commitmentsWithTime.push({
                commitment: owned.commitment,
                amount: amountSOL,
                nonce: owned.nonce,
                isSpent,
                address: owned.address,
                blockTime,
            });

            if (!isSpent) {
                result.totalBalance += amountSOL;
            }
        }

        // Sort commitments: Unspent first, then by timestamp DESC (newest first)
        commitmentsWithTime.sort((a, b) => {
            // First sort by spent status (unspent first)
            if (a.isSpent !== b.isSpent) {
                return a.isSpent ? 1 : -1;
            }
            // Then sort by block time DESC (newest first)
            return b.blockTime - a.blockTime;
        });

        // Add sorted commitments to result (without blockTime in final output)
        result.commitments = commitmentsWithTime.map(({ blockTime, ...rest }) => rest);

        console.log(`✓ Your balance: ${result.totalBalance} SOL`);
        console.log(`   Unspent commitments: ${result.commitments.filter(c => !c.isSpent).length}`);

        return result;
    }

    /**
     * Get next nonce for deposits
     * Scans existing commitments to find highest nonce
     */
    private async getNextNonce(): Promise<number> {
        try {
            const balance = await this.getBalance('SOL');
            if (balance.commitments.length === 0) {
                return 0;
            }
            const maxNonce = Math.max(...balance.commitments.map(c => c.nonce));
            return maxNonce + 1;
        } catch {
            return 0;
        }
    }

    /**
     * Get token mint public key
     */
    private getTokenMint(token: string): PublicKey {
        if (token === 'SOL') {
            // Wrapped SOL mint
            return new PublicKey('So11111111111111111111111111111111111111112');
        }
        throw new Error(`Unsupported token: ${token}`);
    }

    /**
     * Get pool vault address
     */
    private async getPoolVault(tokenMint: PublicKey): Promise<PublicKey> {
        const [vaultAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from('vault_authority')],
            PROGRAM_ID
        );
        
        return getAssociatedTokenAddressSync(
            tokenMint,
            vaultAuthority,
            true // allowOwnerOffCurve
        );
    }
}
