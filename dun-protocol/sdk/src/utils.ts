import { PublicKey } from '@solana/web3.js';

export class TokenUtils {
    private static readonly TOKEN_DECIMALS: Record<string, number> = {
        SOL: 9,
        USDC: 6,
        USDT: 6,
    };

    private static readonly TOKEN_MINTS: Record<string, string> = {
        SOL: 'So11111111111111111111111111111111111111112',
        USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Mainnet USDC
        USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // Mainnet USDT
    };

    static getDecimals(token: string): number {
        return this.TOKEN_DECIMALS[token.toUpperCase()] || 9;
    }

    static toSmallestUnit(amount: number, token: string): bigint {
        const decimals = this.getDecimals(token);
        return BigInt(Math.floor(amount * Math.pow(10, decimals)));
    }

    static fromSmallestUnit(amount: bigint, token: string): number {
        const decimals = this.getDecimals(token);
        return Number(amount) / Math.pow(10, decimals);
    }

    static getTokenMint(token: string): PublicKey {
        const mint = this.TOKEN_MINTS[token.toUpperCase()];
        if (!mint) {
            throw new Error(`Unknown token: ${token}`);
        }
        return new PublicKey(mint);
    }

    static formatAmount(amount: number, token: string): string {
        const decimals = this.getDecimals(token);
        return amount.toFixed(Math.min(decimals, 4));
    }
}

export function generateRandomBigInt(): bigint {
    const bytes = new Uint8Array(32);
    if (typeof globalThis !== 'undefined' && globalThis.crypto) {
        globalThis.crypto.getRandomValues(bytes);
    } else {
        // Node.js environment
        const crypto = require('crypto');
        crypto.randomFillSync(bytes);
    }
    return BigInt('0x' + Buffer.from(bytes).toString('hex'));
}

export function bufferToBigInt(buffer: Buffer): bigint {
    return BigInt('0x' + buffer.toString('hex'));
}

export function bigIntToBuffer(value: bigint, length: number = 32): Buffer {
    const hex = value.toString(16).padStart(length * 2, '0');
    return Buffer.from(hex, 'hex');
}

export function hexToBuffer(hex: string): Buffer {
    return Buffer.from(hex.replace('0x', ''), 'hex');
}

export function bufferToHex(buffer: Buffer): string {
    return '0x' + buffer.toString('hex');
}
