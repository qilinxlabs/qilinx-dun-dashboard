import { NextRequest, NextResponse } from 'next/server';
import { PrivacyCash } from 'privacycash';

const RPC_URLS = {
  'devnet': 'https://api.devnet.solana.com',
  'mainnet-beta': process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
};

export async function POST(request: NextRequest) {
  try {
    const { privateKey, lamports, network } = await request.json();

    if (!privateKey || !lamports) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const rpcUrl = RPC_URLS[network as keyof typeof RPC_URLS] || RPC_URLS['devnet'];

    const privacyCash = new PrivacyCash({
      RPC_url: rpcUrl,
      owner: privateKey,
      enableDebug: true,
    });

    const result = await privacyCash.deposit({ lamports });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Deposit error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to deposit' },
      { status: 500 }
    );
  }
}
