// Re-export V3 SDK from dun-protocol folder
export { DunV3Client } from '@/dun-protocol/sdk/src/v3/client';
export { V3SecretManager, v3SecretManager, COMMON_AMOUNTS } from '@/dun-protocol/sdk/src/v3/secrets';
export { V3ProofGenerator, v3ProofGenerator } from '@/dun-protocol/sdk/src/v3/proofs';
export type {
  V3DepositParams,
  V3WithdrawParams,
  V3BalanceInfo,
} from '@/dun-protocol/sdk/src/v3/client';
