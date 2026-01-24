'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { 
  getAssociatedTokenAddressSync, 
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
} from '@solana/spl-token';
import { SystemProgram, Transaction } from '@solana/web3.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Copy, CheckCircle2, XCircle, Clock, Shield, ArrowDown, ArrowUp, Eye, EyeOff } from 'lucide-react';

import { WalletConnectionBlocker } from '@/components/wallet-connection-blocker';

// Lazy load V5 SDK to avoid loading heavy ZK libraries on initial page load
const COMMON_AMOUNTS = [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50, 100]; // SOL

const DEVNET_RPC = 'https://api.devnet.solana.com';

// Define types locally to avoid import issues
type PaymentStatus = 'Pending' | 'Paid' | 'Expired' | 'Cancelled';

interface PaymentRequestInfo {
  requestId: string;
  payee: PublicKey;
  amount: number;
  status: PaymentStatus;
  createdAt: Date;
  expiresAt: Date;
  paidAt?: Date;
  metadataHash?: string;
  paymentUrl: string;
  qrCode?: string;
  pda: PublicKey;
}

export function X402PlaygroundClient() {
  const wallet = useWallet();
  const [connection] = useState(() => new Connection(DEVNET_RPC, 'confirmed'));
  const [dunV5Client, setDunV5Client] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [clientInitializing, setClientInitializing] = useState(true);

  // Payment Request Creation (Payee)
  const [amount, setAmount] = useState<number>(0.1);
  const [expiresIn, setExpiresIn] = useState<number>(3600);
  const [metadata, setMetadata] = useState<string>('');
  const [createdRequest, setCreatedRequest] = useState<PaymentRequestInfo | null>(null);

  // Payment Execution (Payer)
  const [paymentUrl, setPaymentUrl] = useState<string>('');
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequestInfo | null>(null);
  const [activeTab, setActiveTab] = useState<string>('create');
  const [lastTxSignature, setLastTxSignature] = useState<string | null>(null);
  const [showPrivacyAnalysis, setShowPrivacyAnalysis] = useState(false);
  const [analysisAddress, setAnalysisAddress] = useState<string>('');
  const [analysisData, setAnalysisData] = useState<any>(null);

  // Wrap/Unwrap
  const [isWrapping, setIsWrapping] = useState(false);
  const [isUnwrapping, setIsUnwrapping] = useState(false);
  const [wrapAmount, setWrapAmount] = useState('0.1');
  const [unwrapAmount, setUnwrapAmount] = useState('0.1');
  const [wrappedBalance, setWrappedBalance] = useState<number>(0);
  const [nativeBalance, setNativeBalance] = useState<number>(0);
  const [isInitializing, setIsInitializing] = useState(false);

  // My Payment Requests
  const [myRequests, setMyRequests] = useState<PaymentRequestInfo[]>([]);

  // Auto-load payment request from URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && dunV5Client) {
      const urlParams = new URLSearchParams(window.location.search);
      const requestParam = urlParams.get('request');
      
      if (requestParam) {
        // Auto-load payment request and switch to pay tab
        setPaymentUrl(window.location.href);
        setActiveTab('pay');
        loadPaymentRequestFromPDA(requestParam);
      }
    }
  }, [dunV5Client]);

  // Load payment request from PDA address
  const loadPaymentRequestFromPDA = async (pdaAddress: string) => {
    if (!dunV5Client) return;
    
    setLoading(true);
    setError(null);

    try {
      const pda = new PublicKey(pdaAddress);
      const request = await dunV5Client.getPaymentRequest(pda);
      
      setPaymentRequest(request);
      setSuccess('Payment request loaded successfully!');
    } catch (err: any) {
      console.error('Load request error:', err);
      setError(err.message || 'Failed to load payment request');
    } finally {
      setLoading(false);
    }
  };

  // Initialize V5 client
  useEffect(() => {
    if (wallet.publicKey && wallet.signMessage && wallet.signTransaction && wallet.signAllTransactions) {
      setClientInitializing(true);
      setError(null);
      
      // Dynamically import V5 SDK
      import('@/lib/dun/v5')
        .then(({ DunV5Client }) => {
          const client = new DunV5Client(connection, wallet as any);
          setDunV5Client(client);
          setClientInitializing(false);
          console.log('✓ V5 client initialized');
        })
        .catch(err => {
          console.error('[V5] Failed to initialize:', err);
          // Suppress "Account not found" errors - these are expected
          if (err?.message?.includes('Account not found')) {
            console.warn('[V5] Account validation warning (expected if program not deployed)');
            setClientInitializing(false);
            // Try to create client anyway by re-importing
            import('@/lib/dun/v5').then(({ DunV5Client }) => {
              try {
                const client = new DunV5Client(connection, wallet as any);
                setDunV5Client(client);
              } catch (e) {
                console.error('[V5] Second attempt failed:', e);
              }
            });
          } else {
            setError(`Failed to initialize V5: ${err instanceof Error ? err.message : String(err)}`);
            setClientInitializing(false);
          }
        });

      // Fetch balances
      connection.getBalance(wallet.publicKey).then((bal) => {
        setNativeBalance(bal / LAMPORTS_PER_SOL);
      });

      const wrappedSolAccount = getAssociatedTokenAddressSync(NATIVE_MINT, wallet.publicKey);
      connection.getTokenAccountBalance(wrappedSolAccount).then((bal) => {
        setWrappedBalance(Number(bal.value.amount) / LAMPORTS_PER_SOL);
      }).catch(() => {
        setWrappedBalance(0);
      });
    } else {
      setDunV5Client(null);
      setClientInitializing(false);
    }
  }, [wallet.publicKey, wallet.signMessage, wallet.signTransaction, wallet.signAllTransactions, connection]);

  // Load my payment requests when client is ready
  useEffect(() => {
    if (dunV5Client && wallet.publicKey) {
      loadMyRequests();
    }
  }, [dunV5Client, wallet.publicKey]);

  // Load my payment requests
  const loadMyRequests = async () => {
    if (!dunV5Client || !wallet.publicKey) return;
    
    try {
      const requests = await dunV5Client.listPaymentRequests(wallet.publicKey);
      setMyRequests(requests);
    } catch (err: any) {
      console.error('Failed to load requests:', err);
    }
  };

  // Create payment request
  const handleCreateRequest = async () => {
    if (!wallet.publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    if (!dunV5Client) {
      setError('V5 client is still initializing. Please wait a moment and try again.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await dunV5Client.createPaymentRequest({
        amount,
        expiresIn,
        metadata: metadata || undefined,
        wallet,
      });

      // Fetch the created payment request
      const requestData = await (dunV5Client.program.account as any).paymentRequest.fetch(result.address);
      
      // Convert to PaymentRequestInfo
      const requestInfo: PaymentRequestInfo = {
        requestId: Buffer.from(requestData.requestId).toString('hex'),
        payee: requestData.payee,
        amount: requestData.amount / LAMPORTS_PER_SOL,
        status: requestData.status.pending ? 'Pending' :
                requestData.status.paid ? 'Paid' :
                requestData.status.expired ? 'Expired' :
                'Cancelled',
        createdAt: new Date(requestData.createdAt * 1000),
        expiresAt: new Date(requestData.expiresAt * 1000),
        paidAt: requestData.paidAt ? new Date(requestData.paidAt * 1000) : undefined,
        metadataHash: requestData.metadataHash ? Buffer.from(requestData.metadataHash).toString('hex') : undefined,
        paymentUrl: `${window.location.origin}/dapp/x402-playground?request=${result.address.toBase58()}`,
        pda: result.address,
      };

      setCreatedRequest(requestInfo);
      setSuccess(`Payment request created! Tx: ${result.signature.slice(0, 8)}...`);
      
      // Refresh my requests
      await loadMyRequests();
    } catch (err: any) {
      console.error('Create request error:', err);
      setError(err.message || 'Failed to create payment request');
    } finally {
      setLoading(false);
    }
  };

  // Load payment request from URL
  const handleLoadPaymentRequest = async () => {
    if (!dunV5Client) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Extract PDA from URL - support both 'request' and 'pay' parameters
      const url = new URL(paymentUrl);
      const requestParam = url.searchParams.get('request') || url.searchParams.get('pay');
      
      if (!requestParam) {
        throw new Error('Invalid payment URL - missing request parameter');
      }

      await loadPaymentRequestFromPDA(requestParam);
    } catch (err: any) {
      console.error('Load request error:', err);
      setError(err.message || 'Failed to load payment request');
      setLoading(false);
    }
  };

  // Execute payment
  const handlePayment = async () => {
    if (!dunV5Client || !paymentRequest) {
      setError('No payment request loaded');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const txSignature = await dunV5Client.privacyTransfer({
        paymentRequestPDA: paymentRequest.pda,
        wallet,
      });

      setLastTxSignature(txSignature);
      setSuccess(`Payment completed! Tx: ${txSignature.slice(0, 8)}...`);
      
      // Reload payment request to show updated status
      const updatedRequest = await dunV5Client.getPaymentRequest(paymentRequest.pda);
      setPaymentRequest(updatedRequest);
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  // Cancel payment request
  const handleCancelRequest = async (pda: PublicKey) => {
    if (!dunV5Client) {
      setError('Client not initialized');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const txSignature = await dunV5Client.cancelPaymentRequest(pda.toBase58());
      setSuccess(`Payment request cancelled! Tx: ${txSignature.slice(0, 8)}...`);
      
      // Refresh my requests
      await loadMyRequests();
    } catch (err: any) {
      console.error('Cancel request error:', err);
      setError(err.message || 'Failed to cancel payment request');
    } finally {
      setLoading(false);
    }
  };

  // Initialize pool vault
  const handleInitializeVault = async () => {
    if (!dunV5Client) {
      setError('Client not initialized');
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      const result = await dunV5Client.initializePoolVault();
      if (result === 'already_initialized') {
        setSuccess('Pool vault already initialized!');
      } else {
        setSuccess(`Pool vault initialized! Tx: ${result.slice(0, 8)}...`);
      }
    } catch (err: any) {
      console.error('Initialize error:', err);
      setError(err.message || 'Failed to initialize pool vault');
    } finally {
      setIsInitializing(false);
    }
  };

  // Wrap SOL
  const handleWrapSol = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Please connect your wallet first');
      return;
    }

    setIsWrapping(true);
    setError(null);

    try {
      const amount = parseFloat(wrapAmount);
      const amountLamports = Math.floor(amount * LAMPORTS_PER_SOL);

      setSuccess(`Wrapping ${amount} SOL...`);

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

      const signed = await wallet.signTransaction(transaction);
      const txSignature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(txSignature, 'confirmed');

      setSuccess(`Successfully wrapped ${amount} SOL! Tx: ${txSignature.slice(0, 8)}...`);

      // Refresh balances
      const nativeBal = await connection.getBalance(wallet.publicKey);
      setNativeBalance(nativeBal / LAMPORTS_PER_SOL);
      const wrappedBal = await connection.getTokenAccountBalance(wrappedSolAccount);
      setWrappedBalance(Number(wrappedBal.value.amount) / LAMPORTS_PER_SOL);
    } catch (err: any) {
      console.error('Wrap error:', err);
      setError(err.message || 'Wrapping failed');
    } finally {
      setIsWrapping(false);
    }
  };

  // Unwrap SOL
  const handleUnwrapSol = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Please connect your wallet first');
      return;
    }

    setIsUnwrapping(true);
    setError(null);

    try {
      const amount = parseFloat(unwrapAmount);
      const amountLamports = Math.floor(amount * LAMPORTS_PER_SOL);

      setSuccess(`Unwrapping ${amount} SOL...`);

      const wrappedSolAccount = getAssociatedTokenAddressSync(NATIVE_MINT, wallet.publicKey);
      const accountInfo = await connection.getTokenAccountBalance(wrappedSolAccount);
      const currentBalance = Number(accountInfo.value.amount);

      if (currentBalance < amountLamports) {
        throw new Error(`Insufficient wrapped SOL. You have ${currentBalance / LAMPORTS_PER_SOL} SOL`);
      }

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

      const signed = await wallet.signTransaction(transaction);
      const txSignature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(txSignature, 'confirmed');

      setSuccess(`Successfully unwrapped ${amount} SOL! Tx: ${txSignature.slice(0, 8)}...`);

      // Refresh balances
      const nativeBal = await connection.getBalance(wallet.publicKey);
      setNativeBalance(nativeBal / LAMPORTS_PER_SOL);
      setWrappedBalance(0);
    } catch (err: any) {
      console.error('Unwrap error:', err);
      setError(err.message || 'Unwrapping failed');
    } finally {
      setIsUnwrapping(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard!');
    setTimeout(() => setSuccess(null), 2000);
  };

  // Get status badge
  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'Pending':
        return <Badge variant="outline" className="bg-yellow-500/10"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'Paid':
        return <Badge variant="outline" className="bg-green-500/10"><CheckCircle2 className="w-3 h-3 mr-1" />Paid</Badge>;
      case 'Expired':
        return <Badge variant="outline" className="bg-gray-500/10"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>;
      case 'Cancelled':
        return <Badge variant="outline" className="bg-red-500/10"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!wallet.connected) {
    return (
      <div className="container mx-auto p-4 max-w-6xl relative min-h-[80vh]">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">x402 Privacy Transfer</h1>
          <p className="text-muted-foreground">Privacy-preserving payments on Solana</p>
        </div>
        
        {/* Semi-transparent blocker overlay */}
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
          <Card className="max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Wallet Required
              </CardTitle>
              <CardDescription>
                Connect your Solana wallet to access x402 Privacy Transfer features
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <WalletMultiButton className="!bg-primary hover:!bg-primary/90" />
              <p className="text-xs text-muted-foreground text-center">
                Or use the Connect Wallet button in the sidebar
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Placeholder content (blurred) */}
        <div className="space-y-4 opacity-50">
          <Card className="h-32" />
          <Card className="h-48" />
          <Card className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      {/* Header */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔐 x402 Privacy Payment
          </CardTitle>
          <CardDescription>
            Create payment requests and pay with hidden identity using pool-based atomic transfers
          </CardDescription>
        </CardHeader>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 bg-green-500/10 border-green-500/20">
          <AlertDescription className="text-green-600">{success}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Wallet Balance Card */}
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
              onClick={() => setActiveTab('wrap')}
              className="w-full mt-4"
            >
              <ArrowDown className="h-4 w-4 mr-2" />
              Wrap/Unwrap SOL
            </Button>
          </CardContent>
        </Card>

        {/* Payment Requests Card with Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Requests</CardTitle>
            <CardDescription>
              Create payment requests or pay existing ones with privacy
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="create" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="create">Create Request</TabsTrigger>
                <TabsTrigger value="my-requests">My Requests</TabsTrigger>
                <TabsTrigger value="pay">Pay Request</TabsTrigger>
              </TabsList>

              {/* Create Request Tab */}
              <TabsContent value="create" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  As a payee (merchant/creator), create a payment request for customers
                </p>
                
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (SOL)</Label>
                  <select
                    id="amount"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value))}
                    className="w-full p-2 border rounded-md bg-background"
                  >
                    {COMMON_AMOUNTS.map((amt) => (
                      <option key={amt} value={amt}>
                        {amt} SOL
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Only COMMON_AMOUNTS allowed for privacy
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expires">Expires In (seconds)</Label>
                  <Input
                    id="expires"
                    type="number"
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(parseInt(e.target.value))}
                    placeholder="3600"
                  />
                  <p className="text-xs text-muted-foreground">
                    {Math.floor(expiresIn / 3600)} hours {Math.floor((expiresIn % 3600) / 60)} minutes
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="metadata">Description (optional)</Label>
                  <Input
                    id="metadata"
                    value={metadata}
                    onChange={(e) => setMetadata(e.target.value)}
                    placeholder="Premium article access"
                  />
                </div>

                <Button
                  onClick={handleCreateRequest}
                  disabled={loading || clientInitializing}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : clientInitializing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    'Create Payment Request'
                  )}
                </Button>

                {createdRequest && (
                  <div className="mt-6 p-4 border rounded-lg space-y-4">
                    <h3 className="font-semibold">Payment Request Created!</h3>
                    
                    <div className="space-y-2">
                      <Label>Payment URL</Label>
                      <div className="flex gap-2">
                        <Input value={createdRequest.paymentUrl} readOnly />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => copyToClipboard(createdRequest.paymentUrl)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {createdRequest.qrCode && (
                      <div className="flex flex-col items-center space-y-2">
                        <Label>QR Code</Label>
                        <img
                          src={createdRequest.qrCode}
                          alt="Payment QR Code"
                          className="w-48 h-48 border rounded-lg"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label>Amount</Label>
                        <p className="font-mono">{createdRequest.amount} SOL</p>
                      </div>
                      <div>
                        <Label>Status</Label>
                        <p>{getStatusBadge(createdRequest.status)}</p>
                      </div>
                      <div>
                        <Label>Expires At</Label>
                        <p>{createdRequest.expiresAt.toLocaleString()}</p>
                      </div>
                      <div>
                        <Label>Request ID</Label>
                        <p className="font-mono text-xs truncate">{createdRequest.requestId}</p>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* My Requests Tab */}
              <TabsContent value="my-requests" className="space-y-4 mt-4">
                {myRequests.length === 0 ? (
                  <p className="text-center text-muted-foreground p-8">
                    No payment requests yet. Create one to get started!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {myRequests.map((request) => (
                      <div key={request.requestId} className="p-3 border rounded-lg space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-lg font-bold">{request.amount} SOL</p>
                            <p className="text-xs text-muted-foreground">
                              Created: {request.createdAt.toLocaleString()}
                            </p>
                          </div>
                          {getStatusBadge(request.status)}
                        </div>
                        
                        <div className="flex gap-2">
                          <Input value={request.paymentUrl} readOnly className="text-xs" />
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => copyToClipboard(request.paymentUrl)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Expires: {request.expiresAt.toLocaleString()}
                        </p>

                        {request.status === 'Pending' && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancelRequest(request.pda)}
                            disabled={loading}
                            className="w-full mt-2"
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Cancelling...
                              </>
                            ) : (
                              <>
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancel Request
                              </>
                            )}
                          </Button>
                        )}

                        {request.status === 'Cancelled' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelRequest(request.pda)}
                            disabled={loading}
                            className="w-full mt-2"
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Closing...
                              </>
                            ) : (
                              <>
                                <XCircle className="mr-2 h-4 w-4" />
                                Close Account (Reclaim Rent)
                              </>
                            )}
                          </Button>
                        )}

                        {request.status === 'Paid' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (dunV5Client) {
                                try {
                                  const prData = await dunV5Client.getPaymentRequest(request.pda);
                                  setAnalysisData(prData);
                                  setAnalysisAddress(request.pda.toBase58());
                                  setShowPrivacyAnalysis(true);
                                } catch (err) {
                                  console.error('Failed to fetch payment request:', err);
                                }
                              }
                            }}
                            className="w-full mt-2"
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            Privacy Analysis
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Pay Request Tab */}
              <TabsContent value="pay" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  As a payer (customer), pay a payment request with hidden identity
                </p>
                
                <div className="space-y-2">
                  <Label htmlFor="paymentUrl">Payment URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="paymentUrl"
                      value={paymentUrl}
                      onChange={(e) => setPaymentUrl(e.target.value)}
                      placeholder="https://your-app.com/dapp/x402-payment?request=..."
                    />
                    <Button
                      onClick={handleLoadPaymentRequest}
                      disabled={loading || !paymentUrl}
                    >
                      Load
                    </Button>
                  </div>
                </div>

                {paymentRequest && (
                  <div className="p-4 border rounded-lg space-y-4">
                    <h3 className="font-semibold">Payment Request Details</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Amount</Label>
                        <p className="text-2xl font-bold">{paymentRequest.amount} SOL</p>
                      </div>
                      <div>
                        <Label>Status</Label>
                        <p>{getStatusBadge(paymentRequest.status)}</p>
                      </div>
                      <div>
                        <Label>Payee</Label>
                        <p className="font-mono text-xs truncate">{paymentRequest.payee.toString()}</p>
                      </div>
                      <div>
                        <Label>Expires At</Label>
                        <p className="text-sm">{paymentRequest.expiresAt.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Check if expired */}
                    {new Date() > paymentRequest.expiresAt && paymentRequest.status === 'Pending' && (
                      <Alert variant="destructive">
                        <AlertDescription>
                          This payment request has expired and can no longer be paid.
                        </AlertDescription>
                      </Alert>
                    )}

                    {paymentRequest.status === 'Pending' && new Date() <= paymentRequest.expiresAt && (
                      <Alert className="bg-blue-500/10 border-blue-500/20">
                        <AlertDescription className="text-blue-600">
                          ✓ Your identity will be hidden during this payment
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button
                      onClick={handlePayment}
                      disabled={loading || paymentRequest.status !== 'Pending' || new Date() > paymentRequest.expiresAt}
                      className="w-full"
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing Payment...
                        </>
                      ) : new Date() > paymentRequest.expiresAt ? (
                        'Payment Request Expired'
                      ) : paymentRequest.status !== 'Pending' ? (
                        `Cannot Pay - Status: ${paymentRequest.status}`
                      ) : (
                        `Pay ${paymentRequest.amount} SOL with Privacy`
                      )}
                    </Button>

                    {lastTxSignature && (
                      <div className="mt-4 p-4 border rounded-lg bg-green-50 space-y-3">
                        <h3 className="font-semibold text-green-800">✓ Payment Successful!</h3>
                        
                        <div className="space-y-2">
                          <Label>Transaction Signature</Label>
                          <div className="flex gap-2">
                            <Input 
                              value={lastTxSignature} 
                              readOnly 
                              className="font-mono text-xs"
                            />
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => copyToClipboard(lastTxSignature)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => window.open(`https://explorer.solana.com/tx/${lastTxSignature}?cluster=devnet`, '_blank')}
                            className="flex-1"
                          >
                            View in Explorer
                          </Button>
                          <Button
                            variant="outline"
                            onClick={async () => {
                              if (dunV5Client) {
                                try {
                                  const prData = await dunV5Client.getPaymentRequest(paymentRequest.pda);
                                  setAnalysisData(prData);
                                  setAnalysisAddress(paymentRequest.pda.toBase58());
                                  setShowPrivacyAnalysis(true);
                                } catch (err) {
                                  console.error('Failed to fetch payment request:', err);
                                }
                              }
                            }}
                            className="flex-1"
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Privacy Analysis
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Wrap/Unwrap Modal */}
      <Dialog open={activeTab === 'wrap'} onOpenChange={(open) => !open && setActiveTab('create')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDown className="h-5 w-5" />
              Wrap/Unwrap SOL
            </DialogTitle>
            <DialogDescription>
              Convert between native SOL and wrapped SOL for payments
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <AlertDescription>
              V5 uses token accounts for payments. You need wrapped SOL (wSOL) to make payments.
            </AlertDescription>
          </Alert>

          {/* Initialize Pool Vault */}
          <div className="p-4 border-2 border-dashed rounded-lg bg-blue-50">
            <h3 className="font-semibold mb-2">⚙️ Protocol Setup (One-Time)</h3>
            <p className="text-sm text-muted-foreground mb-3">
              The pool vault must be initialized once before anyone can make payments.
            </p>
            <Button
              onClick={handleInitializeVault}
              disabled={isInitializing || !dunV5Client}
              variant="outline"
              className="w-full"
            >
              {isInitializing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                'Initialize Pool Vault'
              )}
            </Button>
          </div>

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
                Convert native SOL to wrapped SOL for making payments
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
                  if (!isWrapping) setActiveTab('create');
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
                  if (!isUnwrapping) setActiveTab('create');
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

      {/* Privacy Analysis Modal */}
      <Dialog open={showPrivacyAnalysis} onOpenChange={setShowPrivacyAnalysis}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              x402 Payment Privacy Analysis
            </DialogTitle>
            <DialogDescription>
              On-chain data analysis for x402 privacy transfer
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Two Column Layout */}
            <div className="grid grid-cols-2 gap-6">
              {/* What's Visible On-Chain */}
              <div>
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  What's Visible On-Chain
                </h3>
                <div className="space-y-2">
                  <div className="p-3 rounded border bg-background">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Payment Request ID</span>
                      <Eye className="h-3 w-3 text-yellow-600" />
                    </div>
                    <div className="text-xs font-mono mt-1 break-all">
                      {analysisData?.requestId || 'Loading...'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Unique identifier for this payment request
                    </div>
                  </div>

                  <div className="p-3 rounded border bg-background">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Payee Address</span>
                      <Eye className="h-3 w-3 text-yellow-600" />
                    </div>
                    <div className="text-xs font-mono mt-1 break-all">
                      {analysisData?.payee?.toString() || 'Loading...'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Recipient's wallet address (public by design)
                    </div>
                  </div>

                  <div className="p-3 rounded border bg-background">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Amount</span>
                      <Eye className="h-3 w-3 text-yellow-600" />
                    </div>
                    <div className="text-xs font-mono mt-1">
                      {analysisData?.amount ? `${analysisData.amount} SOL` : 'Loading...'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Payment amount (one of COMMON_AMOUNTS for privacy set)
                    </div>
                  </div>

                  <div className="p-3 rounded border bg-background">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Status</span>
                      <Eye className="h-3 w-3 text-yellow-600" />
                    </div>
                    <div className="text-xs font-mono mt-1">
                      {analysisData?.status || 'Loading...'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Whether payment has been completed
                    </div>
                  </div>

                  <div className="p-3 rounded border bg-background">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Timestamps</span>
                      <Eye className="h-3 w-3 text-yellow-600" />
                    </div>
                    <div className="text-xs font-mono mt-1">
                      Created: {analysisData?.createdAt?.toLocaleString() || 'Loading...'}
                      {analysisData?.paidAt && (
                        <><br/>Paid: {analysisData.paidAt.toLocaleString()}</>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      When request was created and paid
                    </div>
                  </div>

                  <div className="p-3 rounded border bg-background">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Pool Vault Transfer</span>
                      <Eye className="h-3 w-3 text-yellow-600" />
                    </div>
                    <div className="text-xs font-mono mt-1">
                      Deposit → Pool → Withdraw (atomic)
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Transaction shows pool interaction, not direct transfer
                    </div>
                  </div>
                </div>
              </div>

              {/* What's Hidden */}
              <div>
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  <EyeOff className="h-4 w-4" />
                  What's Hidden
                </h3>
                <div className="space-y-2">
                  <div className="p-3 rounded border bg-green-50 border-green-300">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Payer Identity</span>
                      <EyeOff className="h-3 w-3 text-green-600" />
                    </div>
                    <div className="text-xs font-mono mt-1">
                      ✓ HIDDEN - No direct link to payer's wallet
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Payment goes through pool vault, breaking the connection
                    </div>
                  </div>

                  <div className="p-3 rounded border bg-green-50 border-green-300">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Payer's Token Account</span>
                      <EyeOff className="h-3 w-3 text-green-600" />
                    </div>
                    <div className="text-xs font-mono mt-1">
                      ✓ HIDDEN - Only pool vault address visible
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Atomic deposit-withdraw hides source account
                    </div>
                  </div>

                  <div className="p-3 rounded border bg-green-50 border-green-300">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Secret Key</span>
                      <EyeOff className="h-3 w-3 text-green-600" />
                    </div>
                    <div className="text-xs font-mono mt-1">
                      ✓ HIDDEN - Derived from wallet signature (Poseidon hash)
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Only you can derive this from your wallet
                    </div>
                  </div>

                  <div className="p-3 rounded border bg-green-50 border-green-300">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Commitment Hash</span>
                      <EyeOff className="h-3 w-3 text-green-600" />
                    </div>
                    <div className="text-xs font-mono mt-1">
                      ✓ HIDDEN - Poseidon(secret, amount, nonce)
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Cryptographically binds payment without revealing payer
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Technical Details */}
            <Alert className="border-green-500 bg-green-50">
              <AlertDescription>
                <strong>Privacy Mechanism:</strong> V5 uses atomic pool-based transfers. Your payment 
                deposits to a shared pool vault and immediately withdraws to the payee in a single transaction. 
                This breaks the direct link between your wallet and the payment, while using V3's Poseidon 
                hash commitments to cryptographically prove the payment without revealing your identity.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              {analysisAddress && (
                <Button
                  variant="outline"
                  onClick={() => window.open(`https://explorer.solana.com/address/${analysisAddress}?cluster=devnet`, '_blank')}
                  className="flex-1"
                >
                  View in Explorer
                </Button>
              )}
              <Button onClick={() => setShowPrivacyAnalysis(false)} className="flex-1">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
