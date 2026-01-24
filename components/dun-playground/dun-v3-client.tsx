'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, LAMPORTS_PER_SOL, SystemProgram, Transaction } from '@solana/web3.js';
import { 
  getAssociatedTokenAddressSync, 
  NATIVE_MINT,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
} from '@solana/spl-token';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff, RefreshCw, Shield, ArrowDown, ArrowUp, ArrowLeftRight, HelpCircle } from 'lucide-react';
import { DunV3Client, type V3BalanceInfo } from '@/dun-protocol/sdk/src/v3';
import { PrivacyAnalyzerModal } from './privacy-analyzer-modal';

const DEVNET_RPC = 'https://api.devnet.solana.com';
const COMMON_AMOUNTS = [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50, 100]; // SOL

export function DunV3ClientComponent() {
    const wallet = useWallet();
    
    // Memoize connection to avoid recreating on every render
    const connection = useMemo(() => new Connection(DEVNET_RPC, 'confirmed'), []);
    
    // State
    const [depositAmount, setDepositAmount] = useState(0.1);
    const [withdrawAmount, setWithdrawAmount] = useState(0.1);
    const [recipientAddress, setRecipientAddress] = useState('');
    const [balance, setBalance] = useState<V3BalanceInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [status, setStatus] = useState<{
        type: 'success' | 'error' | 'info';
        message: string;
    } | null>(null);
    const [showCommitments, setShowCommitments] = useState(false);
    const [analyzerModal, setAnalyzerModal] = useState<{
        isOpen: boolean;
        address: string;
        amount: number;
    } | null>(null);
    
    // Wrap/Unwrap state
    const [nativeBalance, setNativeBalance] = useState<number>(0);
    const [wrappedBalance, setWrappedBalance] = useState<number>(0);
    const [wrapAmount, setWrapAmount] = useState('0.1');
    const [unwrapAmount, setUnwrapAmount] = useState('0.1');
    const [isWrapping, setIsWrapping] = useState(false);
    const [isUnwrapping, setIsUnwrapping] = useState(false);
    const [showWrapModal, setShowWrapModal] = useState(false);
    const [showAmountInfoModal, setShowAmountInfoModal] = useState(false);
    
    // Client instance
    const [client, setClient] = useState<DunV3Client | null>(null);
    
    // Initialize client when wallet connects
    useEffect(() => {
        if (wallet.publicKey && wallet.signMessage) {
            const dunClient = new DunV3Client(connection, wallet as any);
            setClient(dunClient);
        } else {
            setClient(null);
            setBalance(null);
        }
    }, [wallet.publicKey, wallet.signMessage, connection]);
    
    // Load SOL and wSOL balances
    useEffect(() => {
        if (!wallet.publicKey) {
            setNativeBalance(0);
            setWrappedBalance(0);
            return;
        }

        connection.getBalance(wallet.publicKey).then((bal) => {
            setNativeBalance(bal / LAMPORTS_PER_SOL);
        });

        const wrappedSolAccount = getAssociatedTokenAddressSync(NATIVE_MINT, wallet.publicKey);
        connection.getTokenAccountBalance(wrappedSolAccount).then((bal) => {
            setWrappedBalance(Number(bal.value.amount) / LAMPORTS_PER_SOL);
        }).catch(() => {
            setWrappedBalance(0);
        });
    }, [wallet.publicKey, connection]);
    
    /**
     * Wrap SOL to wSOL
     */
    const handleWrapSol = async () => {
        if (!wallet.publicKey || !wallet.signTransaction) {
            setStatus({ type: 'error', message: 'Please connect your wallet first' });
            return;
        }

        setIsWrapping(true);
        setStatus(null);

        try {
            const amount = parseFloat(wrapAmount);
            const amountLamports = Math.floor(amount * LAMPORTS_PER_SOL);

            setStatus({ type: 'info', message: `Wrapping ${amount} SOL...` });

            const wrappedSolAccount = getAssociatedTokenAddressSync(NATIVE_MINT, wallet.publicKey);
            const accountInfo = await connection.getAccountInfo(wrappedSolAccount);

            const transaction = new Transaction();

            if (!accountInfo) {
                const createAccountIx = createAssociatedTokenAccountInstruction(
                    wallet.publicKey,
                    wrappedSolAccount,
                    wallet.publicKey,
                    NATIVE_MINT
                );
                transaction.add(createAccountIx);
            }

            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: wallet.publicKey,
                    toPubkey: wrappedSolAccount,
                    lamports: amountLamports,
                })
            );

            transaction.add(createSyncNativeInstruction(wrappedSolAccount));

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = wallet.publicKey;

            const signedTx = await wallet.signTransaction(transaction);
            const txSignature = await connection.sendRawTransaction(signedTx.serialize());
            await connection.confirmTransaction(txSignature, 'confirmed');

            setStatus({ type: 'success', message: `Successfully wrapped ${amount} SOL!` });

            // Refresh balances
            const nativeBal = await connection.getBalance(wallet.publicKey);
            setNativeBalance(nativeBal / LAMPORTS_PER_SOL);
            const wrappedBal = await connection.getTokenAccountBalance(wrappedSolAccount);
            setWrappedBalance(Number(wrappedBal.value.amount) / LAMPORTS_PER_SOL);
        } catch (err: any) {
            console.error('Wrap error:', err);
            
            // Check if user rejected the transaction
            if (err.message?.includes('User rejected') || 
                err.message?.includes('rejected') ||
                err.code === 4001 ||
                err.code === 'ACTION_REJECTED') {
                setStatus({ type: 'error', message: 'Transaction cancelled by user' });
            } else {
                setStatus({ type: 'error', message: err.message || 'Wrapping failed' });
            }
        } finally {
            setIsWrapping(false);
        }
    };

    /**
     * Unwrap wSOL to SOL
     */
    const handleUnwrapSol = async () => {
        if (!wallet.publicKey || !wallet.signTransaction) {
            setStatus({ type: 'error', message: 'Please connect your wallet first' });
            return;
        }

        setIsUnwrapping(true);
        setStatus(null);

        try {
            const amount = parseFloat(unwrapAmount);
            setStatus({ type: 'info', message: `Unwrapping ${amount} SOL...` });

            const wrappedSolAccount = getAssociatedTokenAddressSync(NATIVE_MINT, wallet.publicKey);

            const transaction = new Transaction();
            transaction.add(
                createCloseAccountInstruction(
                    wrappedSolAccount,
                    wallet.publicKey,
                    wallet.publicKey
                )
            );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = wallet.publicKey;

            const signedTx = await wallet.signTransaction(transaction);
            const txSignature = await connection.sendRawTransaction(signedTx.serialize());
            await connection.confirmTransaction(txSignature, 'confirmed');

            setStatus({ type: 'success', message: `Successfully unwrapped ${amount} SOL!` });

            // Refresh balances
            const nativeBal = await connection.getBalance(wallet.publicKey);
            setNativeBalance(nativeBal / LAMPORTS_PER_SOL);
            setWrappedBalance(0);
        } catch (err: any) {
            console.error('Unwrap error:', err);
            
            // Check if user rejected the transaction
            if (err.message?.includes('User rejected') || 
                err.message?.includes('rejected') ||
                err.code === 4001 ||
                err.code === 'ACTION_REJECTED') {
                setStatus({ type: 'error', message: 'Transaction cancelled by user' });
            } else {
                setStatus({ type: 'error', message: err.message || 'Unwrapping failed' });
            }
        } finally {
            setIsUnwrapping(false);
        }
    };
    
    /**
     * Scan blockchain for balance
     */
    const handleScanBalance = useCallback(async () => {
        if (!client) {
            setStatus({ type: 'error', message: 'Please connect your wallet first' });
            return;
        }
        
        setIsScanning(true);
        setStatus({ type: 'info', message: 'Scanning blockchain for your commitments...' });
        
        try {
            const balanceInfo = await client.getBalance('SOL');
            setBalance(balanceInfo);
            
            if (balanceInfo.totalBalance === 0) {
                setStatus({
                    type: 'info',
                    message: 'No balance found. Make a deposit to get started!'
                });
            } else {
                setStatus({
                    type: 'success',
                    message: `Balance: ${balanceInfo.totalBalance.toFixed(4)} SOL (${balanceInfo.commitments.filter(c => !c.isSpent).length} unspent commitments)`
                });
            }
        } catch (error: any) {
            console.error('Scan error:', error);
            setStatus({
                type: 'error',
                message: `Scan failed: ${error.message}`
            });
        } finally {
            setIsScanning(false);
        }
    }, [client]);
    
    /**
     * Deposit SOL
     */
    const handleDeposit = async () => {
        if (!client) {
            setStatus({ type: 'error', message: 'Please connect your wallet first' });
            return;
        }
        
        if (!COMMON_AMOUNTS.includes(depositAmount)) {
            setStatus({ type: 'error', message: 'Please select a valid common amount' });
            return;
        }
        
        setIsLoading(true);
        setStatus({ type: 'info', message: 'Generating proof... This may take 2-3 seconds' });
        
        try {
            const signature = await client.deposit({
                amount: depositAmount,
                token: 'SOL',
            });
            
            setStatus({
                type: 'success',
                message: `Deposited ${depositAmount} SOL! Amount is hidden on-chain ✓`
            });
            
            // Refresh balance
            setTimeout(() => handleScanBalance(), 2000);
            
        } catch (error: any) {
            console.error('Deposit error:', error);
            
            // Check if user rejected the signature or transaction
            if (error.message?.includes('User rejected') || 
                error.message?.includes('rejected') ||
                error.message?.includes('signature request') ||
                error.code === 4001 ||
                error.code === 'ACTION_REJECTED') {
                setStatus({
                    type: 'error',
                    message: 'Transaction cancelled by user'
                });
            } else {
                setStatus({
                    type: 'error',
                    message: `Deposit failed: ${error.message}`
                });
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    /**
     * Withdraw SOL
     */
    const handleWithdraw = async () => {
        if (!client) {
            setStatus({ type: 'error', message: 'Please connect your wallet first' });
            return;
        }
        
        if (!COMMON_AMOUNTS.includes(withdrawAmount)) {
            setStatus({ type: 'error', message: 'Please select a valid common amount' });
            return;
        }
        
        if (!balance || balance.totalBalance < withdrawAmount) {
            setStatus({
                type: 'error',
                message: `Insufficient balance. Available: ${balance?.totalBalance || 0} SOL`
            });
            return;
        }
        
        setIsLoading(true);
        setStatus({ type: 'info', message: 'Generating proof... This may take 3-5 seconds' });
        
        try {
            const signature = await client.withdraw({
                amount: withdrawAmount,
                token: 'SOL',
                recipient: recipientAddress || undefined,
            });
            
            const changeAmount = balance.commitments
                .filter(c => !c.isSpent)
                .reduce((sum, c) => sum + c.amount, 0) - withdrawAmount;
            
            setStatus({
                type: 'success',
                message: `Withdrew ${withdrawAmount} SOL! ${changeAmount > 0 ? `Change (${changeAmount.toFixed(4)} SOL) automatically handled ✓` : ''}`
            });
            
            // Refresh balance
            setTimeout(() => handleScanBalance(), 2000);
            
        } catch (error: any) {
            console.error('Withdraw error:', error);
            
            // Check if user rejected the signature or transaction
            if (error.message?.includes('User rejected') || 
                error.message?.includes('rejected') ||
                error.message?.includes('signature request') ||
                error.code === 4001 ||
                error.code === 'ACTION_REJECTED') {
                setStatus({
                    type: 'error',
                    message: 'Transaction cancelled by user'
                });
            } else {
                setStatus({
                    type: 'error',
                    message: `Withdraw failed: ${error.message}`
                });
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="space-y-6">
            {/* Header */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        🔐 Shielded Privacy Pool
                    </CardTitle>
                    <CardDescription>
                        Deposit and withdraw with complete privacy. Amounts are hidden on-chain using ZK proofs.
                    </CardDescription>
                </CardHeader>
            </Card>
            
            {/* Your Wallet Balance Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Your Wallet Balance</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                        <div>
                            <Label className="text-xs text-muted-foreground">Native SOL</Label>
                            <p className="text-2xl font-bold">{nativeBalance.toFixed(4)}</p>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground">Wrapped SOL</Label>
                            <p className="text-2xl font-bold">{wrappedBalance.toFixed(4)}</p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowWrapModal(true)}
                        className="w-full mt-4"
                    >
                        <ArrowLeftRight className="h-4 w-4 mr-2" />
                        Wrap/Unwrap SOL
                    </Button>
                </CardContent>
            </Card>

            {/* Privacy Pool Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Privacy Pool</CardTitle>
                    <CardDescription>
                        Deposit and withdraw with complete privacy using ZK proofs
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Pool Balance */}
                    <div className="p-4 border rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Label className="text-sm font-semibold">Pool Balance</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleScanBalance}
                                    disabled={!client || isScanning}
                                    className="h-7 px-2"
                                >
                                    {isScanning ? (
                                        <>
                                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                            <span className="text-xs">Scanning...</span>
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="h-3 w-3 mr-1" />
                                            <span className="text-xs">Refresh</span>
                                        </>
                                    )}
                                </Button>
                            </div>
                            <span className="text-2xl font-bold text-green-600">
                                {balance ? `${balance.totalBalance.toFixed(4)} SOL` : '--- SOL'}
                            </span>
                        </div>
                        
                        {!balance && (
                            <p className="text-sm text-muted-foreground mt-2">
                                Click "Refresh" to scan for your balance
                            </p>
                        )}
                        
                        {balance && balance.commitments.length > 0 && (
                            <div className="mt-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowCommitments(!showCommitments)}
                                >
                                    {showCommitments ? (
                                        <>
                                            <EyeOff className="mr-2 h-4 w-4" />
                                            Hide Commitments
                                        </>
                                    ) : (
                                        <>
                                            <Eye className="mr-2 h-4 w-4" />
                                            Show Commitments ({balance.commitments.length})
                                        </>
                                    )}
                                </Button>
                                
                                {showCommitments && (
                                    <div className="space-y-2 text-sm mt-2">
                                        {balance.commitments.map((c, i) => (
                                            <div
                                                key={i}
                                                className={`p-3 rounded border ${
                                                    c.isSpent
                                                        ? 'bg-muted text-muted-foreground'
                                                        : 'bg-background'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-semibold">
                                                        Commitment #{i + 1}
                                                    </span>
                                                    <span className={`font-mono ${c.isSpent ? 'line-through' : 'text-green-600 font-bold'}`}>
                                                        {c.amount.toFixed(4)} SOL
                                                    </span>
                                                </div>
                                                
                                                <div className="space-y-1 text-xs">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-muted-foreground">Account:</span>
                                                        <a
                                                            href={`https://explorer.solana.com/address/${c.address}?cluster=devnet`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="font-mono text-blue-600 hover:underline"
                                                        >
                                                            {c.address.slice(0, 4)}...{c.address.slice(-4)}
                                                        </a>
                                                    </div>
                                                    
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-muted-foreground">Hash:</span>
                                                        <span className="font-mono">
                                                            {c.commitment.slice(0, 8)}...{c.commitment.slice(-8)}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-muted-foreground">Nonce:</span>
                                                        <span>{c.nonce}</span>
                                                    </div>
                                                    
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-muted-foreground">Status:</span>
                                                        <span className={c.isSpent ? 'text-red-600' : 'text-green-600'}>
                                                            {c.isSpent ? '✗ Spent' : '✓ Unspent'}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                <div className="mt-2 pt-2 border-t flex items-center justify-between">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => setAnalyzerModal({
                                                            isOpen: true,
                                                            address: c.address,
                                                            amount: c.amount,
                                                        })}
                                                        className="h-7 text-xs"
                                                    >
                                                        <Shield className="h-3 w-3 mr-1" />
                                                        Privacy Analysis
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Deposit/Withdraw Tabs */}
                    <Tabs defaultValue="deposit" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="deposit">Deposit</TabsTrigger>
                            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
                        </TabsList>
                        
                        {/* Deposit Tab */}
                        <TabsContent value="deposit" className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Amount (SOL)</label>
                                <select
                                    value={depositAmount}
                                    onChange={(e) => setDepositAmount(parseFloat(e.target.value))}
                                    className="w-full p-2 border rounded-md bg-background"
                                    disabled={isLoading}
                                >
                                    {COMMON_AMOUNTS.map((amt) => (
                                        <option key={amt} value={amt}>
                                            {amt} SOL
                                        </option>
                                    ))}
                                </select>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <span>Only COMMON_AMOUNTS allowed for privacy</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowAmountInfoModal(true)}
                                        className="inline-flex items-center hover:text-foreground transition-colors"
                                    >
                                        <HelpCircle className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                            
                            <Button
                                onClick={handleDeposit}
                                disabled={!client || isLoading}
                                className="w-full"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Depositing...
                                    </>
                                ) : (
                                    'Deposit SOL'
                                )}
                            </Button>
                        </TabsContent>
                        
                        {/* Withdraw Tab */}
                        <TabsContent value="withdraw" className="space-y-4 mt-4">
                            <p className="text-sm text-muted-foreground">
                                Withdraw only COMMON_AMOUNTS to another wallet
                            </p>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Amount (SOL)</label>
                                <select
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(parseFloat(e.target.value))}
                                    className="w-full p-2 border rounded-md bg-background"
                                    disabled={isLoading}
                                >
                                    {COMMON_AMOUNTS.map((amt) => (
                                        <option key={amt} value={amt}>
                                            {amt} SOL
                                        </option>
                                    ))}
                                </select>
                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                        <span>Only COMMON_AMOUNTS allowed for privacy</span>
                                        <button
                                            type="button"
                                            onClick={() => setShowAmountInfoModal(true)}
                                            className="inline-flex items-center hover:text-foreground transition-colors"
                                        >
                                            <HelpCircle className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                    <span className="text-muted-foreground">
                                        Available: {balance?.totalBalance.toFixed(4) || '0'} SOL
                                    </span>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Recipient Address (optional)
                                </label>
                                <Input
                                    type="text"
                                    value={recipientAddress}
                                    onChange={(e) => setRecipientAddress(e.target.value)}
                                    placeholder="Leave empty to withdraw to your wallet"
                                    disabled={isLoading}
                                />
                                <div className="text-xs text-muted-foreground">
                                    Withdraw to any address for maximum privacy
                                </div>
                            </div>
                            
                            <Button
                                onClick={handleWithdraw}
                                disabled={!client || isLoading || !balance || balance.totalBalance === 0}
                                className="w-full"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Withdrawing...
                                    </>
                                ) : (
                                    'Withdraw SOL'
                                )}
                            </Button>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
            
            {/* Amount Info Modal */}
            <Dialog open={showAmountInfoModal} onOpenChange={setShowAmountInfoModal}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            Why Only COMMON_AMOUNTS?
                        </DialogTitle>
                        <DialogDescription>
                            Understanding the privacy mechanism behind standardized amounts
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 text-sm">
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h3 className="font-semibold text-blue-900 mb-2">Anonymity Set Protection</h3>
                            <p className="text-blue-800">
                                By restricting deposits and withdrawals to COMMON_AMOUNTS (0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50, 100 SOL), 
                                your transaction mixes with all other transactions of the same amount. This creates a large anonymity set, 
                                making it impossible to link specific deposits to withdrawals.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div className="flex gap-3">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold">
                                    ✓
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-1">With COMMON_AMOUNTS</h4>
                                    <p className="text-muted-foreground">
                                        When you deposit 0.1 SOL, your commitment joins hundreds of other 0.1 SOL commitments. 
                                        When scanning the blockchain, observers cannot determine which 0.1 SOL deposit corresponds 
                                        to which withdrawal - they all look identical.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-semibold">
                                    ✗
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-1">Without COMMON_AMOUNTS</h4>
                                    <p className="text-muted-foreground">
                                        If you could deposit 0.12345 SOL (a unique amount), blockchain observers could easily 
                                        match your deposit to your withdrawal by the amount alone, completely breaking your privacy.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-muted rounded-lg">
                            <h3 className="font-semibold mb-2">How It Works Technically</h3>
                            <ol className="space-y-2 text-muted-foreground list-decimal list-inside">
                                <li>Your wallet creates a commitment hash that hides the amount using ZK proofs</li>
                                <li>The commitment is stored on-chain with no visible link to your wallet</li>
                                <li>When withdrawing, you prove ownership of a commitment without revealing which one</li>
                                <li>Because many users deposit the same COMMON_AMOUNTS, your specific transaction is hidden in the crowd</li>
                            </ol>
                        </div>

                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <h3 className="font-semibold text-amber-900 mb-2">💡 Privacy Tip</h3>
                            <p className="text-amber-800">
                                For maximum privacy, use popular amounts like 0.1 or 1 SOL which have the largest anonymity sets. 
                                The more people using the same amount, the stronger your privacy protection.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={() => setShowAmountInfoModal(false)}>
                            Got it
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Wrap/Unwrap Modal */}
            <Dialog open={showWrapModal} onOpenChange={setShowWrapModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ArrowLeftRight className="h-5 w-5" />
                            Wrap/Unwrap SOL
                        </DialogTitle>
                        <DialogDescription>
                            Convert between native SOL and wrapped SOL
                        </DialogDescription>
                    </DialogHeader>
                    
                    <Tabs defaultValue="wrap" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="wrap">
                                <ArrowDown className="h-4 w-4 mr-2" />
                                Wrap
                            </TabsTrigger>
                            <TabsTrigger value="unwrap">
                                <ArrowUp className="h-4 w-4 mr-2" />
                                Unwrap
                            </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="wrap" className="space-y-4 mt-4">
                            <p className="text-sm text-muted-foreground">
                                Convert native SOL to wrapped SOL for deposits
                            </p>
                            <div className="space-y-2">
                                <Label htmlFor="wrapAmount">Amount (SOL)</Label>
                                <Input
                                    id="wrapAmount"
                                    type="number"
                                    step="0.01"
                                    value={wrapAmount}
                                    onChange={(e) => setWrapAmount(e.target.value)}
                                    placeholder="0.1"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Available: {nativeBalance.toFixed(4)} SOL
                                </p>
                            </div>
                            <Button
                                onClick={async () => {
                                    await handleWrapSol();
                                    if (!isWrapping) setShowWrapModal(false);
                                }}
                                disabled={isWrapping || !wallet.publicKey}
                                className="w-full"
                            >
                                {isWrapping ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Wrapping...
                                    </>
                                ) : (
                                    <>
                                        <ArrowDown className="mr-2 h-4 w-4" />
                                        Wrap {wrapAmount} SOL
                                    </>
                                )}
                            </Button>
                        </TabsContent>
                        
                        <TabsContent value="unwrap" className="space-y-4 mt-4">
                            <p className="text-sm text-muted-foreground">
                                Convert wrapped SOL back to native SOL
                            </p>
                            <div className="space-y-2">
                                <Label htmlFor="unwrapAmount">Amount (SOL)</Label>
                                <Input
                                    id="unwrapAmount"
                                    type="number"
                                    step="0.01"
                                    value={unwrapAmount}
                                    onChange={(e) => setUnwrapAmount(e.target.value)}
                                    placeholder="0.1"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Available: {wrappedBalance.toFixed(4)} wSOL
                                </p>
                            </div>
                            <Button
                                onClick={async () => {
                                    await handleUnwrapSol();
                                    if (!isUnwrapping) setShowWrapModal(false);
                                }}
                                disabled={isUnwrapping || !wallet.publicKey || wrappedBalance === 0}
                                className="w-full"
                                variant="outline"
                            >
                                {isUnwrapping ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Unwrapping...
                                    </>
                                ) : (
                                    <>
                                        <ArrowUp className="mr-2 h-4 w-4" />
                                        Unwrap {unwrapAmount} SOL
                                    </>
                                )}
                            </Button>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
            
            {/* Privacy Analyzer Modal */}
            {analyzerModal && (
                <PrivacyAnalyzerModal
                    isOpen={analyzerModal.isOpen}
                    onClose={() => setAnalyzerModal(null)}
                    address={analyzerModal.address}
                    version="v3"
                    knownAmount={analyzerModal.amount}
                />
            )}
            
            {/* Status Messages */}
            {status && (
                <Alert variant={status.type === 'error' ? 'destructive' : 'default'}>
                    <div className="flex items-start gap-2">
                        {status.type === 'success' && <CheckCircle2 className="h-4 w-4 mt-0.5" />}
                        {status.type === 'error' && <XCircle className="h-4 w-4 mt-0.5" />}
                        {status.type === 'info' && <Loader2 className="h-4 w-4 mt-0.5 animate-spin" />}
                        <AlertDescription>{status.message}</AlertDescription>
                    </div>
                </Alert>
            )}
            
        </div>
    );
}
