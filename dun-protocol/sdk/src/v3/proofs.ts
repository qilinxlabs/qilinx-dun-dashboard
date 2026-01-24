/**
 * Dun V3 Proof Generation
 * Generates ZK proofs for deposit, withdraw, and withdraw-with-change operations
 * 
 * Uses dynamic imports for heavy crypto libraries to improve initial load time
 */

// Circuit paths (relative to project root)
const CIRCUIT_PATHS = {
    deposit: {
        wasm: 'circuits/v3/build/deposit/deposit_js/deposit.wasm',
        zkey: 'circuits/v3/keys/deposit_final.zkey',
        vkey: 'circuits/v3/keys/deposit_verification_key.json',
    },
    withdraw: {
        wasm: 'circuits/v3/build/withdraw/withdraw_js/withdraw.wasm',
        zkey: 'circuits/v3/keys/withdraw_final.zkey',
        vkey: 'circuits/v3/keys/withdraw_verification_key.json',
    },
    withdrawWithChange: {
        wasm: 'circuits/v3/build/withdraw_with_change/withdraw_with_change_js/withdraw_with_change.wasm',
        zkey: 'circuits/v3/keys/withdraw_with_change_final.zkey',
        vkey: 'circuits/v3/keys/withdraw_with_change_verification_key.json',
    },
};

export interface DepositProofInputs {
    commitment: string;
    amount: bigint;
    secret: bigint;
}

export interface WithdrawProofInputs {
    commitment: string;
    nullifier: string;
    withdrawAmount: bigint;
    commitmentAmount: bigint;
    secret: bigint;
}

export interface WithdrawWithChangeProofInputs {
    oldCommitment: string;
    oldNullifier: string;
    newCommitment: string;
    withdrawAmount: bigint;
    oldAmount: bigint;
    oldSecret: bigint;
    newAmount: bigint;
    newSecret: bigint;
}

export interface ProofResult {
    proof: any;
    publicSignals: string[];
}

/**
 * V3 Proof Generator with lazy-loaded crypto libraries
 */
export class V3ProofGenerator {
    private poseidon: any;
    private groth16: any;
    private initialized = false;
    private initPromise: Promise<void> | null = null;

    async init() {
        // Prevent multiple simultaneous initializations
        if (this.initPromise) {
            return this.initPromise;
        }

        if (!this.initialized) {
            this.initPromise = (async () => {
                console.log('🔄 Loading ZK proof libraries (this may take a moment)...');
                const startTime = Date.now();
                
                // Dynamically import heavy libraries
                const [{ buildPoseidon }, { groth16 }] = await Promise.all([
                    import('circomlibjs'),
                    import('snarkjs')
                ]);
                
                this.poseidon = await buildPoseidon();
                this.groth16 = groth16;
                this.initialized = true;
                
                const duration = Date.now() - startTime;
                console.log(`✓ ZK libraries loaded in ${duration}ms`);
            })();
            
            await this.initPromise;
        }
    }

    /**
     * Compute commitment hash
     * commitment = Poseidon(amount, secret)
     */
    async computeCommitment(amount: bigint, secret: bigint): Promise<string> {
        await this.init();
        const hash = this.poseidon([amount, secret]);
        return this.poseidon.F.toString(hash);
    }

    /**
     * Compute nullifier
     * nullifier = Poseidon(secret, commitment)
     */
    async computeNullifier(secret: bigint, commitment: string): Promise<string> {
        await this.init();
        const hash = this.poseidon([secret, BigInt(commitment)]);
        return this.poseidon.F.toString(hash);
    }

    /**
     * Generate deposit proof
     * Proves: commitment = Poseidon(amount, secret) AND amount > 0 AND amount <= MAX
     */
    async generateDepositProof(inputs: DepositProofInputs): Promise<ProofResult> {
        await this.init();

        console.log('🔐 Generating deposit proof...');
        console.log('  Amount:', inputs.amount.toString());
        console.log('  Commitment:', inputs.commitment);

        const circuitInputs = {
            commitment: inputs.commitment,
            amount: inputs.amount.toString(),
            secret: inputs.secret.toString(),
        };

        const startTime = Date.now();
        const { proof, publicSignals } = await this.groth16.fullProve(
            circuitInputs,
            CIRCUIT_PATHS.deposit.wasm,
            CIRCUIT_PATHS.deposit.zkey
        );
        const duration = Date.now() - startTime;

        console.log(`✓ Deposit proof generated in ${duration}ms`);
        console.log(`  Proof size: ${JSON.stringify(proof).length} bytes`);

        return { proof, publicSignals };
    }

    /**
     * Generate withdraw proof
     * Proves: knows secret AND withdrawAmount <= commitmentAmount
     */
    async generateWithdrawProof(inputs: WithdrawProofInputs): Promise<ProofResult> {
        await this.init();

        console.log('🔐 Generating withdraw proof...');
        console.log('  Withdraw amount:', inputs.withdrawAmount.toString());
        console.log('  Commitment amount:', inputs.commitmentAmount.toString());

        const circuitInputs = {
            commitment: inputs.commitment,
            nullifier: inputs.nullifier,
            withdrawAmount: inputs.withdrawAmount.toString(),
            commitmentAmount: inputs.commitmentAmount.toString(),
            secret: inputs.secret.toString(),
        };

        const startTime = Date.now();
        const { proof, publicSignals } = await this.groth16.fullProve(
            circuitInputs,
            CIRCUIT_PATHS.withdraw.wasm,
            CIRCUIT_PATHS.withdraw.zkey
        );
        const duration = Date.now() - startTime;

        console.log(`✓ Withdraw proof generated in ${duration}ms`);
        console.log(`  Proof size: ${JSON.stringify(proof).length} bytes`);

        return { proof, publicSignals };
    }

    /**
     * Generate withdraw-with-change proof
     * Proves: oldAmount = withdrawAmount + newAmount
     */
    async generateWithdrawWithChangeProof(
        inputs: WithdrawWithChangeProofInputs
    ): Promise<ProofResult> {
        await this.init();

        console.log('🔐 Generating withdraw-with-change proof...');
        console.log('  Old amount:', inputs.oldAmount.toString());
        console.log('  Withdraw amount:', inputs.withdrawAmount.toString());
        console.log('  New amount (change):', inputs.newAmount.toString());

        const circuitInputs = {
            oldCommitment: inputs.oldCommitment,
            oldNullifier: inputs.oldNullifier,
            newCommitment: inputs.newCommitment,
            withdrawAmount: inputs.withdrawAmount.toString(),
            oldAmount: inputs.oldAmount.toString(),
            oldSecret: inputs.oldSecret.toString(),
            newAmount: inputs.newAmount.toString(),
            newSecret: inputs.newSecret.toString(),
        };

        const startTime = Date.now();
        const { proof, publicSignals } = await this.groth16.fullProve(
            circuitInputs,
            CIRCUIT_PATHS.withdrawWithChange.wasm,
            CIRCUIT_PATHS.withdrawWithChange.zkey
        );
        const duration = Date.now() - startTime;

        console.log(`✓ Withdraw-with-change proof generated in ${duration}ms`);
        console.log(`  Proof size: ${JSON.stringify(proof).length} bytes`);

        return { proof, publicSignals };
    }

    /**
     * Verify deposit proof (for testing)
     */
    async verifyDepositProof(proof: any, publicSignals: string[]): Promise<boolean> {
        await this.init();
        const vKey = require(`../../../${CIRCUIT_PATHS.deposit.vkey}`);
        return await this.groth16.verify(vKey, publicSignals, proof);
    }

    /**
     * Verify withdraw proof (for testing)
     */
    async verifyWithdrawProof(proof: any, publicSignals: string[]): Promise<boolean> {
        await this.init();
        const vKey = require(`../../../${CIRCUIT_PATHS.withdraw.vkey}`);
        return await this.groth16.verify(vKey, publicSignals, proof);
    }

    /**
     * Verify withdraw-with-change proof (for testing)
     */
    async verifyWithdrawWithChangeProof(proof: any, publicSignals: string[]): Promise<boolean> {
        await this.init();
        const vKey = require(`../../../${CIRCUIT_PATHS.withdrawWithChange.vkey}`);
        return await this.groth16.verify(vKey, publicSignals, proof);
    }
}

// Singleton instance
export const v3ProofGenerator = new V3ProofGenerator();
