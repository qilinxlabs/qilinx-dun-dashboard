/**
 * Dun V3 SDK
 * Privacy pool with hidden amounts
 * 
 * Key Features:
 * - Amounts hidden on-chain (no amount field in commitments)
 * - Variable withdrawals (any amount up to balance)
 * - Automatic change handling
 * - Deterministic secrets (no localStorage needed)
 * - Blockchain scanning (like V1)
 */

export { DunV3Client } from './client';
export type { V3DepositParams, V3WithdrawParams, V3BalanceInfo } from './client';

export { V3ProofGenerator, v3ProofGenerator } from './proofs';
export type {
    DepositProofInputs,
    WithdrawProofInputs,
    WithdrawWithChangeProofInputs,
    ProofResult,
} from './proofs';

export { V3SecretManager, v3SecretManager, COMMON_AMOUNTS } from './secrets';
