import { PublicKey } from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';

export interface DunConfig {
    wallet: WalletAdapter;
    network: 'devnet' | 'mainnet' | 'localnet';
    rpcUrl?: string;
    lightRpcUrl?: string;      // Photon indexer URL
    proverUrl?: string;         // Prover URL
    proofMode?: 'client' | 'server';
}

export interface DepositParams {
    amount: number;
    token: string;
}

export interface DepositResult {
    success: boolean;
    txSignature: string;
    newBalance: number;
    commitment: string;
}

export interface WithdrawParams {
    amount: number;
    token: string;
    recipient?: string;
}

export interface WithdrawResult {
    success: boolean;
    txSignature: string;
    newBalance: number;
    nullifier: string;
}

export interface TransferParams {
    amount: number;
    token: string;
    recipient: string;
}

export interface TransferResult {
    success: boolean;
    txSignature: string;
    senderNewBalance: number;
    senderNullifier: string;
    recipientCommitment: string;
}

export interface BalanceInfo {
    amount: number;
    commitment: string | null;
}

export interface InitializeResult {
    success: boolean;
    signature: string;
}

export interface CommitmentData {
    commitment: Buffer;
    amount: bigint;
    blindingFactor: bigint;
    tokenMint: PublicKey;
    createdAt: number;
    isSpent: boolean;
}

export interface SecretData {
    privateKey: bigint;
    blindingFactor: bigint;
}
