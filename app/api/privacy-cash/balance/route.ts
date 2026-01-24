import { NextRequest, NextResponse } from 'next/server';
import { PrivacyCash } from 'privacycash';
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URLS = {
  'devnet': 'https://api.devnet.solana.com',
  'mainnet-beta': process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
};

export async function POST(request: NextRequest) {
  try {
    const { privateKey, walletAddress, network } = await request.json();

    if (!privateKey || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const rpcUrl = RPC_URLS[network as keyof typeof RPC_URLS] || RPC_URLS['devnet'];
    const connection = new Connection(rpcUrl, 'confirmed');

    // Get wallet balance
    const publicKey = new PublicKey(walletAddress);
    const walletBalance = await connection.getBalance(publicKey);

    // Get private balance
    const privacyCash = new PrivacyCash({
      RPC_url: rpcUrl,
      owner: privateKey,
      enableDebug: false,
    });

    const privateBalance = await privacyCash.getPrivateBalance();

    return NextResponse.json({
      walletBalance,
      privateBalance: privateBalance.lamports,
    });
  } catch (error) {
    console.error('Balance fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}
