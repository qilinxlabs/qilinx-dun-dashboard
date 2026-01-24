import { PublicKey } from '@solana/web3.js';

export interface PaymentRequestInfo {
  requestId: string;
  payee: PublicKey;
  amount: number; // in SOL
  status: PaymentStatus;
  createdAt: Date;
  expiresAt: Date;
  paidAt?: Date;
  metadataHash?: string;
  paymentUrl: string;
  qrCode?: string;
  pda: PublicKey;
}

export enum PaymentStatus {
  Pending = 'Pending',
  Paid = 'Paid',
  Expired = 'Expired',
  Cancelled = 'Cancelled',
}

export interface CreatePaymentRequestParams {
  amount: number; // in SOL (must be COMMON_AMOUNT)
  expiresIn: number; // seconds
  metadata?: string;
  wallet: any;
}

export interface PrivacyTransferParams {
  paymentRequestPDA: PublicKey;
  wallet: any;
}

export const COMMON_AMOUNTS = [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50, 100]; // SOL
