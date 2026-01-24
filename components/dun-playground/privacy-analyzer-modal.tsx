'use client';

import { useState } from 'react';
import { Connection } from '@solana/web3.js';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Shield, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PrivacyAnalyzerModalProps {
    isOpen: boolean;
    onClose: () => void;
    address: string;
    version: 'v1' | 'v3';
    knownAmount?: number; // The amount you know (for comparison)
}

interface AccountAnalysis {
    discriminator: string;
    commitment: string;
    amount?: number; // Only in V1
    tokenMint: string;
    timestamp: number;
    isSpent: boolean;
    rawData: string;
}

export function PrivacyAnalyzerModal({ isOpen, onClose, address, version, knownAmount }: PrivacyAnalyzerModalProps) {
    const [analysis, setAnalysis] = useState<AccountAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const analyzeAccount = async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
            const accountInfo = await connection.getAccountInfo(new (await import('@solana/web3.js')).PublicKey(address));
            
            if (!accountInfo) {
                throw new Error('Account not found');
            }

            const data = accountInfo.data;
            
            // Parse account data
            const discriminator = Array.from(data.slice(0, 8))
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ');
            
            const commitmentBytes = data.slice(8, 40);
            const commitment = Array.from(commitmentBytes)
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ');

            let amount: number | undefined;
            let tokenMintStart: number;
            let timestampStart: number;
            let isSpentIndex: number;

            if (version === 'v1') {
                // V1: has amount field at bytes 40-47
                const amountBytes = data.slice(40, 48);
                const amountValue = Number(
                    BigInt('0x' + Array.from(amountBytes.reverse())
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join(''))
                );
                amount = amountValue / 1e9;
                tokenMintStart = 48;
                timestampStart = 80;
                isSpentIndex = 88;
            } else {
                // V3: no amount field
                tokenMintStart = 40;
                timestampStart = 72;
                isSpentIndex = 80;
            }

            const tokenMintBytes = data.slice(tokenMintStart, tokenMintStart + 32);
            const tokenMint = Array.from(tokenMintBytes)
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ');

            const timestampBytes = data.slice(timestampStart, timestampStart + 8);
            const timestamp = Number(
                BigInt('0x' + Array.from(timestampBytes.reverse())
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join(''))
            );

            const isSpent = data[isSpentIndex] !== 0;

            const rawData = Array.from(data)
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ');

            setAnalysis({
                discriminator,
                commitment,
                amount,
                tokenMint,
                timestamp,
                isSpent,
                rawData,
            });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpen = () => {
        if (isOpen && !analysis && !isLoading) {
            analyzeAccount();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" onOpenAutoFocus={handleOpen}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Privacy Analysis: {version === 'v3' ? 'Shielded Commitment' : version.toUpperCase()}
                    </DialogTitle>
                    <DialogDescription>
                        On-chain data analysis for commitment account
                    </DialogDescription>
                </DialogHeader>

                {isLoading && (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {analysis && (
                    <div className="space-y-6">
                        {/* Two Column Layout */}
                        <div className="grid grid-cols-2 gap-6">
                            {/* What's Visible */}
                            <div>
                                <h3 className="font-bold mb-3 flex items-center gap-2">
                                    <Eye className="h-4 w-4" />
                                    What's Visible On-Chain
                                </h3>
                                <div className="space-y-2">
                                    <DataField 
                                        label="Discriminator" 
                                        value={analysis.discriminator}
                                        description="Account type identifier"
                                        visible
                                    />
                                    <DataField 
                                        label="Commitment Hash" 
                                        value={analysis.commitment}
                                        description="Poseidon hash (32 bytes)"
                                        visible
                                    />
                                    {version === 'v1' && analysis.amount !== undefined && (
                                        <DataField 
                                            label="Amount" 
                                            value={`${analysis.amount.toFixed(4)} SOL (${(analysis.amount * 1e9).toFixed(0)} lamports)`}
                                            description="⚠️ EXPOSED - Anyone can see this!"
                                            visible
                                            highlight="danger"
                                        />
                                    )}
                                    <DataField 
                                        label="Token Mint" 
                                        value="SOL (wrapped)"
                                        description="Which token was deposited"
                                        visible
                                    />
                                    <DataField 
                                        label="Timestamp" 
                                        value={new Date(analysis.timestamp * 1000).toLocaleString()}
                                        description="When the deposit was made"
                                        visible
                                    />
                                    <DataField 
                                        label="Spent Status" 
                                        value={analysis.isSpent ? 'Spent' : 'Unspent'}
                                        description="Whether this commitment has been withdrawn"
                                        visible
                                    />
                                </div>
                            </div>

                            {/* What's Hidden */}
                            <div>
                                <h3 className="font-bold mb-3 flex items-center gap-2">
                                    <EyeOff className="h-4 w-4" />
                                    What's Hidden
                                </h3>
                                <div className="space-y-2">
                                    {version === 'v3' && (
                                        <DataField 
                                            label="Amount" 
                                            value={knownAmount ? `${knownAmount.toFixed(4)} SOL (you know this)` : "Unknown"}
                                            description="✓ HIDDEN - Encrypted inside Poseidon hash"
                                            visible={false}
                                            highlight="success"
                                        />
                                    )}
                                    <DataField 
                                        label="Secret Key" 
                                        value="Only you can derive this from your wallet"
                                        description="✓ HIDDEN - Required to prove ownership"
                                        visible={false}
                                    />
                                    <DataField 
                                        label="Owner" 
                                        value="No wallet address stored"
                                        description="✓ HIDDEN - Cannot link to your wallet"
                                        visible={false}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Raw Data */}
                        <details className="border rounded p-3">
                            <summary className="cursor-pointer font-semibold">
                                Raw Account Data ({version === 'v1' ? '89' : '81'} bytes)
                            </summary>
                            <pre className="mt-2 text-xs font-mono bg-muted p-2 rounded overflow-auto max-h-48 whitespace-pre-wrap break-all">
                                {analysis.rawData}
                            </pre>
                        </details>

                        {/* Comparison */}
                        {version === 'v1' && (
                            <Alert>
                                <AlertDescription>
                                    <strong>Privacy Leak:</strong> The amount field at bytes 40-47 exposes your deposit amount. 
                                    Anyone can see you deposited exactly {analysis.amount?.toFixed(4)} SOL, making it easier to 
                                    link your deposit to your withdrawal.
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => window.open(`https://explorer.solana.com/address/${address}?cluster=devnet`, '_blank')}
                                className="flex-1"
                            >
                                View in Explorer
                            </Button>
                            <Button onClick={onClose} className="flex-1">
                                Close
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function DataField({ 
    label, 
    value, 
    description, 
    visible, 
    highlight 
}: { 
    label: string; 
    value: string; 
    description: string; 
    visible: boolean;
    highlight?: 'success' | 'danger';
}) {
    return (
        <div className={`p-3 rounded border ${
            highlight === 'danger' ? 'bg-red-50 border-red-300' :
            highlight === 'success' ? 'bg-green-50 border-green-300' :
            visible ? 'bg-background' : 'bg-muted'
        }`}>
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{label}</span>
                        {visible ? (
                            <Eye className="h-3 w-3 text-yellow-600" />
                        ) : (
                            <EyeOff className="h-3 w-3 text-green-600" />
                        )}
                    </div>
                    <div className="text-xs font-mono mt-1 break-all">{value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{description}</div>
                </div>
            </div>
        </div>
    );
}
